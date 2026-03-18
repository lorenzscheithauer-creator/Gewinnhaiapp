import Constants from 'expo-constants';

const extras = (Constants.expoConfig?.extra ?? {}) as {
  apiBaseUrl?: string;
  apiTimeoutMs?: number;
  appEnv?: string;
};

function withNoTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function toSafeTimeoutMs(value: string | number | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(parsed, 3000), 30000);
}

const publicApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const publicApiTimeoutMs = process.env.EXPO_PUBLIC_API_TIMEOUT_MS;
const publicAppEnv = process.env.EXPO_PUBLIC_APP_ENV;

const appEnv = publicAppEnv || extras.appEnv || 'production';
const apiBaseUrl = withNoTrailingSlash(publicApiBaseUrl || extras.apiBaseUrl || 'https://www.gewinnhai.de');

export const ENV = {
  appEnv,
  isProduction: appEnv === 'production',
  apiBaseUrl,
  apiTimeoutMs: toSafeTimeoutMs(publicApiTimeoutMs || extras.apiTimeoutMs, 10000),
  endpoints: {
    home: '/api/home.php',
    list: '/api/list.php',
    item: '/api/item.php',
    top10: '/api/top10.php',
    top3: '/api/top3.php',
    stats: '/api/stats.php',
    newest: '/api/newest.php'
  },
  query: {
    listStaleMs: 2 * 60_000,
    listGcMs: 45 * 60_000,
    detailStaleMs: 2 * 60_000,
    detailGcMs: 45 * 60_000,
    homeStaleMs: 2 * 60_000,
    homeGcMs: 45 * 60_000
  }
};
