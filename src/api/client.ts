import axios, { AxiosError, AxiosRequestConfig } from 'axios';

import { ENV } from '../config/env';
import { toAppError } from '../utils/errors';

const RETRY_ATTEMPTS = 1;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

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

  if (!error.response) {
    error.message = 'Die GewinnHai-PHP-API ist aktuell nicht erreichbar.';
  } else if (status === 404) {
    error.message = 'Der angeforderte PHP-Endpunkt wurde nicht gefunden.';
  } else if (status === 400) {
    error.message = 'Die Anfrage an die GewinnHai-PHP-API war ungültig.';
  } else if (status && status >= 500) {
    error.message = 'Die GewinnHai-PHP-API meldet einen Serverfehler.';
  }

  return error;
}

export const apiClient = axios.create({
  baseURL: ENV.apiBaseUrl,
  timeout: ENV.apiTimeoutMs,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.response.use(
  (response) => response,
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

    return Promise.reject(toAppError(error));
  }
);
