import { AxiosError, isAxiosError } from 'axios';

export type AppErrorCode =
  | 'OFFLINE'
  | 'TIMEOUT'
  | 'NOT_FOUND'
  | 'HTTP_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'EMPTY_DATA'
  | 'UNKNOWN';

export interface AppErrorDetails {
  endpoint?: string;
  method?: string;
  status?: number;
  code?: string;
  retriable?: boolean;
  causeMessage?: string;
}

export class AppError extends Error {
  status?: number;
  code?: string;
  endpoint?: string;
  method?: string;
  retriable?: boolean;
  causeMessage?: string;

  constructor(message: string, details?: AppErrorDetails) {
    super(message);
    this.name = 'AppError';
    this.status = details?.status;
    this.code = details?.code;
    this.endpoint = details?.endpoint;
    this.method = details?.method;
    this.retriable = details?.retriable;
    this.causeMessage = details?.causeMessage;
  }
}

function getRequestDetails(error: AxiosError): AppErrorDetails {
  const endpoint = typeof error.config?.url === 'string' ? error.config.url : undefined;
  const method = typeof error.config?.method === 'string' ? error.config.method.toUpperCase() : undefined;

  return {
    endpoint,
    method,
    status: error.response?.status,
    code: error.code,
    retriable: !error.response || (error.response.status >= 500 && error.response.status < 600)
  };
}

export function toAppError(error: unknown, fallbackMessage = 'Unbekannter Fehler.'): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const details = getRequestDetails(axiosError);
    const apiData = axiosError.response?.data as Record<string, unknown> | undefined;
    const apiMessage = typeof apiData?.message === 'string' ? apiData.message.trim() : undefined;

    let message = apiMessage || axiosError.message || fallbackMessage;

    if (axiosError.code === 'ECONNABORTED') {
      message = 'Die GewinnHai-PHP-API hat das Zeitlimit überschritten.';
    } else if (!axiosError.response) {
      message = 'Die GewinnHai-PHP-API ist aktuell nicht erreichbar.';
    } else if (axiosError.response.status === 404) {
      message = 'Der angeforderte PHP-Endpunkt wurde nicht gefunden (404).';
    } else if (axiosError.response.status >= 500) {
      message = 'Die GewinnHai-PHP-API meldet einen Serverfehler.';
    } else if (!apiMessage && axiosError.response.status >= 400) {
      message = `PHP-API-Fehler (${axiosError.response.status}).`;
    }

    return new AppError(message, {
      ...details,
      causeMessage: axiosError.message
    });
  }

  if (error instanceof Error) {
    return new AppError(error.message || fallbackMessage, {
      code: error.name,
      causeMessage: error.message,
      retriable: false
    });
  }

  return new AppError(fallbackMessage, { retriable: false });
}

export function getSafeErrorContext(error: unknown): Record<string, string | number | boolean | undefined> {
  const normalized = toAppError(error);
  return {
    message: normalized.message,
    status: normalized.status,
    endpoint: normalized.endpoint,
    code: normalized.code,
    method: normalized.method,
    retriable: normalized.retriable
  };
}
