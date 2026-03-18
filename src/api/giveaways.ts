import { AxiosError } from 'axios';

import { apiClient } from './client';
import {
  ApiCategoryListResponse,
  ApiGiveawayDetailResponse,
  ApiGiveawayListResponse,
  ApiSearchResponse,
  ApiTopListResponse
} from '../types/api';
import { Category, Giveaway, SearchParams, TopItem } from '../types/models';
import { getCache, setCache } from '../utils/cache';
import { ENV } from '../config/env';

const CACHE_TTL = {
  giveaways: 10 * 60_000,
  categories: 24 * 60 * 60_000,
  top10: 15 * 60_000,
  giveawayDetail: 30 * 60_000,
  search: 5 * 60_000
};

const CACHE_KEYS = {
  giveaways: (params?: SearchParams) => `cache:giveaways:${JSON.stringify(params ?? {})}`,
  categories: 'cache:categories',
  top10: 'cache:top10',
  search: (params: SearchParams) => `cache:search:${JSON.stringify({ query: params.query?.trim().toLowerCase(), categoryId: params.categoryId, categorySlug: params.categorySlug })}`,
  giveawayDetail: (idOrSlug: string) => `cache:giveaway-detail:${idOrSlug}`
};

function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    const apiData = error.response?.data as Record<string, unknown> | undefined;
    const apiMessage = typeof apiData?.message === 'string' ? apiData.message : undefined;

    if (apiMessage) return apiMessage;
    if (!error.response) return 'Die App-API ist aktuell nicht erreichbar.';
    if (error.response.status === 404) return 'Der angeforderte App-API-Endpunkt wurde nicht gefunden (404).';
    if (error.response.status >= 500) return 'Die App-API meldet einen Serverfehler.';
    return `App-API-Fehler (${error.response.status}).`;
  }

  return error instanceof Error ? error.message : 'Unbekannter App-API-Fehler.';
}

function validateArrayPayload<T>(payload: T[] | undefined, emptyMessage: string): T[] {
  if (!Array.isArray(payload)) {
    throw new Error('Ungültige App-API-Antwort erhalten.');
  }
  if (!payload.length) {
    throw new Error(emptyMessage);
  }
  return payload;
}

function validateObjectPayload<T>(payload: T | undefined): T {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Ungültige App-API-Antwort erhalten.');
  }
  return payload;
}

async function loadWithCache<T>(cacheKey: string, loader: () => Promise<T>): Promise<T> {
  try {
    const data = await loader();
    return data;
  } catch (error) {
    const fresh = await getCache<T>(cacheKey);
    if (fresh) return fresh;

    const stale = await getCache<T>(cacheKey, { allowExpired: true });
    if (stale) return stale;

    throw new Error(getApiErrorMessage(error));
  }
}

export async function fetchGiveaways(params?: SearchParams): Promise<Giveaway[]> {
  const normalizedParams = {
    categoryId: params?.categoryId?.trim() || undefined,
    categorySlug: params?.categorySlug?.trim() || undefined
  };
  const cacheKey = CACHE_KEYS.giveaways(normalizedParams);

  return loadWithCache(cacheKey, async () => {
    const { data } = await apiClient.get<ApiGiveawayListResponse>(ENV.endpoints.giveaways, {
      params: normalizedParams
    });
    const giveaways = validateArrayPayload(data.data, 'Die App-API hat keine Gewinnspiele geliefert.');
    await setCache(cacheKey, giveaways, { ttlMs: CACHE_TTL.giveaways });
    return giveaways;
  });
}

export async function fetchSearchGiveaways(params: SearchParams): Promise<Giveaway[]> {
  const trimmedQuery = params.query?.trim() ?? '';
  const cacheKey = CACHE_KEYS.search(params);

  return loadWithCache(cacheKey, async () => {
    const { data } = await apiClient.get<ApiSearchResponse>(ENV.endpoints.search, {
      params: { q: trimmedQuery, categoryId: params.categoryId, categorySlug: params.categorySlug }
    });
    const items = Array.isArray(data.data) ? data.data : [];
    await setCache(cacheKey, items, { ttlMs: CACHE_TTL.search });
    return items;
  });
}

export async function fetchGiveawayDetail(idOrSlug: string): Promise<Giveaway> {
  const normalized = idOrSlug.trim();
  const cacheKey = CACHE_KEYS.giveawayDetail(normalized);

  return loadWithCache(cacheKey, async () => {
    const endpoint = ENV.endpoints.giveawayDetail.replace('{idOrSlug}', encodeURIComponent(normalized));
    const { data } = await apiClient.get<ApiGiveawayDetailResponse>(endpoint);
    const detail = validateObjectPayload(data.data);
    await setCache(cacheKey, detail, { ttlMs: CACHE_TTL.giveawayDetail });
    return detail;
  });
}

export async function fetchCategories(): Promise<Category[]> {
  return loadWithCache(CACHE_KEYS.categories, async () => {
    const { data } = await apiClient.get<ApiCategoryListResponse>(ENV.endpoints.categories);
    const categories = validateArrayPayload(data.data, 'Die App-API hat keine Kategorien geliefert.');
    await setCache(CACHE_KEYS.categories, categories, { ttlMs: CACHE_TTL.categories });
    return categories;
  });
}

export async function fetchTop10(): Promise<TopItem[]> {
  return loadWithCache(CACHE_KEYS.top10, async () => {
    const { data } = await apiClient.get<ApiTopListResponse>(ENV.endpoints.top10);
    const top10 = validateArrayPayload(data.data, 'Die App-API hat keine Top10-Daten geliefert.');
    await setCache(CACHE_KEYS.top10, top10, { ttlMs: CACHE_TTL.top10 });
    return top10;
  });
}
