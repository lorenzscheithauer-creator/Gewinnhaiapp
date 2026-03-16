import { AxiosError } from 'axios';

import { apiClient } from './client';
import { ApiCategoryListResponse, ApiGiveawayDetailResponse, ApiGiveawayListResponse, ApiTopListResponse } from '../types/api';
import { Category, Giveaway, SearchParams, TopItem } from '../types/models';
import { getCache, setCache } from '../utils/cache';
import { extractDetail, extractList, mapCategory, mapGiveaway, mapTopItem } from './mappers';

const CACHE_KEYS = {
  giveaways: 'cache:giveaways',
  categories: 'cache:categories',
  top10: 'cache:top10',
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
  const cached = await getCache<T>(cacheKey);
  if (cached) return cached;
  throw new Error(getErrorMessage(err));
}

function buildGiveawayParams(params?: SearchParams): Record<string, string> | undefined {
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

export async function fetchGiveaways(params?: SearchParams): Promise<Giveaway[]> {
  const cacheKey = createCacheKey(CACHE_KEYS.giveaways, params);

  try {
    const { data } = await apiClient.get<ApiGiveawayListResponse>('/giveaways', { params: buildGiveawayParams(params) });
    const list = extractList(data, ['giveaways', 'items', 'entries', 'data']).map(mapGiveaway);
    await setCache(cacheKey, list);
    return list;
  } catch (err) {
    return fallbackCache<Giveaway[]>(cacheKey, err);
  }
}

export async function fetchGiveawayDetail(idOrSlug: string): Promise<Giveaway> {
  const cacheKey = CACHE_KEYS.giveawayDetail(idOrSlug);

  try {
    const { data } = await apiClient.get<ApiGiveawayDetailResponse>(`/giveaways/${idOrSlug}`);
    const detail = mapGiveaway(extractDetail(data));
    await setCache(cacheKey, detail);
    return detail;
  } catch (err) {
    return fallbackCache<Giveaway>(cacheKey, err);
  }
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    const { data } = await apiClient.get<ApiCategoryListResponse>('/categories');
    const list = extractList(data, ['categories', 'items', 'data']).map(mapCategory);
    await setCache(CACHE_KEYS.categories, list);
    return list;
  } catch (err) {
    return fallbackCache<Category[]>(CACHE_KEYS.categories, err);
  }
}

export async function fetchTop10(): Promise<TopItem[]> {
  try {
    const { data } = await apiClient.get<ApiTopListResponse>('/top10');
    const list = extractList(data, ['top10', 'items', 'data']).map((item, index) => mapTopItem(item, index));
    await setCache(CACHE_KEYS.top10, list);
    return list;
  } catch (err) {
    return fallbackCache<TopItem[]>(CACHE_KEYS.top10, err);
  }
}
