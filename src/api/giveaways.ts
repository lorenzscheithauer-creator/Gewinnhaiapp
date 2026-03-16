import { AxiosError } from 'axios';

import { apiClient } from './client';
import { ApiCategoryListResponse, ApiGiveawayDetailResponse, ApiGiveawayListResponse, ApiTopListResponse } from '../types/api';
import { Category, Giveaway, SearchParams, TopItem } from '../types/models';
import { getCache, setCache } from '../utils/cache';
import { extractDetail, extractList, mapCategory, mapGiveaway, mapTopItem } from './mappers';
import { ENV } from '../config/env';
import { log } from '../utils/logger';

const CACHE_TTL = {
  giveaways: 10 * 60_000,
  categories: 24 * 60 * 60_000,
  top10: 15 * 60_000,
  giveawayDetail: 30 * 60_000,
  top10TagId: 24 * 60 * 60_000,
  feedSnapshot: 12 * 60 * 60_000
};

const CACHE_KEYS = {
  giveaways: 'cache:giveaways',
  categories: 'cache:categories',
  top10: 'cache:top10',
  top10TagId: 'cache:top10-tag-id',
  feedSnapshot: 'cache:feed-snapshot',
  giveawayDetail: (idOrSlug: string) => `cache:giveaway-detail:${idOrSlug}`
};

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== '')
      .sort(([left], [right]) => left.localeCompare(right));

    return `{${entries.map(([key, entryValue]) => `${key}:${stableSerialize(entryValue)}`).join(',')}}`;
  }

  return String(value ?? '');
}

function createCacheKey(base: string, params?: SearchParams): string {
  if (!params) return base;
  return `${base}:${stableSerialize(params)}`;
}

function normalizeSearchParams(params?: SearchParams): SearchParams | undefined {
  if (!params) return undefined;

  const query = params.query?.trim();
  const categoryId = params.categoryId?.trim();
  const categorySlug = params.categorySlug?.trim().toLowerCase();

  const normalized: SearchParams = {
    query: query && query.length >= 2 ? query : undefined,
    categoryId: categoryId || undefined,
    categorySlug: categorySlug || undefined
  };

  return normalized.query || normalized.categoryId || normalized.categorySlug ? normalized : undefined;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const apiData = err.response?.data as Record<string, unknown> | undefined;
    const apiMessage =
      (typeof apiData?.message === 'string' && apiData.message) ||
      (typeof apiData?.error === 'string' && apiData.error) ||
      (typeof apiData?.detail === 'string' && apiData.detail) ||
      undefined;

    if (apiMessage) return apiMessage;

    if (err.code === 'ECONNABORTED') {
      return 'Zeitüberschreitung bei der Verbindung. Bitte erneut versuchen.';
    }

    if (!err.response) {
      return 'Keine Verbindung zur GewinnHai-API. Offline-Daten werden verwendet, sofern vorhanden.';
    }

    return `API-Fehler (${err.response.status}). Bitte später erneut versuchen.`;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return 'Unbekannter Fehler.';
}

async function fallbackCache<T>(cacheKey: string, err: unknown): Promise<T> {
  const freshCached = await getCache<T>(cacheKey);
  if (freshCached) return freshCached;

  const expiredCached = await getCache<T>(cacheKey, { allowExpired: true });
  if (expiredCached) return expiredCached;

  throw new Error(getErrorMessage(err));
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
}

function buildLegacyGiveawayParams(params?: SearchParams): Record<string, string> | undefined {
  if (!params) return undefined;

  const query = params.query?.trim();
  const categoryId = params.categoryId?.trim();
  const categorySlug = params.categorySlug?.trim();

  return {
    ...(query
      ? {
          q: query,
          query,
          search: query
        }
      : {}),
    ...(categoryId
      ? {
          category: categoryId,
          category_id: categoryId
        }
      : {}),
    ...(categorySlug
      ? {
          category_slug: categorySlug,
          categorySlug
        }
      : {})
  };
}

function buildWpPostParams(params?: SearchParams): Record<string, string | number> {
  const query = params?.query?.trim();
  const categoryId = params?.categoryId?.trim();
  const categorySlug = params?.categorySlug?.trim();

  return {
    per_page: 25,
    _embed: 1,
    orderby: 'date',
    order: 'desc',
    ...(query ? { search: query } : {}),
    ...(categoryId ? { categories: categoryId } : {}),
    ...(categorySlug ? { categories_slug: categorySlug } : {})
  };
}

