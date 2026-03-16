import Constants from 'expo-constants';

const extras = (Constants.expoConfig?.extra ?? {}) as {
  apiBaseUrl?: string;
  apiTimeoutMs?: number;
};

export const ENV = {
  apiBaseUrl: extras.apiBaseUrl ?? 'https://www.gewinnhai.de/api',
  apiTimeoutMs: extras.apiTimeoutMs ?? 10000
};
