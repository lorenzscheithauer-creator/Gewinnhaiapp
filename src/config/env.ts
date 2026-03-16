import Constants from 'expo-constants';

const extras = (Constants.expoConfig?.extra ?? {}) as {
  apiBaseUrl?: string;
  apiTimeoutMs?: number;
};

function withNoTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export const ENV = {
  apiBaseUrl: withNoTrailingSlash(extras.apiBaseUrl ?? 'https://www.gewinnhai.de/api'),
  apiTimeoutMs: extras.apiTimeoutMs ?? 10000
};
