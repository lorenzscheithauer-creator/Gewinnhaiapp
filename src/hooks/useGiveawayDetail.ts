import { ENV } from '../config/env';
import { giveawaysRepository } from '../data/giveawaysRepository';
import { useDataQuery } from './useDataQuery';

export function useGiveawayDetail(idOrSlug: string) {
  const normalized = idOrSlug.trim();

  return useDataQuery({
    queryKey: ['giveaway-detail', normalized],
    queryFn: () => giveawaysRepository.detail(normalized),
    enabled: Boolean(normalized),
    staleTime: ENV.query.detailStaleMs,
    gcTime: ENV.query.detailGcMs,
    refetchInterval: false
  });
}