function parseWpDetailId(idOrSlug: string): string {
  const normalized = idOrSlug.trim().replace(/^\/+|\/+$/g, '');
  if (/^\d+$/.test(normalized)) return `${normalized}?_embed=1`;
  return `?slug=${encodeURIComponent(normalized)}&_embed=1`;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();

  items.forEach((item) => {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  });

  return Array.from(map.values());
}

function uniqueGiveaways(items: Giveaway[]): Giveaway[] {
  const byIdentity = new Map<string, Giveaway>();

  items.forEach((item) => {
    const keys = [item.id, item.slug, item.sourceUrl].map((entry) => entry?.trim().toLowerCase()).filter(Boolean) as string[];

    if (!keys.length) {
      return;
    }

    const existing = keys.map((key) => byIdentity.get(key)).find(Boolean);
    const merged = mergeGiveawayWithFallback(item, existing ?? null);

    keys.forEach((key) => byIdentity.set(key, merged));
  });

  const seen = new Set<string>();
  const result: Giveaway[] = [];

  byIdentity.forEach((item) => {
    const fingerprint = `${item.id}::${item.slug}::${item.sourceUrl}`;
    if (seen.has(fingerprint)) return;
    seen.add(fingerprint);
    result.push(item);
  });

  return result;
}

function hasMeaningfulText(value: string | undefined): boolean {
  return Boolean(value && value.trim().length >= 3);
}

function sanitizeGiveawayList(items: Giveaway[]): Giveaway[] {
  return uniqueGiveaways(items)
    .filter((item) => item.id !== 'unknown' && hasMeaningfulText(item.title))
    .slice(0, 150);
}

function mergeGiveawayWithFallback(primary: Giveaway, fallback?: Giveaway | null): Giveaway {
  if (!fallback) return primary;

  return {
    ...fallback,
    ...primary,
    teaser: hasMeaningfulText(primary.teaser) ? primary.teaser : fallback.teaser,
    description: hasMeaningfulText(primary.description) ? primary.description : fallback.description,
    imageUrl: primary.imageUrl ?? fallback.imageUrl,
    sourceUrl: primary.sourceUrl ?? fallback.sourceUrl,
    categoryId: primary.categoryId ?? fallback.categoryId,
    categorySlug: primary.categorySlug ?? fallback.categorySlug,
    categoryLabel: primary.categoryLabel ?? fallback.categoryLabel,
    expiresAt: primary.expiresAt ?? fallback.expiresAt
  };
}

function sanitizeCategoryList(items: Category[]): Category[] {
  return items
    .filter((item) => item.id !== 'unknown' && hasMeaningfulText(item.title))
    .sort((left, right) => left.title.localeCompare(right.title, 'de'));
}

function sanitizeTop10(items: TopItem[]): TopItem[] {
  const sanitized = items
    .filter((item) => hasMeaningfulText(item.title))
    .sort((left, right) => left.rank - right.rank)
    .slice(0, 10)
    .map((item, index) => ({
      ...item,
      rank: Number.isFinite(item.rank) && item.rank > 0 ? item.rank : index + 1
    }));

  return sanitized.map((item, index) => ({ ...item, rank: index + 1 }));
}

function includesTop10Hint(item: Record<string, unknown>): boolean {
  const values = [item.slug, item.title, item.name, item.link, item.source_url]
    .map((entry) => String(entry ?? '').toLowerCase())
    .join(' ');

  return values.includes('top10') || values.includes('top-10') || values.includes('top 10');
}

async function resolveDetailFromFeed(candidate: string): Promise<Giveaway | null> {
  const [freshFeed, staleFeed] = await Promise.all([
    getCache<Giveaway[]>(CACHE_KEYS.giveaways),
    getCache<Giveaway[]>(CACHE_KEYS.giveaways, { allowExpired: true })
  ]);

  const merged = uniqueById([...(freshFeed ?? []), ...(staleFeed ?? [])]);
  if (!merged.length) return null;

  const normalized = candidate.trim().toLowerCase();
  return (
    merged.find((item) => [item.id, item.slug].map((entry) => entry?.toLowerCase()).includes(normalized)) ??
    merged.find((item) => item.sourceUrl?.toLowerCase().includes(normalized)) ??
    null
  );
}

async function persistFeedSnapshot(giveaways: Giveaway[]): Promise<void> {
  const snapshot = {
    ids: giveaways.slice(0, 100).map((item) => item.id),
    updatedAt: new Date().toISOString()
  };

  await setCache(CACHE_KEYS.feedSnapshot, snapshot, { ttlMs: CACHE_TTL.feedSnapshot });
}

