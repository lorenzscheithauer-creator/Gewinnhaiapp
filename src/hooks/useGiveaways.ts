import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { giveawaysRepository } from '../data/giveawaysRepository';
import { ENV } from '../config/env';
import { SearchParams } from '../types/models';

const BACKGROUND_REFRESH_MS = 5 * 60_000;

function normalizeSearchParams(params?: SearchParams): SearchParams | undefined {
  if (!params) return undefined;

  const query = params.query?.trim();
  const categoryId = params.categoryId?.trim();
  const categorySlug = params.categorySlug?.trim().toLowerCase();

  return {
    query: query && query.length >= 2 ? query : undefined,
    categoryId: categoryId || undefined,
    categorySlug: categorySlug || undefined
  };
}

interface UseGiveawaysOptions {
  enabled?: boolean;
}

export function useGiveaways(params?: SearchParams, options?: UseGiveawaysOptions) {
  const normalizedParams = useMemo(() => normalizeSearchParams(params), [params?.categoryId, params?.categorySlug, params?.query]);

  return useQuery({
    queryKey: ['giveaways', normalizedParams],
    queryFn: () => giveawaysRepository.list(normalizedParams),
    enabled: options?.enabled ?? true,
    staleTime: ENV.query.listStaleMs,
    gcTime: ENV.query.listGcMs,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    refetchInterval: normalizedParams?.query ? false : BACKGROUND_REFRESH_MS,
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
    networkMode: 'offlineFirst'
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: giveawaysRepository.categories,
    staleTime: 20 * 60_000,
    gcTime: 2 * 60 * 60_000,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 60_000,
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
    networkMode: 'offlineFirst'
  });
}

export function useTop10() {
  return useQuery({
    queryKey: ['top10'],
    queryFn: giveawaysRepository.top10,
    staleTime: 10 * 60_000,
    gcTime: ENV.query.listGcMs,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    refetchInterval: BACKGROUND_REFRESH_MS,
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
    networkMode: 'offlineFirst'
  });
}
