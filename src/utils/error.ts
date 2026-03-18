import { isAxiosError } from 'axios';

export interface SafeErrorDetails {
  name: string;
  message: string;
  code?: string;
  status?: number;
  endpoint?: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}

function buildEndpoint(baseUrl: unknown, url: unknown): string | undefined {
  const safeBaseUrl = asString(baseUrl);
  const safeUrl = asString(url);

  if (safeBaseUrl && safeUrl && !/^https?:\/\//i.test(safeUrl)) {
    return `${safeBaseUrl.replace(/\/+$/, '')}/${safeUrl.replace(/^\/+/, '')}`;
  }

  return safeUrl ?? safeBaseUrl;
}

export function getSafeErrorDetails(error: unknown): SafeErrorDetails {
  if (isAxiosError(error)) {
    const responseData = asRecord(error.response?.data);
    const apiMessage = asString(responseData?.message);

    return {
      name: error.name || 'AxiosError',
      message: apiMessage || error.message || 'Unbekannter Netzwerkfehler.',
      code: asString(error.code),
      status: typeof error.response?.status === 'number' ? error.response.status : undefined,
      endpoint: buildEndpoint(error.config?.baseURL, error.config?.url)
    };
  }

  if (error instanceof Error) {
    const record = error as Error & { code?: string; status?: number; endpoint?: string };
    return {
      name: error.name || 'Error',
      message: error.message || 'Unbekannter Fehler.',
      code: asString(record.code),
      status: typeof record.status === 'number' ? record.status : undefined,
      endpoint: asString(record.endpoint)
    };
  }

  return {
    name: 'UnknownError',
    message: asString(error) || 'Unbekannter Fehler.'
  };
}

export function toAppError(error: unknown): Error {
  const details = getSafeErrorDetails(error);
  const normalized = new Error(details.message);
  normalized.name = details.name;

  const target = normalized as Error & {
    code?: string;
    status?: number;
    endpoint?: string;
  };

  target.code = details.code;
  target.status = details.status;
  target.endpoint = details.endpoint;

  return normalized;
}
