import Constants from 'expo-constants';

type EndpointConfig = {
  giveaways?: string[];
  giveawayDetail?: string[];
  categories?: string[];
  top10?: string[];
};

const extras = (Constants.expoConfig?.extra ?? {}) as {
  apiBaseUrl?: string;
  apiTimeoutMs?: number;
  appEnv?: string;
  endpoints?: EndpointConfig;
};

function withNoTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function normalizeEndpoints(value: string[] | undefined, fallback: string[]): string[] {
  if (!value?.length) return fallback;
  return value.map((entry) => entry.trim()).filter(Boolean);
}

function parseEndpointEnv(value: string | undefined): string[] | undefined {
  if (!value) return undefined;

  const parsed = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return parsed.length ? parsed : undefined;
}

function toSafeTimeoutMs(value: string | number | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(parsed, 3000), 30000);
}

const publicApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const publicApiTimeoutMs = process.env.EXPO_PUBLIC_API_TIMEOUT_MS;
const publicAppEnv = process.env.EXPO_PUBLIC_APP_ENV;
const publicGiveawaysEndpoints = parseEndpointEnv(process.env.EXPO_PUBLIC_ENDPOINTS_GIVEAWAYS);
const publicGiveawayDetailEndpoints = parseEndpointEnv(process.env.EXPO_PUBLIC_ENDPOINTS_GIVEAWAY_DETAIL);
const publicCategoriesEndpoints = parseEndpointEnv(process.env.EXPO_PUBLIC_ENDPOINTS_CATEGORIES);
const publicTop10Endpoints = parseEndpointEnv(process.env.EXPO_PUBLIC_ENDPOINTS_TOP10);

const appEnv = publicAppEnv || extras.appEnv || 'production';

export const ENV = {
  appEnv,
  isProduction: appEnv === 'production',
  apiBaseUrl: withNoTrailingSlash(publicApiBaseUrl || extras.apiBaseUrl || 'https://www.gewinnhai.de'),
  apiTimeoutMs: toSafeTimeoutMs(publicApiTimeoutMs || extras.apiTimeoutMs, 10000),
  endpoints: {
    giveaways: normalizeEndpoints(publicGiveawaysEndpoints ?? extras.endpoints?.giveaways, ['/api/giveaways']),
    giveawayDetail: normalizeEndpoints(
      publicGiveawayDetailEndpoints ?? extras.endpoints?.giveawayDetail,
      ['/api/giveaways/{idOrSlug}']
    ),
    categories: normalizeEndpoints(publicCategoriesEndpoints ?? extras.endpoints?.categories, ['/api/categories']),
    top10: normalizeEndpoints(publicTop10Endpoints ?? extras.endpoints?.top10, ['/api/top10'])
  },
  query: {
    listStaleMs: 2 * 60_000,
    listGcMs: 45 * 60_000,
    detailStaleMs: 2 * 60_000,
    detailGcMs: 45 * 60_000
  }
};
