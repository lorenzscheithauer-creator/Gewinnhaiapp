import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';

const OFFLINE_MARKERS = ['keine verbindung', 'netzwerkfehler', 'offline', 'network error', 'timeout', 'zeitüberschreitung'];

export function isOfflineError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return OFFLINE_MARKERS.some((marker) => message.includes(marker));
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
