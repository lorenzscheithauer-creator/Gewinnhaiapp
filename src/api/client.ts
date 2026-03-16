import axios, { AxiosError, AxiosRequestConfig } from 'axios';

import { ENV } from '../config/env';

const RETRY_ATTEMPTS = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 GewinnhaiApp/1.0';

function tryParseJsonPayload(data: unknown): unknown {
  if (typeof data !== 'string') return data;

  const trimmed = data.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
    return data;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return data;
  }
}

function canRetry(error: AxiosError): boolean {
  if (!error.config) return false;
  if (error.code === 'ECONNABORTED') return true;
  if (!error.response) return true;
  return RETRYABLE_STATUS_CODES.has(error.response.status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enrichHttpError(error: AxiosError): AxiosError {
  const status = error.response?.status;
  const payload = error.response?.data;
  const payloadIsHtml = typeof payload === 'string' && payload.toLowerCase().includes('<html');

  if (!error.response) {
    error.message = 'Netzwerkfehler: GewinnHai ist aktuell nicht erreichbar.';
  } else if (status === 404) {
    error.message = 'Eintrag nicht gefunden.';
  } else if (status === 403) {
    error.message = 'Zugriff abgelehnt (403). Bitte später erneut versuchen.';
  } else if (status === 429) {
    error.message = 'Zu viele Anfragen. Bitte kurz warten und erneut versuchen.';
  } else if (status && status >= 500) {
    error.message = 'GewinnHai-Serverfehler. Bitte später erneut versuchen.';
  }

  if (payloadIsHtml && !error.message.toLowerCase().includes('server')) {
    error.message = 'Unerwartete Antwort vom Server erhalten. Bitte später erneut versuchen.';
  }

  return error;
}

const defaultTransformResponse = axios.defaults.transformResponse;
const transformResponse = Array.isArray(defaultTransformResponse)
  ? defaultTransformResponse
  : defaultTransformResponse
    ? [defaultTransformResponse]
    : [];

export const apiClient = axios.create({
  baseURL: ENV.apiBaseUrl,
  timeout: ENV.apiTimeoutMs,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': DEFAULT_USER_AGENT,
    Referer: 'https://www.gewinnhai.de/',
    Origin: 'https://www.gewinnhai.de'
  },
  transformResponse: [...transformResponse, (data) => tryParseJsonPayload(data)]
});

apiClient.interceptors.response.use(
  (response) => {
    const data = response.data;

    if (typeof data === 'string' && data.toLowerCase().includes('<html')) {
      return Promise.reject(
        enrichHttpError(
          new AxiosError('Unerwartete HTML-Antwort vom Server erhalten.', 'ERR_BAD_RESPONSE', response.config, response.request, {
            ...response,
            data
          })
        )
      );
    }

    return response;
  },
  async (rawError: AxiosError) => {
    const error = enrichHttpError(rawError);
    const config = error.config as AxiosRequestConfig & { __retryCount?: number };

    if (config && canRetry(error)) {
      config.__retryCount = config.__retryCount ?? 0;
      if (config.__retryCount < RETRY_ATTEMPTS) {
        config.__retryCount += 1;
        await sleep(400 * config.__retryCount);
        return apiClient.request(config);
      }
    }

    return Promise.reject(error);
  }
);
