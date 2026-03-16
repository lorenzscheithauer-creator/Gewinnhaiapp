import { useQuery } from '@tanstack/react-query';

import { fetchCategories, fetchGiveaways, fetchTop10 } from '../api/giveaways';
import { SearchParams } from '../types/models';

const BACKGROUND_REFRESH_MS = 5 * 60_000;

export function useGiveaways(params?: SearchParams) {
  return useQuery({
    queryKey: ['giveaways', params],
    queryFn: () => fetchGiveaways(params),
    staleTime: 2 * 60_000,
    gcTime: 45 * 60_000,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    refetchInterval: params?.query ? false : BACKGROUND_REFRESH_MS,
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
    networkMode: 'online'
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 20 * 60_000,
    gcTime: 2 * 60 * 60_000,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 60_000,
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
    networkMode: 'online'
  });
}

export function useTop10() {
  return useQuery({
    queryKey: ['top10'],
    queryFn: fetchTop10,
    staleTime: 10 * 60_000,
    gcTime: 45 * 60_000,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    refetchInterval: BACKGROUND_REFRESH_MS,
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
    networkMode: 'online'
  });
}
