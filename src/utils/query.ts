import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';

export function isOfflineError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('keine verbindung');
}

interface RefetchOnFocusOptions {
  minIntervalMs?: number;
}

export function useRefetchOnFocus(refetch: () => Promise<unknown>, options?: RefetchOnFocusOptions): void {
  const lastRefetchAtRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const minIntervalMs = options?.minIntervalMs ?? 20_000;

      if (now - lastRefetchAtRef.current < minIntervalMs) {
        return;
      }

      lastRefetchAtRef.current = now;
      void refetch();
    }, [options?.minIntervalMs, refetch])
  );
}
