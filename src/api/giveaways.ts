import { AxiosError } from 'axios';

import { apiClient } from './client';
import { ApiCategoryResponse, ApiGiveawayDetailResponse, ApiGiveawayResponse, ApiTopResponse } from '../types/api';
import { Category, Giveaway, SearchParams, TopItem } from '../types/models';
import { getCache, setCache } from '../utils/cache';

const CACHE_KEYS = {
  giveaways: 'cache:giveaways',
  categories: 'cache:categories',
  top10: 'cache:top10'
};

async function fallbackCache<T>(cacheKey: string, err: unknown): Promise<T> {
  const cached = await getCache<T>(cacheKey);
  if (cached) return cached;

  if (err instanceof AxiosError) {
    throw new Error(err.response?.data?.message ?? 'Netzwerkfehler. Bitte später erneut versuchen.');
  }
  throw err;
}

export async function fetchGiveaways(params?: SearchParams): Promise<Giveaway[]> {
  try {
    const { data } = await apiClient.get<ApiGiveawayResponse>('/giveaways', { params });
    await setCache(CACHE_KEYS.giveaways, data.data);
    return data.data;
  } catch (err) {
    return fallbackCache<Giveaway[]>(CACHE_KEYS.giveaways, err);
  }
}

export async function fetchGiveawayDetail(idOrSlug: string): Promise<Giveaway> {
  const { data } = await apiClient.get<ApiGiveawayDetailResponse>(`/giveaways/${idOrSlug}`);
  return data.data;
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    const { data } = await apiClient.get<ApiCategoryResponse>('/categories');
    await setCache(CACHE_KEYS.categories, data.data);
    return data.data;
  } catch (err) {
    return fallbackCache<Category[]>(CACHE_KEYS.categories, err);
  }
}

export async function fetchTop10(): Promise<TopItem[]> {
  try {
    const { data } = await apiClient.get<ApiTopResponse>('/top10');
    await setCache(CACHE_KEYS.top10, data.data);
    return data.data;
  } catch (err) {
    return fallbackCache<TopItem[]>(CACHE_KEYS.top10, err);
  }
}
