import { useQuery } from '@tanstack/react-query';

import { fetchGiveawayDetail } from '../api/giveaways';

export function useGiveawayDetail(idOrSlug: string) {
  return useQuery({
    queryKey: ['giveaway-detail', idOrSlug],
    queryFn: () => fetchGiveawayDetail(idOrSlug),
    enabled: Boolean(idOrSlug),
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnMount: true,
    refetchOnReconnect: true,
    placeholderData: (previousData) => previousData
  });
}
