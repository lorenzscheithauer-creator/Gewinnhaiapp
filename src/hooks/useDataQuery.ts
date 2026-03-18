import { useQuery } from '@tanstack/react-query';

interface UseDataQueryOptions<TData> {
  queryKey: readonly unknown[];
  queryFn: () => Promise<TData>;
  staleTime: number;
  gcTime: number;
  refetchInterval?: number | false;
  enabled?: boolean;
}

const DEFAULT_BACKGROUND_REFRESH_MS = 5 * 60_000;

export function useDataQuery<TData>(options: UseDataQueryOptions<TData>) {
  return useQuery({
    queryKey: options.queryKey,
    queryFn: options.queryFn,
    enabled: options.enabled ?? true,
    staleTime: options.staleTime,
    gcTime: options.gcTime,
    refetchOnMount: true,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    refetchInterval: options.refetchInterval ?? DEFAULT_BACKGROUND_REFRESH_MS,
    refetchIntervalInBackground: false,
    placeholderData: (previousData: TData | undefined) => previousData,
    networkMode: 'online'
  });
}
