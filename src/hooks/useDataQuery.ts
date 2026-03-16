import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

interface UseDataQueryOptions<TData> {
  queryKey: readonly unknown[];
  queryFn: () => Promise<TData>;
  staleTime: number;
  gcTime: number;
  refetchInterval?: number | false;
  enabled?: boolean;
  backgroundRefreshWhenSearching?: boolean;
}

const DEFAULT_BACKGROUND_REFRESH_MS = 5 * 60_000;

export function useDataQuery<TData>(options: UseDataQueryOptions<TData>) {
  const queryKey = useMemo(() => options.queryKey, [options.queryKey]);

  return useQuery({
    queryKey,
    queryFn: options.queryFn,
    enabled: options.enabled ?? true,
    staleTime: options.staleTime,
    gcTime: options.gcTime,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    refetchInterval: options.refetchInterval ?? DEFAULT_BACKGROUND_REFRESH_MS,
    refetchIntervalInBackground: false,
    placeholderData: (previousData) => previousData,
    networkMode: 'offlineFirst'
  });
}
