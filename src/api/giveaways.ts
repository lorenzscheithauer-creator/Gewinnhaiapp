import { AxiosError } from 'axios';

import { apiClient } from './client';
import {
  ApiCategoryListResponse,
  ApiGiveawayDetailResponse,
  ApiGiveawayListResponse,
  ApiTopListResponse
} from '../types/api';
import { Category, Giveaway, SearchParams, TopItem } from '../types/models';
import { getCache, setCache } from '../utils/cache';
import { extractDetail, extractList, mapCategory, mapGiveaway, mapTopItem } from './mappers';

const CACHE_KEYS = {
  giveaways: 'cache:giveaways',
  categories: 'cache:categories',
  top10: 'cache:top10'
};

function getErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const apiMessage =
      (typeof err.response?.data === 'object' &&
        err.response?.data &&
        'message' in (err.response.data as Record<string, unknown>) &&
        typeof (err.response.data as Record<string, unknown>).message === 'string' &&
        (err.response.data as Record<string, unknown>).message) ||
      undefined;

    return apiMessage ?? 'Netzwerkfehler. Bitte später erneut versuchen.';
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

function parseListEnvelope(data: { data?: unknown; result?: unknown; items?: unknown }, nestedKeys: string[]): unknown[] {
  const candidate = data.data ?? data.result ?? data.items;
  return extractList(candidate, nestedKeys);
}

export async function fetchGiveaways(params?: SearchParams): Promise<Giveaway[]> {
  try {
    const { data } = await apiClient.get<ApiGiveawayListResponse>('/giveaways', { params });
    const list = parseListEnvelope(data, ['giveaways', 'items']).map(mapGiveaway);
    await setCache(CACHE_KEYS.giveaways, list);
    return list;
  } catch (err) {
    return fallbackCache<Giveaway[]>(CACHE_KEYS.giveaways, err);
  }
}

export async function fetchGiveawayDetail(idOrSlug: string): Promise<Giveaway> {
  const { data } = await apiClient.get<ApiGiveawayDetailResponse>(`/giveaways/${idOrSlug}`);
  const detail = extractDetail(data.data ?? data.result ?? data.items);
  return mapGiveaway(detail);
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    const { data } = await apiClient.get<ApiCategoryListResponse>('/categories');
    const list = parseListEnvelope(data, ['categories', 'items']).map(mapCategory);
    await setCache(CACHE_KEYS.categories, list);
    return list;
  } catch (err) {
    return fallbackCache<Category[]>(CACHE_KEYS.categories, err);
  }
}

export async function fetchTop10(): Promise<TopItem[]> {
  try {
    const { data } = await apiClient.get<ApiTopListResponse>('/top10');
    const list = parseListEnvelope(data, ['top10', 'items']).map((item, index) => mapTopItem(item, index));
    await setCache(CACHE_KEYS.top10, list);
    return list;
  } catch (err) {
    return fallbackCache<TopItem[]>(CACHE_KEYS.top10, err);
  }
}
