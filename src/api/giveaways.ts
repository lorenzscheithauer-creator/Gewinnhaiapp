import axios, { AxiosError } from 'axios';

import { apiClient } from './client';
import { ApiCategoryListResponse, ApiGiveawayDetailResponse, ApiGiveawayListResponse, ApiTopListResponse } from '../types/api';
import { Category, Giveaway, SearchParams, TopItem } from '../types/models';
import { getCache, setCache } from '../utils/cache';
import { extractDetail, extractList, mapCategory, mapGiveaway, mapTopItem } from './mappers';
import { ENV } from '../config/env';
import { hasActiveSearchParams, normalizeSearchParams } from '../utils/searchParams';
import { log } from '../utils/logger';

const CACHE_TTL = {
  giveaways: 10 * 60_000,
  categories: 24 * 60 * 60_000,
  top10: 15 * 60_000,
  giveawayDetail: 30 * 60_000,
  top10TagId: 24 * 60 * 60_000,
  feedSnapshot: 12 * 60 * 60_000,
  rssGiveaways: 10 * 60_000
};

const CACHE_KEYS = {
  giveaways: 'cache:giveaways',
  categories: 'cache:categories',
  top10: 'cache:top10',
  top10TagId: 'cache:top10-tag-id',
  feedSnapshot: 'cache:feed-snapshot',
  rssGiveaways: 'cache:rss-giveaways',
  giveawayDetail: (idOrSlug: string) => `cache:giveaway-detail:${idOrSlug}`
};

const RSS_FEED_ENDPOINTS = ['/feed/', '/gewinnspiel/feed/'];

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
      return 'Keine Verbindung zur GewinnHai-API. Bitte Internetverbindung prüfen.';
    }

    if (err.response.status === 404) {
      return 'Der angeforderte API-Endpunkt wurde nicht gefunden (404).';
    }

    if (err.response.status === 408) {
      return 'Zeitüberschreitung bei der Serverantwort. Bitte erneut versuchen.';
    }

    return `API-Fehler (${err.response.status}). Bitte später erneut versuchen.`;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return 'Unbekannter Fehler.';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function extractPayloadStatus(data: Record<string, unknown>): number | undefined {
  const statusCandidate = data.status ?? asRecord(data.data).status;
  const parsed = Number(statusCandidate);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function ensureApiPayloadValid(data: unknown): void {
  if (typeof data === 'string') {
    const trimmed = data.trim().toLowerCase();
    if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<html') || trimmed.startsWith('<?xml')) {
      throw new Error('Unerwartete Antwort vom Server erhalten. Bitte später erneut versuchen.');
    }

    return;
  }

  const record = asRecord(data);
  if (!Object.keys(record).length) return;

  const status = extractPayloadStatus(record);
  const message = typeof record.message === 'string' ? record.message.trim() : undefined;
  const isErrorPayload =
    Boolean(record.error || record.errors || record.success === false || record.ok === false || record.wp_error) ||
    (Boolean(message) && Boolean(status && status >= 400));

  if (isErrorPayload) {
    throw new Error(message || `API-Fehler (${status ?? 'unbekannt'}). Bitte später erneut versuchen.`);
  }
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
  const normalized = idOrSlug.trim().replace(/^\/+|\/+$/g, '').split('?')[0];
  if (/^\d+$/.test(normalized)) return `${normalized}?_embed=1`;
  return `?slug=${encodeURIComponent(normalized)}&_embed=1`;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
}

function parseRssItems(xml: string): Giveaway[] {
  const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi));

  return sanitizeGiveawayList(
    items
      .map((match) => {
        const itemXml = match[1];
        const title = itemXml.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
        const link = itemXml.match(/<link>([\s\S]*?)<\/link>/i)?.[1];
        const description = itemXml.match(/<description>([\s\S]*?)<\/description>/i)?.[1];
        const guid = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1];
        const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1];
        const category = itemXml.match(/<category>([\s\S]*?)<\/category>/i)?.[1];

        const sourceUrl = decodeHtmlEntities((link ?? guid ?? '').trim());
        const slug = extractSlugFromUrl(sourceUrl);
        const normalizedTitle = stripHtml(title ?? '');
        const normalizedDescription = stripHtml(description ?? '');

        return {
          id: slug ?? sourceUrl ?? normalizedTitle,
          slug: slug ?? sourceUrl,
          title: normalizedTitle,
          teaser: normalizedDescription,
          description: normalizedDescription,
          sourceUrl,
          categoryLabel: stripHtml(category ?? '') || undefined,
          expiresAt: (() => {
            const parsedDate = pubDate ? new Date(pubDate) : null;
            return parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : undefined;
          })()
        } as Giveaway;
      })
      .filter((item) => Boolean(item.id && item.title))
  );
}

