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
  endpoints?: EndpointConfig;
};

function withNoTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function normalizeEndpoints(value: string[] | undefined, fallback: string[]): string[] {
  if (!value?.length) return fallback;
  return value.map((entry) => entry.trim()).filter(Boolean);
}

const publicApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const publicApiTimeoutMs = process.env.EXPO_PUBLIC_API_TIMEOUT_MS;

export const ENV = {
  apiBaseUrl: withNoTrailingSlash(publicApiBaseUrl || extras.apiBaseUrl || 'https://www.gewinnhai.de'),
  apiTimeoutMs: Number(publicApiTimeoutMs || extras.apiTimeoutMs || 10000),
  endpoints: {
    giveaways: normalizeEndpoints(extras.endpoints?.giveaways, ['/api/giveaways', '/wp-json/wp/v2/posts']),
    giveawayDetail: normalizeEndpoints(extras.endpoints?.giveawayDetail, ['/api/giveaways/{idOrSlug}', '/wp-json/wp/v2/posts/{idOrSlug}']),
    categories: normalizeEndpoints(extras.endpoints?.categories, ['/api/categories', '/wp-json/wp/v2/categories']),
    top10: normalizeEndpoints(extras.endpoints?.top10, ['/api/top10', '/wp-json/wp/v2/posts'])
  }
};