async function tryEndpoints<T>(
  endpoints: string[],
  runner: (endpoint: string, index: number) => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (let index = 0; index < endpoints.length; index += 1) {
    const endpoint = normalizeEndpoint(endpoints[index]);

    try {
      return await runner(endpoint, index);
    } catch (error) {
      lastError = error;
      log('warn', 'Endpoint request failed, trying next fallback.', { endpoint, error });
    }
  }

  throw lastError;
}

async function resolveWpTagIdBySlug(slug: string): Promise<number | undefined> {
  const cached = await getCache<number>(`${CACHE_KEYS.top10TagId}:${slug}`);
  if (cached) return cached;

  try {
    const { data } = await apiClient.get<unknown[]>('/wp-json/wp/v2/tags', {
      params: { slug, per_page: 1 }
    });

    const first = Array.isArray(data) ? data[0] : undefined;
    const id = typeof first === 'object' && first ? Number((first as Record<string, unknown>).id) : NaN;
    if (Number.isFinite(id)) {
      await setCache(`${CACHE_KEYS.top10TagId}:${slug}`, id, { ttlMs: CACHE_TTL.top10TagId });
      return id;
    }
  } catch {
    // handled by caller with fallback params
  }

  return undefined;
}



function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toDetailCandidates(idOrSlug: string): string[] {
  const normalized = idOrSlug.trim().replace(/^\/+|\/+$/g, '');
  if (!normalized) return [];

  const candidates = [normalized, safeDecode(normalized)];
  const withoutQuery = normalized.split('?')[0];
  const slugCandidate = withoutQuery.split('/').pop();
  if (slugCandidate && slugCandidate !== normalized) candidates.push(slugCandidate);

  const numericFromSlug = slugCandidate?.match(/-(\d+)$/)?.[1];
  if (numericFromSlug) candidates.push(numericFromSlug);

  return Array.from(new Set(candidates));
}



function toSafeLower(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function mergeByConfidence(primary: Giveaway, fallback?: Giveaway | null): Giveaway {
  const merged = mergeGiveawayWithFallback(primary, fallback);
  return {
    ...merged,
    sourceUrl: merged.sourceUrl ?? fallback?.sourceUrl,
    categoryId: merged.categoryId ?? fallback?.categoryId,
    categorySlug: merged.categorySlug ?? fallback?.categorySlug,
    categoryLabel: merged.categoryLabel ?? fallback?.categoryLabel,
    expiresAt: merged.expiresAt ?? fallback?.expiresAt
  };
}

function validateGiveawayDetail(item: Giveaway): Giveaway {
  if (item.id === 'unknown' || !hasMeaningfulText(item.title)) {
    throw new Error('Ungültige Detaildaten von der API erhalten.');
  }

  if (!item.sourceUrl && !item.slug && !item.id) {
    throw new Error('Detaildaten enthalten keinen gültigen Ziel-Link.');
  }

  return item;
}

function extractSlugFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  const sanitized = url.split('?')[0].replace(/\/+$/, '');
  const slug = sanitized.split('/').pop();
  return slug?.trim() || undefined;
}

function fallbackTop10FromGiveaways(giveaways: Giveaway[]): TopItem[] {
  return giveaways.slice(0, 10).map((item, index) => ({
    id: `fallback-${item.id}`,
    rank: index + 1,
    title: item.title,
    teaser: item.teaser,
    giveawayId: item.id,
    giveawaySlug: item.slug || extractSlugFromUrl(item.sourceUrl),
    sourceUrl: item.sourceUrl
  }));
}

function hasDirectTop10Reference(items: unknown[]): boolean {
  return items.some((item) => includesTop10Hint((item && typeof item === 'object' ? item : {}) as Record<string, unknown>));
}

function filterGiveawaysByCategory(items: Giveaway[], params?: SearchParams): Giveaway[] {
  if (!params?.categoryId && !params?.categorySlug) return items;

  const normalizedId = params.categoryId?.trim();
  const normalizedSlug = params.categorySlug?.trim().toLowerCase();

  return items.filter((item) => {
    const idMatches = normalizedId ? toSafeLower(item.categoryId) === toSafeLower(normalizedId) : false;
    const slugMatches = normalizedSlug
      ? [item.categorySlug, item.categoryLabel]
          .map((entry) => String(entry ?? '').toLowerCase().trim().replace(/\s+/g, '-'))
          .some((entry) => entry === normalizedSlug)
      : false;

    return normalizedId && normalizedSlug ? idMatches || slugMatches : idMatches || slugMatches;
  });
}

