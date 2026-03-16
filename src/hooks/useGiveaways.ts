import { useQuery } from '@tanstack/react-query';

import { fetchCategories, fetchGiveaways, fetchTop10 } from '../api/giveaways';
import { SearchParams } from '../types/models';

export function useGiveaways(params?: SearchParams) {
  return useQuery({
    queryKey: ['giveaways', params],
    queryFn: () => fetchGiveaways(params)
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories
  });
}

export function useTop10() {
  return useQuery({
    queryKey: ['top10'],
    queryFn: fetchTop10
  });
}
