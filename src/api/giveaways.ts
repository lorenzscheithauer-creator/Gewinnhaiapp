import { AxiosError } from 'axios';

import { apiClient } from './client';
import { ApiCategoryListResponse, ApiGiveawayDetailResponse, ApiGiveawayListResponse, ApiTopListResponse } from '../types/api';
import { Category, Giveaway, SearchParams, TopItem } from '../types/models';
import { getCache, setCache } from '../utils/cache';
import { extractDetail, extractList, mapCategory, mapGiveaway, mapTopItem } from './mappers';
import { ENV } from '../config/env';

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
      : {})
  };
}

function buildWpPostParams(params?: SearchParams): Record<string, string | number> {
  const query = params?.query?.trim();
  const categoryId = params?.categoryId?.trim();

  return {
    per_page: 25,
    _embed: 1,
    orderby: 'date',
    order: 'desc',
    ...(query ? { search: query } : {}),
    ...(categoryId ? { categories: categoryId } : {})
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

function hasMeaningfulText(value: string | undefined): boolean {
  return Boolean(value && value.trim().length >= 3);
}

function sanitizeGiveawayList(items: Giveaway[]): Giveaway[] {
  return items.filter((item) => item.id !== 'unknown' && hasMeaningfulText(item.title)).slice(0, 150);
}

function sanitizeCategoryList(items: Category[]): Category[] {
  return items
    .filter((item) => item.id !== 'unknown' && hasMeaningfulText(item.title))
    .sort((left, right) => left.title.localeCompare(right.title, 'de'));
}

function sanitizeTop10(items: TopItem[]): TopItem[] {
  return items.filter((item) => hasMeaningfulText(item.title)).sort((left, right) => left.rank - right.rank).slice(0, 10);
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


function toDetailCandidates(idOrSlug: string): string[] {
  const normalized = idOrSlug.trim().replace(/^\/+|\/+$/g, '');
  if (!normalized) return [];

  const candidates = [normalized];
  const withoutQuery = normalized.split('?')[0];
  const slugCandidate = withoutQuery.split('/').pop();
  if (slugCandidate && slugCandidate !== normalized) candidates.push(slugCandidate);

  const numericFromSlug = slugCandidate?.match(/-(\d+)$/)?.[1];
  if (numericFromSlug) candidates.push(numericFromSlug);

  return Array.from(new Set(candidates));
}

function fallbackTop10FromGiveaways(giveaways: Giveaway[]): TopItem[] {
  return giveaways.slice(0, 10).map((item, index) => ({
    id: `fallback-${item.id}`,
    rank: index + 1,
    title: item.title,
    teaser: item.teaser,
    giveawayId: item.id,
    giveawaySlug: item.slug,
    sourceUrl: item.sourceUrl
  }));
}

export async function fetchGiveaways(params?: SearchParams): Promise<Giveaway[]> {
  const cacheKey = createCacheKey(CACHE_KEYS.giveaways, params);

  try {
    const list = await tryEndpoints(ENV.endpoints.giveaways, async (endpoint) => {
      const requestParams = endpoint.includes('/wp-json/') ? buildWpPostParams(params) : buildLegacyGiveawayParams(params);
      const { data } = await apiClient.get<ApiGiveawayListResponse>(endpoint, { params: requestParams });
      const mapped = extractList(data, ['giveaways', 'items', 'entries', 'data']).map(mapGiveaway);
      const sanitized = sanitizeGiveawayList(uniqueById(mapped));

      if (!sanitized.length && mapped.length) {
        throw new Error('Es wurden keine verwertbaren Live-Gewinnspiele geliefert.');
      }

      return sanitized;
    });

    await setCache(cacheKey, list, { ttlMs: CACHE_TTL.giveaways });
    if (!params?.query && !params?.categoryId) {
      await persistFeedSnapshot(list);
    }

    return list;
  } catch (err) {
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

          if (mapped.id === 'unknown' || !hasMeaningfulText(mapped.title)) {
            throw new Error('Ungültige Detaildaten von der API erhalten.');
          }

          return mapped;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError;
    });

    await Promise.all(cacheKeys.map((cacheKey) => setCache(cacheKey, detail, { ttlMs: CACHE_TTL.giveawayDetail })));
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

    throw new Error(getErrorMessage(err));
  }
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    const list = await tryEndpoints(ENV.endpoints.categories, async (endpoint) => {
      const requestParams = endpoint.includes('/wp-json/') ? { per_page: 100, orderby: 'count', order: 'desc' } : undefined;
      const { data } = await apiClient.get<ApiCategoryListResponse>(endpoint, { params: requestParams });
      const mapped = uniqueById(extractList(data, ['categories', 'items', 'data']).map(mapCategory));
      const sanitized = sanitizeCategoryList(mapped);

      if (!sanitized.length && mapped.length) {
        throw new Error('Es wurden keine verwertbaren Live-Kategorien geliefert.');
      }

      return sanitized;
    });

    await setCache(CACHE_KEYS.categories, list, { ttlMs: CACHE_TTL.categories });
    return list;
  } catch (err) {
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
      const mapped = extractList(data, ['top10', 'items', 'data']).map((item, index) => mapTopItem(item, index));
      const sanitized = sanitizeTop10(mapped);

      if (!sanitized.length && mapped.length) {
        throw new Error('Es wurden keine verwertbaren Live-Top10-Daten geliefert.');
      }

      return sanitized;
    });

    await setCache(CACHE_KEYS.top10, list, { ttlMs: CACHE_TTL.top10 });
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
