import { useQuery } from '@tanstack/react-query';

import { fetchCategories, fetchGiveaways, fetchTop10 } from '../api/giveaways';
import { SearchParams } from '../types/models';

export function useGiveaways(params?: SearchParams) {
  return useQuery({
    queryKey: ['giveaways', params],
    queryFn: () => fetchGiveaways(params),
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    placeholderData: (previousData) => previousData
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    placeholderData: (previousData) => previousData
  });
}

export function useTop10() {
  return useQuery({
    queryKey: ['top10'],
    queryFn: fetchTop10,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: (previousData) => previousData
  });
}
