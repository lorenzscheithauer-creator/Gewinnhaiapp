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
      message: 'Bitte prüfe deine Internetverbindung. Sobald du wieder online bist, kann die App-API neue Daten laden.'
    };
  }

  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') {
      return {
        kind: 'timeout',
        title: 'App-API antwortet nicht rechtzeitig',
        message: 'Der dedizierte API-Server hat das Zeitlimit überschritten. Bitte gleich erneut versuchen.'
      };
    }

    if (error.response) {
      if (error.response.status === 404) {
        return {
          kind: 'api_not_found',
          title: 'App-API-Endpunkt nicht gefunden (404)',
          message: 'Der erwartete API-Endpunkt ist serverseitig nicht vorhanden oder noch nicht deployed.'
        };
      }

      return {
        kind: 'api_error',
        title: `App-API-Serverfehler: ${error.response.status}`,
        message: fallbackMessage
      };
    }

    if (normalizedMessage.includes('network error') || normalizedMessage.includes('failed to fetch') || normalizedMessage.includes('err_network')) {
      return {
        kind: 'cors',
        title: 'App-API-Verbindung blockiert',
        message: 'Die Anfrage an die dedizierte App-API wurde blockiert oder vom Gateway nicht durchgelassen.'
      };
    }

    return {
      kind: 'api_unreachable',
      title: 'App-API aktuell nicht erreichbar',
      message: fallbackMessage
    };
  }

  if (normalizedMessage.includes('404') || normalizedMessage.includes('endpunkt wurde nicht gefunden')) {
    return {
      kind: 'api_not_found',
      title: 'App-API-Endpunkt nicht gefunden (404)',
      message: 'Der erwartete API-Endpunkt ist serverseitig nicht vorhanden oder noch nicht deployed.'
    };
  }

  if (normalizedMessage.includes('zeitlimit') || normalizedMessage.includes('timeout') || normalizedMessage.includes('zeitüberschreitung')) {
    return {
      kind: 'timeout',
      title: 'App-API antwortet nicht rechtzeitig',
      message: 'Der dedizierte API-Server hat nicht rechtzeitig geantwortet.'
    };
  }

  if (normalizedMessage.includes('keine gewinnspiele geliefert') || normalizedMessage.includes('keine kategorien geliefert') || normalizedMessage.includes('keine top10-daten geliefert')) {
    return {
      kind: 'empty_data',
      title: 'Keine App-Daten vorhanden',
      message: 'Die App-API war erreichbar, hat aber aktuell keine verwertbaren Daten zurückgegeben.'
    };
  }

  if (normalizedMessage.includes('ungültige app-api-antwort')) {
    return {
      kind: 'invalid_response',
      title: 'Ungültige App-API-Antwort',
      message: 'Die Antwort vom dedizierten API-Server konnte nicht zuverlässig verarbeitet werden.'
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
