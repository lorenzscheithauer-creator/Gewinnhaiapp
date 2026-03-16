import axios, { AxiosError, AxiosRequestConfig } from 'axios';

import { ENV } from '../config/env';

const RETRY_ATTEMPTS = 2;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

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
    'X-Requested-With': 'XMLHttpRequest'
  },
  transformResponse: [...transformResponse, (data) => tryParseJsonPayload(data)]
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as AxiosRequestConfig & { __retryCount?: number };

    if (config && canRetry(error)) {
      config.__retryCount = config.__retryCount ?? 0;
      if (config.__retryCount < RETRY_ATTEMPTS) {
        config.__retryCount += 1;
        await sleep(300 * config.__retryCount);
        return apiClient.request(config);
      }
    }

    if (error.response?.status === 404) {
      error.message = 'Eintrag nicht gefunden.';
    }

    return Promise.reject(error);
  }
);
