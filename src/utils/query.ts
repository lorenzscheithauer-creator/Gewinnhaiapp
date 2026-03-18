import { useFocusEffect } from '@react-navigation/native';
import { isAxiosError } from 'axios';
import { useCallback, useRef } from 'react';
import { getSafeErrorDetails } from './error';

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
  const safeError = getSafeErrorDetails(error);
  const fallbackMessage = safeError.message || 'Unerwarteter Fehler beim Laden der Daten.';
  const normalizedMessage = fallbackMessage.toLowerCase();

  if (!isNavigatorOnline()) {
    return {
      kind: 'offline',
      title: 'Du bist gerade offline',
      message: 'Bitte prüfe deine Internetverbindung. Sobald du wieder online bist, kann die App wieder echte GewinnHai-Daten laden.'
    };
  }

  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') {
      return {
        kind: 'timeout',
        title: 'PHP-API antwortet nicht rechtzeitig',
        message: 'Der angefragte GewinnHai-PHP-Endpunkt hat das Zeitlimit überschritten. Bitte gleich erneut versuchen.'
      };
    }

    if (error.response) {
      if (error.response.status === 404) {
        return {
          kind: 'api_not_found',
          title: 'PHP-Endpunkt nicht gefunden (404)',
          message: 'Der angefragte PHP-Endpunkt ist serverseitig nicht vorhanden.'
        };
      }

      return {
        kind: 'api_error',
        title: `PHP-API-Fehler: ${error.response.status}`,
        message: fallbackMessage
      };
    }

    if (normalizedMessage.includes('network error') || normalizedMessage.includes('failed to fetch') || normalizedMessage.includes('err_network')) {
      return {
        kind: 'api_unreachable',
        title: 'PHP-API aktuell nicht erreichbar',
        message: 'Die Anfrage an die echten /api/*.php-Endpunkte konnte das Gerät nicht erreichen.'
      };
    }

    return {
      kind: 'api_unreachable',
      title: 'PHP-API aktuell nicht erreichbar',
      message: fallbackMessage
    };
  }

  if (normalizedMessage.includes('404') || normalizedMessage.includes('endpunkt wurde nicht gefunden')) {
    return {
      kind: 'api_not_found',
      title: 'PHP-Endpunkt nicht gefunden (404)',
      message: 'Der angefragte PHP-Endpunkt ist serverseitig nicht vorhanden.'
    };
  }

  if (normalizedMessage.includes('zeitlimit') || normalizedMessage.includes('timeout') || normalizedMessage.includes('zeitüberschreitung')) {
    return {
      kind: 'timeout',
      title: 'PHP-API antwortet nicht rechtzeitig',
      message: 'Die Anfrage an die GewinnHai-PHP-API hat das Zeitlimit überschritten.'
    };
  }

  if (
    normalizedMessage.includes('keine gewinnspiele geliefert') ||
    normalizedMessage.includes('keine kategorien geliefert') ||
    normalizedMessage.includes('keine top10-daten geliefert') ||
    normalizedMessage.includes('keine home-daten geliefert')
  ) {
    return {
      kind: 'empty_data',
      title: 'Keine Daten vorhanden',
      message: 'Die PHP-API war erreichbar, hat aber aktuell keine verwertbaren Daten zurückgegeben.'
    };
  }

  if (normalizedMessage.includes('ungültige php-api-antwort') || normalizedMessage.includes('ungültige serverantwort')) {
    return {
      kind: 'invalid_response',
      title: 'Ungültige PHP-API-Antwort',
      message: 'Die Antwort von den echten PHP-Endpunkten konnte nicht zuverlässig verarbeitet werden.'
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
