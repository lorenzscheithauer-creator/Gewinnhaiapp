import { useQuery } from '@tanstack/react-query';

import { giveawaysRepository } from '../data/giveawaysRepository';
import { ENV } from '../config/env';

export function useGiveawayDetail(idOrSlug: string) {
  return useQuery({
    queryKey: ['giveaway-detail', idOrSlug],
    queryFn: () => giveawaysRepository.detail(idOrSlug),
    enabled: Boolean(idOrSlug),
    staleTime: ENV.query.detailStaleMs,
    gcTime: ENV.query.detailGcMs,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
    networkMode: 'offlineFirst'
  });
}
