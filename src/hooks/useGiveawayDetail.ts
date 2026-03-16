import { useQuery } from '@tanstack/react-query';

import { giveawaysRepository } from '../data/giveawaysRepository';
import { ENV } from '../config/env';

export function useGiveawayDetail(idOrSlug: string) {
  const normalized = idOrSlug.trim();

  return useQuery({
    queryKey: ['giveaway-detail', normalized],
    queryFn: () => giveawaysRepository.detail(normalized),
    enabled: Boolean(normalized),
    staleTime: ENV.query.detailStaleMs,
    gcTime: ENV.query.detailGcMs,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
    networkMode: 'offlineFirst'
  });
}
