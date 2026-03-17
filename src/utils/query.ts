import { useFocusEffect } from '@react-navigation/native';
import { isAxiosError } from 'axios';
import { useCallback, useRef } from 'react';

export type QueryErrorKind =
  | 'offline'
  | 'timeout'
  | 'api_not_found'
  | 'api_unreachable'
  | 'invalid_response'
  | 'empty_data'
  | 'api_error'
  | 'cors'
  | 'unknown';

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
  const normalizedMessage = fallbackMessage.toLowerCase();

  if (!isNavigatorOnline()) {
    return {
      kind: 'offline',
      title: 'Du bist gerade offline',
      message: 'Bitte prüfe deine Internetverbindung. Sobald du wieder online bist, laden wir neue Gewinnspiele.'
    };
  }

  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') {
      return {
        kind: 'timeout',
        title: 'Server antwortet nicht rechtzeitig',
        message: 'GewinnHai ist erreichbar, aber der Request lief in ein Timeout. Bitte gleich erneut versuchen.'
      };
    }

    if (error.response) {
      if (error.response.status === 404) {
        return {
          kind: 'api_not_found',
          title: 'API-Endpunkt nicht gefunden (404)',
          message: 'Die angeforderte Datenquelle existiert auf dem Server nicht. Bitte später erneut versuchen.'
        };
      }

      return {
        kind: 'api_error',
        title: `Serverantwort: ${error.response.status}`,
        message: fallbackMessage
      };
    }

    if (normalizedMessage.includes('network error') || normalizedMessage.includes('failed to fetch') || normalizedMessage.includes('err_network')) {
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

  if (normalizedMessage.includes('404') || normalizedMessage.includes('nicht gefunden')) {
    return {
      kind: 'api_not_found',
      title: 'API-Endpunkt nicht gefunden (404)',
      message: 'Die angeforderte Datenquelle existiert auf dem Server nicht. Bitte später erneut versuchen.'
    };
  }

  if (normalizedMessage.includes('zeitüberschreitung') || normalizedMessage.includes('timeout')) {
    return {
      kind: 'timeout',
      title: 'Server antwortet nicht rechtzeitig',
      message: 'Der Server hat nicht rechtzeitig geantwortet. Bitte gleich erneut versuchen.'
    };
  }

  if (normalizedMessage.includes('keine verwertbaren') || normalizedMessage.includes('keine daten') || normalizedMessage.includes('leer')) {
    return {
      kind: 'empty_data',
      title: 'Keine Daten gefunden',
      message: 'Der Server hat geantwortet, aber aktuell keine passenden Inhalte geliefert.'
    };
  }

  if (
    normalizedMessage.includes('unerwartete antwort') ||
    normalizedMessage.includes('ungültige detaildaten') ||
    normalizedMessage.includes('kein gültigen ziel-link')
  ) {
    return {
      kind: 'invalid_response',
      title: 'Ungültige Serverantwort',
      message: 'Die Antwort vom Server konnte nicht zuverlässig verarbeitet werden.'
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
