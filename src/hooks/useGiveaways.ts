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

export function useGiveaways(params?: SearchParams, options?: UseGiveawaysOptions) {
  const normalizedParams = useMemo(() => normalizeSearchParams(params), [params?.categoryId, params?.categorySlug, params?.query]);

  return useDataQuery({
    queryKey: ['giveaways', normalizedParams],
    queryFn: () => giveawaysRepository.list(normalizedParams),
    enabled: options?.enabled ?? true,
    staleTime: ENV.query.listStaleMs,
    gcTime: ENV.query.listGcMs,
    refetchInterval: normalizedParams?.query ? false : BACKGROUND_REFRESH_MS
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