function filterGiveawaysByQuery(items: Giveaway[], params?: SearchParams): Giveaway[] {
  const query = params?.query?.trim().toLowerCase();
  if (!query || query.length < 2) return items;

  return items.filter((item) => {
    const candidate = [item.title, item.teaser, item.description, item.categoryLabel]
      .map((value) => value?.toLowerCase().trim())
      .filter(Boolean)
      .join(' ');

    return candidate.includes(query);
  });
}

function applyLocalFilters(items: Giveaway[], params?: SearchParams): Giveaway[] {
  return filterGiveawaysByQuery(filterGiveawaysByCategory(items, params), params);
}

async function fallbackGiveawaysFromBaseCache(params?: SearchParams): Promise<Giveaway[] | null> {
  const baseCache = (await getCache<Giveaway[]>(CACHE_KEYS.giveaways, { allowExpired: true })) ?? [];
  if (!baseCache.length) return null;

  const filtered = applyLocalFilters(baseCache, params);
  return filtered.length ? filtered : null;
}

async function fallbackCategoriesFromGiveaways(): Promise<Category[] | null> {
  const baseCache = (await getCache<Giveaway[]>(CACHE_KEYS.giveaways, { allowExpired: true })) ?? [];
  if (!baseCache.length) return null;

  const inferred = sanitizeCategoryList(
    uniqueById(
      baseCache
        .filter((item) => item.categoryId || item.categorySlug || item.categoryLabel)
        .map((item, index) => ({
          id: item.categoryId ?? item.categorySlug ?? `derived-${index}`,
          slug: item.categorySlug ?? item.categoryId ?? `derived-${index}`,
          title: item.categoryLabel ?? item.categorySlug ?? `Kategorie ${index + 1}`,
          iconUrl: undefined
        }))
    )
  );

  return inferred.length ? inferred : null;
}

export async function fetchGiveaways(params?: SearchParams): Promise<Giveaway[]> {
  const normalizedParams = normalizeSearchParams(params);
  const cacheKey = createCacheKey(CACHE_KEYS.giveaways, normalizedParams);

  try {
    const list = await tryEndpoints(ENV.endpoints.giveaways, async (endpoint) => {
      const requestParams = endpoint.includes('/wp-json/') ? buildWpPostParams(normalizedParams) : buildLegacyGiveawayParams(normalizedParams);
      const { data } = await apiClient.get<ApiGiveawayListResponse>(endpoint, { params: requestParams });
      const mapped = extractList(data, ['giveaways', 'items', 'entries', 'data']).map(mapGiveaway);
      const sanitized = sanitizeGiveawayList(uniqueById(mapped));
      const filtered = applyLocalFilters(sanitized, normalizedParams);

      if (!filtered.length) {
        if (normalizedParams?.query || normalizedParams?.categoryId || normalizedParams?.categorySlug) {
          return [];
        }

        throw new Error('Es wurden keine verwertbaren Live-Gewinnspiele geliefert.');
      }

      return filtered;
    });

    await setCache(cacheKey, list, { ttlMs: CACHE_TTL.giveaways });
    log('info', 'Giveaways synced from API.', { count: list.length, cacheKey });
    if (!normalizedParams?.query && !normalizedParams?.categoryId && !normalizedParams?.categorySlug) {
      await persistFeedSnapshot(list);
    }

    return list;
  } catch (err) {
    const fromBaseCache = await fallbackGiveawaysFromBaseCache(normalizedParams);
    if (fromBaseCache) return fromBaseCache;

    return fallbackCache<Giveaway[]>(cacheKey, err);
  }
}

