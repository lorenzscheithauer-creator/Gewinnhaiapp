import axios from 'axios';

import { ENV } from '../config/env';

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
    'Content-Type': 'application/json'
  },
  transformResponse: [...transformResponse, (data) => tryParseJsonPayload(data)]
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 404) {
      error.message = 'Eintrag nicht gefunden.';
    }

    return Promise.reject(error);
  }
);
