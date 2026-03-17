import { useFocusEffect } from '@react-navigation/native';
import { isAxiosError } from 'axios';
import { useCallback, useRef } from 'react';

export type QueryErrorKind = 'offline' | 'api_unreachable' | 'api_error' | 'cors' | 'unknown';

interface QueryErrorInfo {
  kind: QueryErrorKind;
  title: string;
  message: string;
}

function isNavigatorOnline(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') return true;
  return navigator.onLine;
}

export function classifyQueryError(error: unknown): QueryErrorInfo {
  const fallbackMessage = error instanceof Error ? error.message : 'Unerwarteter Fehler beim Laden der Daten.';

  if (!isNavigatorOnline()) {
    return {
      kind: 'offline',
      title: 'Du bist gerade offline',
      message: 'Bitte prüfe deine Internetverbindung. Sobald du wieder online bist, laden wir neue Gewinnspiele.'
    };
  }

  if (isAxiosError(error)) {
    if (error.response) {
      return {
        kind: 'api_error',
        title: `Serverantwort: ${error.response.status}`,
        message: fallbackMessage
      };
    }

    if (error.code === 'ECONNABORTED') {
      return {
        kind: 'api_unreachable',
        title: 'Server antwortet nicht rechtzeitig',
        message: 'GewinnHai ist erreichbar, aber der Request lief in ein Timeout. Bitte gleich erneut versuchen.'
      };
    }

    const msg = fallbackMessage.toLowerCase();
    if (msg.includes('network error') || msg.includes('failed to fetch') || msg.includes('err_network')) {
      return {
        kind: 'cors',
        title: 'Verbindung blockiert',
        message: 'Die Anfrage wurde im Web-Kontext blockiert (z. B. CORS oder Gateway). Bitte später erneut versuchen.'
      };
    }

    return {
      kind: 'api_unreachable',
      title: 'API aktuell nicht erreichbar',
      message: fallbackMessage
    };
  }

  return {
    kind: 'unknown',
    title: 'Fehler beim Laden',
    message: fallbackMessage
  };
}

interface RefetchOnFocusOptions {
  enabled?: boolean;
  minIntervalMs?: number;
}

async function refetchSafely(refetch: () => Promise<unknown>): Promise<void> {
  try {
    await refetch();
  } catch {
    // Query cache already keeps the error state.
  }
}

export function useRefetchOnFocus(refetch: () => Promise<unknown>, options?: RefetchOnFocusOptions): void {
  const lastRefetchAtRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (options?.enabled === false) {
        return;
      }

      const now = Date.now();
      const minIntervalMs = options?.minIntervalMs ?? 20_000;

      if (now - lastRefetchAtRef.current < minIntervalMs) {
        return;
      }

      lastRefetchAtRef.current = now;
      void refetchSafely(refetch);
    }, [options?.enabled, options?.minIntervalMs, refetch])
  );
}