export async function fetchGiveawayDetail(idOrSlug: string): Promise<Giveaway> {
  const candidates = toDetailCandidates(idOrSlug);
  const cacheKeys = candidates.length ? candidates.map((candidate) => CACHE_KEYS.giveawayDetail(candidate)) : [CACHE_KEYS.giveawayDetail(idOrSlug)];

  try {
    const detail = await tryEndpoints(ENV.endpoints.giveawayDetail, async (endpoint) => {
      let lastError: unknown;

      for (const candidate of candidates.length ? candidates : [idOrSlug]) {
        try {
          const target = endpoint
            .replace('{idOrSlug}', endpoint.includes('/wp-json/') ? parseWpDetailId(candidate) : encodeURIComponent(candidate))
            .replace(/\/\/{2,}/g, '/');
          const { data } = await apiClient.get<ApiGiveawayDetailResponse>(target);
          const extracted = extractDetail(data);
          const item = Array.isArray(extracted) ? extracted[0] : extracted;
          const mapped = mapGiveaway(item);
          const feedFallback = await resolveDetailFromFeed(candidate);
          const enriched = mergeByConfidence(mapped, feedFallback);
          return validateGiveawayDetail(enriched);
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError;
    });

    await Promise.all(cacheKeys.map((cacheKey) => setCache(cacheKey, detail, { ttlMs: CACHE_TTL.giveawayDetail })));
    log('info', 'Giveaway detail synced from API.', { idOrSlug, resolvedId: detail.id });
    return detail;
  } catch (err) {
    for (const cacheKey of cacheKeys) {
      const cached = await getCache<Giveaway>(cacheKey);
      if (cached) return cached;
    }

    for (const cacheKey of cacheKeys) {
      const cached = await getCache<Giveaway>(cacheKey, { allowExpired: true });
      if (cached) return cached;
    }

    for (const candidate of candidates) {
      const fromFeed = await resolveDetailFromFeed(candidate);
      if (fromFeed) return fromFeed;
    }

    throw new Error(getErrorMessage(err));
  }
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    const list = await tryEndpoints(ENV.endpoints.categories, async (endpoint) => {
      const requestParams = endpoint.includes('/wp-json/') ? { per_page: 100, orderby: 'count', order: 'desc' } : undefined;
      const { data } = await apiClient.get<ApiCategoryListResponse>(endpoint, { params: requestParams });
      const rawItems = extractList(data, ['categories', 'items', 'data']);
      const mapped = uniqueById(
        rawItems
          .filter((item) => {
            const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
            const count = Number(record.count ?? 1);
            return Number.isFinite(count) ? count > 0 : true;
          })
          .map(mapCategory)
      );
      const sanitized = sanitizeCategoryList(mapped);

      if (!sanitized.length) {
        throw new Error('Es wurden keine verwertbaren Live-Kategorien geliefert.');
      }

      return sanitized;
    });

    await setCache(CACHE_KEYS.categories, list, { ttlMs: CACHE_TTL.categories });
    log('info', 'Categories synced from API.', { count: list.length });
    return list;
  } catch (err) {
    const fromGiveaways = await fallbackCategoriesFromGiveaways();
    if (fromGiveaways) return fromGiveaways;

    return fallbackCache<Category[]>(CACHE_KEYS.categories, err);
  }
}

export async function fetchTop10(): Promise<TopItem[]> {
  try {
    const list = await tryEndpoints(ENV.endpoints.top10, async (endpoint) => {
      const requestParams = endpoint.includes('/wp-json/')
        ? {
            per_page: 10,
            _embed: 1,
            orderby: 'date',
            order: 'desc',
            ...(await (async () => {
              const tagId = await resolveWpTagIdBySlug('top10');
              return tagId ? { tags: tagId } : { search: 'top10' };
            })())
          }
        : undefined;
      const { data } = await apiClient.get<ApiTopListResponse>(endpoint, { params: requestParams });
      const rawItems = extractList(data, ['top10', 'items', 'data']);
      const isWpEndpoint = endpoint.includes('/wp-json/');
      const hasTop10Reference = hasDirectTop10Reference(rawItems);
      const mapped = rawItems
        .filter((item) => {
          if (!isWpEndpoint) return true;
          const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
          return includesTop10Hint(record) || !hasTop10Reference;
        })
        .map((item, index) => {
          const parsed = mapTopItem(item, index);
          const inferredSlug = extractSlugFromUrl(parsed.sourceUrl);

          return {
            ...parsed,
            giveawaySlug: parsed.giveawaySlug ?? inferredSlug,
            giveawayId: parsed.giveawayId ?? inferredSlug
          };
        });
      const sanitized = sanitizeTop10(mapped);

      if (!sanitized.length) {
        throw new Error('Es wurden keine verwertbaren Live-Top10-Daten geliefert.');
      }

      return sanitized;
    });

    await setCache(CACHE_KEYS.top10, list, { ttlMs: CACHE_TTL.top10 });
    log('info', 'Top10 synced from API.', { count: list.length });
    return list;
  } catch (err) {
    const fallbackFromCache = await getCache<TopItem[]>(CACHE_KEYS.top10, { allowExpired: true });
    if (fallbackFromCache?.length) return fallbackFromCache;

    try {
      const giveaways = await fetchGiveaways();
      const fallback = fallbackTop10FromGiveaways(giveaways);
      if (fallback.length) {
        await setCache(CACHE_KEYS.top10, fallback, { ttlMs: CACHE_TTL.top10 });
        return fallback;
      }
    } catch {
      // ignore and use the canonical fallback below
    }

    return fallbackCache<TopItem[]>(CACHE_KEYS.top10, err);
  }
}
