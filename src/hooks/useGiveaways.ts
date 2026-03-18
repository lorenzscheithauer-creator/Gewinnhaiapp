import { useMemo } from 'react';

import { giveawaysRepository } from '../data/giveawaysRepository';
import { ENV } from '../config/env';
import { SearchParams } from '../types/models';
import { normalizeSearchParams } from '../utils/searchParams';
import { useDataQuery } from './useDataQuery';

const BACKGROUND_REFRESH_MS = 5 * 60_000;

interface UseGiveawaysOptions {
  enabled?: boolean;
}

export function useHomeData() {
  return useDataQuery({
    queryKey: ['home'],
    queryFn: giveawaysRepository.home,
    staleTime: ENV.query.homeStaleMs,
    gcTime: ENV.query.homeGcMs,
    refetchInterval: BACKGROUND_REFRESH_MS
  });
}

export function useGiveaways(params?: SearchParams, options?: UseGiveawaysOptions) {
  const normalizedParams = useMemo(() => normalizeSearchParams(params), [params?.categoryId, params?.categorySlug, params?.query]);

  return useDataQuery({
    queryKey: ['giveaways', { categoryId: normalizedParams?.categoryId, categorySlug: normalizedParams?.categorySlug }],
    queryFn: () => giveawaysRepository.list(normalizedParams),
    enabled: options?.enabled ?? true,
    staleTime: ENV.query.listStaleMs,
    gcTime: ENV.query.listGcMs,
    refetchInterval: BACKGROUND_REFRESH_MS
  });
}

export function useSearchGiveaways(params: SearchParams, options?: UseGiveawaysOptions) {
  const normalizedParams = useMemo(() => normalizeSearchParams(params), [params?.categoryId, params?.categorySlug, params?.query]);
  const normalizedQuery = normalizedParams?.query?.trim() ?? '';

  return useDataQuery({
    queryKey: ['search', normalizedParams],
    queryFn: () => giveawaysRepository.search(normalizedParams ?? {}),
    enabled: (options?.enabled ?? true) && normalizedQuery.length >= 2,
    staleTime: 60_000,
    gcTime: ENV.query.listGcMs,
    refetchInterval: false
  });
}

export function useCategories() {
  return useDataQuery({
    queryKey: ['categories'],
    queryFn: giveawaysRepository.categories,
    staleTime: 20 * 60_000,
    gcTime: 2 * 60 * 60_000,
    refetchInterval: 60 * 60_000
  });
}

export function useTop10() {
  return useDataQuery({
    queryKey: ['top10'],
    queryFn: giveawaysRepository.top10,
    staleTime: 10 * 60_000,
    gcTime: ENV.query.listGcMs,
    refetchInterval: BACKGROUND_REFRESH_MS
  });
}
