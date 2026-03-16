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
  feedSnapshot: 12 * 60 * 60_000
};

const CACHE_KEYS = {
  giveaways: 'cache:giveaways',
  categories: 'cache:categories',
  top10: 'cache:top10',
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
    per_page: 20,
    _embed: 1,
    ...(query ? { search: query } : {}),
    ...(categoryId ? { categories: categoryId } : {})
  };
}

function buildWpTop10Params(): Record<string, string | number> {
  return {
    per_page: 10,
    _embed: 1,
    tags: 'top10'
  };
}

function parseWpDetailId(idOrSlug: string): string {
  const normalized = idOrSlug.trim();
  if (/^\d+$/.test(normalized)) return normalized;
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

export async function fetchGiveaways(params?: SearchParams): Promise<Giveaway[]> {
  const cacheKey = createCacheKey(CACHE_KEYS.giveaways, params);

  try {
    const list = await tryEndpoints(ENV.endpoints.giveaways, async (endpoint) => {
      const requestParams = endpoint.includes('/wp-json/') ? buildWpPostParams(params) : buildLegacyGiveawayParams(params);
      const { data } = await apiClient.get<ApiGiveawayListResponse>(endpoint, { params: requestParams });
      const mapped = extractList(data, ['giveaways', 'items', 'entries', 'data']).map(mapGiveaway);
      return uniqueById(mapped);
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
  const cacheKey = CACHE_KEYS.giveawayDetail(idOrSlug);

  try {
    const detail = await tryEndpoints(ENV.endpoints.giveawayDetail, async (endpoint) => {
      const target = endpoint
        .replace('{idOrSlug}', endpoint.includes('/wp-json/') ? parseWpDetailId(idOrSlug) : encodeURIComponent(idOrSlug))
        .replace(/\/{2,}/g, '/');
      const { data } = await apiClient.get<ApiGiveawayDetailResponse>(target);
      const extracted = extractDetail(data);
      const wpSlugResult = Array.isArray(extracted) ? extracted[0] : extracted;
      return mapGiveaway(wpSlugResult);
    });

    await setCache(cacheKey, detail, { ttlMs: CACHE_TTL.giveawayDetail });
    return detail;
  } catch (err) {
    return fallbackCache<Giveaway>(cacheKey, err);
  }
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    const list = await tryEndpoints(ENV.endpoints.categories, async (endpoint) => {
      const requestParams = endpoint.includes('/wp-json/') ? { per_page: 100 } : undefined;
      const { data } = await apiClient.get<ApiCategoryListResponse>(endpoint, { params: requestParams });
      return uniqueById(extractList(data, ['categories', 'items', 'data']).map(mapCategory));
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
      const requestParams = endpoint.includes('/wp-json/') ? buildWpTop10Params() : undefined;
      const { data } = await apiClient.get<ApiTopListResponse>(endpoint, { params: requestParams });
      const mapped = extractList(data, ['top10', 'items', 'data']).map((item, index) => mapTopItem(item, index));
      return mapped.sort((left, right) => left.rank - right.rank);
    });

    await setCache(CACHE_KEYS.top10, list, { ttlMs: CACHE_TTL.top10 });
    return list;
  } catch (err) {
    return fallbackCache<TopItem[]>(CACHE_KEYS.top10, err);
  }
}
