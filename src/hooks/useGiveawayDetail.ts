import { useQuery } from '@tanstack/react-query';

import { fetchGiveawayDetail } from '../api/giveaways';

export function useGiveawayDetail(idOrSlug: string) {
  return useQuery({
    queryKey: ['giveaway-detail', idOrSlug],
    queryFn: () => fetchGiveawayDetail(idOrSlug)
  });
}
