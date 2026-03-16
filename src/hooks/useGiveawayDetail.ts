import { useQuery } from '@tanstack/react-query';

import { fetchGiveawayDetail } from '../api/giveaways';

export function useGiveawayDetail(idOrSlug: string) {
  return useQuery({
    queryKey: ['giveaway-detail', idOrSlug],
    queryFn: () => fetchGiveawayDetail(idOrSlug),
    enabled: Boolean(idOrSlug),
    staleTime: 2 * 60_000,
    gcTime: 45 * 60_000,
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
    networkMode: 'online'
  });
}