async function fetchRssGiveaways(): Promise<Giveaway[]> {
  const cached = await getCache<Giveaway[]>(CACHE_KEYS.rssGiveaways);
  if (cached?.length) {
    return cached;
  }

  let lastError: unknown;

  for (const endpoint of RSS_FEED_ENDPOINTS) {
    try {
      log('debug', 'Trying RSS fallback endpoint.', { endpoint });
      const response = await axios.get<string>(`${ENV.apiBaseUrl}${endpoint}`, {
        timeout: ENV.apiTimeoutMs,
        headers: { Accept: 'application/rss+xml, application/xml, text/xml;q=0.9' },
        responseType: 'text'
      });

      if (response.status >= 400) {
        throw new Error(`RSS endpoint failed (${response.status}).`);
      }

      const parsed = parseRssItems(response.data);
      if (!parsed.length) {
        throw new Error('RSS-Feed lieferte keine verwertbaren Daten.');
      }

      await setCache(CACHE_KEYS.rssGiveaways, parsed, { ttlMs: CACHE_TTL.rssGiveaways });
      log('info', 'Giveaways loaded via RSS fallback.', { endpoint, count: parsed.length });
      return parsed;
    } catch (error) {
      lastError = error;
      const status = error instanceof AxiosError ? error.response?.status : undefined;
      log('warn', 'RSS fallback endpoint failed.', {
        endpoint,
        status,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (cached?.length) return cached;
  throw lastError ?? new Error('RSS-Fallback fehlgeschlagen.');
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
      log('debug', 'Trying API endpoint.', { endpoint, attempt: index + 1, total: endpoints.length });
      return await runner(endpoint, index);
    } catch (error) {
      lastError = error;
      const isAxios = error instanceof AxiosError;
      const status = isAxios ? error.response?.status : undefined;
      const code = isAxios ? error.code : undefined;
      const reason =
        status != null
          ? `http_${status}`
          : code === 'ECONNABORTED'
            ? 'timeout'
            : isAxios && !error.response
              ? 'network_unreachable'
              : 'invalid_payload';

      if (index < endpoints.length - 1) {
        log('warn', 'Endpoint failed, switching to fallback endpoint.', {
          endpoint,
          nextEndpoint: normalizeEndpoint(endpoints[index + 1]),
          reason,
          status,
          code,
          message: error instanceof Error ? error.message : String(error)
        });
      } else {
        log('warn', 'Endpoint failed and no fallback endpoint remains.', {
          endpoint,
          reason,
          status,
          code,
          message: error instanceof Error ? error.message : String(error)
        });
      }
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
  if (/^https?:\/\//i.test(normalized)) {
    try {
      const url = new URL(normalized);
      candidates.push(url.pathname.replace(/^\/+|\/+$/g, ''));
    } catch {
      // ignore malformed url input, handled by generic candidates
    }
  }

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
      const requestParams = buildWpPostParams(normalizedParams);
      const { data } = await apiClient.get<ApiGiveawayListResponse>(endpoint, { params: requestParams });
      ensureApiPayloadValid(data);
      const mapped = extractList(data, ['giveaways', 'items', 'entries', 'data']).map(mapGiveaway);
      const sanitized = sanitizeGiveawayList(mapped);
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
    if (!hasActiveSearchParams(normalizedParams)) {
      await persistFeedSnapshot(list);
    }

    return list;
  } catch (err) {
    log('warn', 'Primary giveaways endpoints failed. Trying RSS fallback.', {
      cacheKey,
      message: err instanceof Error ? err.message : String(err)
    });

    try {
      const rssGiveaways = await fetchRssGiveaways();
      const filteredRss = applyLocalFilters(rssGiveaways, normalizedParams);
      if (filteredRss.length || hasActiveSearchParams(normalizedParams)) {
        await setCache(cacheKey, filteredRss, { ttlMs: CACHE_TTL.giveaways });
        return filteredRss;
      }
    } catch (rssError) {
      log('warn', 'RSS fallback for giveaways failed.', {
        message: rssError instanceof Error ? rssError.message : String(rssError)
      });
    }

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
          ensureApiPayloadValid(data);
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
      ensureApiPayloadValid(data);
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
    const hasWpTop10Endpoint = ENV.endpoints.top10.some((entry) => entry.includes('/wp-json/'));
    const wpTop10TagId = hasWpTop10Endpoint ? await resolveWpTagIdBySlug('top10') : undefined;

    const list = await tryEndpoints(ENV.endpoints.top10, async (endpoint) => {
      const requestParams = endpoint.includes('/wp-json/')
        ? {
            per_page: 10,
            _embed: 1,
            orderby: 'date',
            order: 'desc',
            ...(wpTop10TagId ? { tags: wpTop10TagId } : { search: 'top10' })
          }
        : undefined;
      const { data } = await apiClient.get<ApiTopListResponse>(endpoint, { params: requestParams });
      ensureApiPayloadValid(data);
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
