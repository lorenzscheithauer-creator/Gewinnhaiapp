
import { apiClient } from './client';
import { extractDetail, extractList, mapCategory, mapGiveaway, mapTopItem } from './mappers';
import { ApiHomeResponse, ApiItemResponse, ApiListResponse, ApiRecord } from '../types/api';
import { Category, Giveaway, HomeData, HomeStats, SearchParams, TopItem } from '../types/models';
import { getCache, setCache } from '../utils/cache';
import { ENV } from '../config/env';
import { log } from '../utils/logger';
import { getSafeErrorContext, toAppError } from '../utils/errors';

const CACHE_TTL = {
  giveaways: 10 * 60_000,
  categories: 24 * 60 * 60_000,
  top10: 15 * 60_000,
  giveawayDetail: 30 * 60_000,
  search: 5 * 60_000,
  home: 5 * 60_000
};

const CACHE_KEYS = {
  home: 'cache:home',
  giveaways: (params?: SearchParams) => `cache:giveaways:${JSON.stringify(params ?? {})}`,
  categories: 'cache:categories',
  top10: 'cache:top10',
  search: (params: SearchParams) =>
    `cache:search:${JSON.stringify({ query: params.query?.trim().toLowerCase(), categoryId: params.categoryId, categorySlug: params.categorySlug })}`,
  giveawayDetail: (idOrSlug: string) => `cache:giveaway-detail:${idOrSlug}`
};

const DEFAULT_LIST_PER_PAGE = 24;
const CATEGORY_SCAN_PER_PAGE = 100;
const CATEGORY_SCAN_MAX_PAGES = 6;
const SEARCH_SCAN_PER_PAGE = 100;
const SEARCH_SCAN_MAX_PAGES = 8;

function asRecord(value: unknown): ApiRecord {
  return value && typeof value === 'object' ? (value as ApiRecord) : {};
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

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = asString(value);
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeSlug(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase() || undefined;
}

function normalizeQuery(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length >= 2 ? trimmed : undefined;
}

function getApiErrorMessage(error: unknown): string {
  return toAppError(error, 'Unbekannter PHP-API-Fehler.').message;
}

function validateArrayPayload<T>(payload: T[], emptyMessage: string): T[] {
  if (!Array.isArray(payload)) {
    throw new Error('Ungültige PHP-API-Antwort erhalten.');
  }
  if (!payload.length) {
    throw new Error(emptyMessage);
  }
  return payload;
}

function validateObjectPayload<T>(payload: T | undefined): T {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Ungültige PHP-API-Antwort erhalten.');
  }
  return payload;
}

async function loadWithCache<T>(cacheKey: string, loader: () => Promise<T>): Promise<T> {
  try {
    const data = await loader();
    return data;
  } catch (error) {
    const fresh = await getCache<T>(cacheKey);
    if (fresh) return fresh;

    const stale = await getCache<T>(cacheKey, { allowExpired: true });
    if (stale) return stale;

    throw toAppError(error, getApiErrorMessage(error));
  }
}

function normalizeListParams(params?: SearchParams): Record<string, string | number> {
  const categorySlug = normalizeSlug(params?.categorySlug);
  const categoryId = asString(params?.categoryId);

  return {
    ...(categorySlug ? { cat: categorySlug } : categoryId ? { cat: categoryId } : {}),
    page: params?.page && params.page > 0 ? params.page : 1,
    per_page: params?.perPage && params.perPage > 0 ? params.perPage : DEFAULT_LIST_PER_PAGE
  };
}

function normalizeListResponse(data: ApiListResponse): { items: Giveaway[]; found?: number } {
  const items = extractList(data, ['items']).map(mapGiveaway).filter((item) => item.id && item.slug && item.title);
  return { items, found: asNumber(data.found ?? data.total ?? data.count) };
}

function extractStats(raw: unknown): HomeStats {
  const record = asRecord(raw);
  return {
    activeCount: asNumber(record.active ?? record.activeCount ?? record.aktiv),
    endedCount: asNumber(record.ended ?? record.endedCount ?? record.beendet),
    totalCount: asNumber(record.total ?? record.totalCount ?? record.gesamt ?? record.found)
  };
}

function dedupeGiveaways(items: Giveaway[]): Giveaway[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.id}:${item.slug}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function filterGiveaways(items: Giveaway[], params: SearchParams): Giveaway[] {
  const query = normalizeQuery(params.query)?.toLowerCase();
  const categoryId = asString(params.categoryId)?.toLowerCase();
  const categorySlug = normalizeSlug(params.categorySlug);

  return items.filter((item) => {
    const categoryMatch = !categoryId || item.categoryId?.toLowerCase() === categoryId;
    const slugMatch = !categorySlug || item.categorySlug?.toLowerCase() === categorySlug;
    const queryMatch =
      !query ||
      [item.title, item.teaser, item.description, item.categoryLabel, item.slug]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query));

    return categoryMatch && slugMatch && queryMatch;
  });
}

async function fetchListPage(params?: SearchParams): Promise<{ items: Giveaway[]; found?: number }> {
  const requestParams = normalizeListParams(params);
  log('info', 'Using production PHP endpoint /api/list.php.', requestParams);
  const { data } = await apiClient.get<ApiListResponse>(ENV.endpoints.list, { params: requestParams });
  const normalized = normalizeListResponse(data);
  log('debug', 'Mapped response from production /api/list.php.', { requestParams, count: normalized.items.length, found: normalized.found });
  return normalized;
}

export async function fetchHomeData(): Promise<HomeData> {
  return loadWithCache(CACHE_KEYS.home, async () => {
    log('info', 'Using production PHP endpoint /api/home.php.');
    const { data } = await apiClient.get<ApiHomeResponse>(ENV.endpoints.home);
    const top3 = extractList(data.top3 ?? {}, ['items']).map(mapGiveaway);
    const newest = extractList(data.newest ?? {}, ['items']).map(mapGiveaway);
    const home = {
      stats: extractStats(data.stats),
      top3: dedupeGiveaways(top3),
      newest: dedupeGiveaways(newest)
    };

    if (!home.top3.length && !home.newest.length) {
      throw new Error('Die GewinnHai-PHP-API hat auf /api/home.php keine Home-Daten geliefert.');
    }

    await setCache(CACHE_KEYS.home, home, { ttlMs: CACHE_TTL.home });
    return home;
  });
}

export async function fetchGiveaways(params?: SearchParams): Promise<Giveaway[]> {
  const normalizedParams = {
    categoryId: params?.categoryId?.trim() || undefined,
    categorySlug: normalizeSlug(params?.categorySlug),
    page: params?.page,
    perPage: params?.perPage
  };
  const cacheKey = CACHE_KEYS.giveaways(normalizedParams);

  return loadWithCache(cacheKey, async () => {
    const { items } = await fetchListPage(normalizedParams);
    const giveaways = validateArrayPayload(items, 'Die GewinnHai-PHP-API hat keine Gewinnspiele geliefert.');
    await setCache(cacheKey, giveaways, { ttlMs: CACHE_TTL.giveaways });
    return giveaways;
  });
}

async function fetchSearchSourcePages(params: SearchParams): Promise<Giveaway[]> {
  const pages: Giveaway[] = [];
  for (let page = 1; page <= SEARCH_SCAN_MAX_PAGES; page += 1) {
    const { items, found } = await fetchListPage({
      categoryId: params.categoryId,
      categorySlug: params.categorySlug,
      page,
      perPage: SEARCH_SCAN_PER_PAGE
    });

    pages.push(...items);

    const loaded = page * SEARCH_SCAN_PER_PAGE;
    if (!items.length || (found && loaded >= found)) {
      break;
    }
  }

  return dedupeGiveaways(pages);
}

export async function fetchSearchGiveaways(params: SearchParams): Promise<Giveaway[]> {
  const trimmedQuery = normalizeQuery(params.query) ?? '';
  const cacheKey = CACHE_KEYS.search(params);

  return loadWithCache(cacheKey, async () => {
    const sourceItems = await fetchSearchSourcePages(params);
    const items = filterGiveaways(sourceItems, { ...params, query: trimmedQuery });
    await setCache(cacheKey, items, { ttlMs: CACHE_TTL.search });
    return items;
  });
}

function buildItemParamVariants(idOrSlug: string): Array<Record<string, string>> {
  const normalized = idOrSlug.trim();
  const variants: Array<Record<string, string>> = [];

  if (/^\d+$/.test(normalized)) {
    variants.push({ id: normalized });
  }

  const decoded = decodeURIComponent(normalized);
  const withoutOrigin = decoded.replace(/^https?:\/\/[^/]+/i, '');
  const parts = withoutOrigin.split('/').filter(Boolean);

  if (parts.length >= 3) {
    const [cat, veranstalter, slug] = parts.slice(-3);
    variants.push({ cat, veranstalter, slug });
    variants.push({ veranstalter, slug });
    variants.push({ cat, slug });
  } else if (parts.length >= 2) {
    const [first, second] = parts.slice(-2);
    variants.push({ veranstalter: first, slug: second });
    variants.push({ cat: first, slug: second });
  }

  const lastPart = parts.length > 0 ? parts[parts.length - 1] : undefined;
  variants.push({ slug: lastPart ?? decoded });

  const deduped = new Set<string>();
  return variants.filter((entry) => {
    const key = JSON.stringify(entry);
    if (deduped.has(key)) return false;
    deduped.add(key);
    return true;
  });
}

async function requestItemVariant(params: Record<string, string>): Promise<Giveaway | undefined> {
  try {
    log('info', 'Using production PHP endpoint /api/item.php.', params);
    const { data } = await apiClient.get<ApiItemResponse>(ENV.endpoints.item, { params });
    if (data.found === false) {
      return undefined;
    }

    const detail = mapGiveaway(extractDetail(data));

    if (!detail.id || detail.id === 'unknown') {
      log('warn', 'Mapping from /api/item.php returned no stable giveaway id.', { params, detail });
    }

    if (!detail.title || detail.title === 'Gewinnspiel') {
      log('warn', 'Mapping from /api/item.php returned only fallback title.', { params, detail });
    }

    return validateObjectPayload(detail);
  } catch (error) {
    const appError = toAppError(error);

    if (appError.status === 404) {
      log('warn', 'Production /api/item.php variant returned 404.', { ...params, status: appError.status });
      return undefined;
    }

    log('warn', 'Production /api/item.php variant failed.', { ...params, ...getSafeErrorContext(appError) });
    throw appError;
  }
}

export async function fetchGiveawayDetail(idOrSlug: string): Promise<Giveaway> {
  const normalized = idOrSlug.trim();
  const cacheKey = CACHE_KEYS.giveawayDetail(normalized);

  return loadWithCache(cacheKey, async () => {
    const variants = buildItemParamVariants(normalized);

    for (const variant of variants) {
      const detail = await requestItemVariant(variant);
      if (detail) {
        await setCache(cacheKey, detail, { ttlMs: CACHE_TTL.giveawayDetail });
        return detail;
      }
    }

    const searchMatches = await fetchSearchGiveaways({ query: normalized });
    const related = searchMatches.find((item) => item.slug === normalized || item.id === normalized);
    if (related?.slug && related.slug !== normalized) {
      const retried = await requestItemVariant({ slug: related.slug, ...(related.categorySlug ? { cat: related.categorySlug } : {}) });
      if (retried) {
        await setCache(cacheKey, retried, { ttlMs: CACHE_TTL.giveawayDetail });
        return retried;
      }
    }

    throw new Error(`Kein Detaildatensatz für "${normalized}" über /api/item.php gefunden. Erwartete Parameter: id, slug, veranstalter+slug oder optional cat+slug.`);
  });
}

export async function fetchCategories(): Promise<Category[]> {
  return loadWithCache(CACHE_KEYS.categories, async () => {
    const items: Giveaway[] = [];

    for (let page = 1; page <= CATEGORY_SCAN_MAX_PAGES; page += 1) {
      const { items: pageItems, found } = await fetchListPage({ page, perPage: CATEGORY_SCAN_PER_PAGE });
      items.push(...pageItems);
      const loaded = page * CATEGORY_SCAN_PER_PAGE;
      if (!pageItems.length || (found && loaded >= found)) break;
    }

    const categories = Array.from(
      new Map(
        dedupeGiveaways(items)
          .filter((item) => item.categorySlug || item.categoryId || item.categoryLabel)
          .map((item) => {
            const category = mapCategory({
              id: item.categoryId ?? item.categorySlug ?? item.categoryLabel,
              slug: item.categorySlug ?? item.categoryId ?? item.categoryLabel,
              title: item.categoryLabel ?? item.categorySlug ?? item.categoryId
            });
            return [`${category.id}:${category.slug}`, category] as const;
          })
      ).values()
    ).sort((left, right) => left.title.localeCompare(right.title, 'de'));

    const valid = validateArrayPayload(categories, 'Die GewinnHai-PHP-API hat keine Kategorien geliefert.');
    await setCache(CACHE_KEYS.categories, valid, { ttlMs: CACHE_TTL.categories });
    return valid;
  });
}

export async function fetchTop10(): Promise<TopItem[]> {
  return loadWithCache(CACHE_KEYS.top10, async () => {
    log('info', 'Using production PHP endpoint /api/top10.php.');
    const { data } = await apiClient.get<ApiListResponse>(ENV.endpoints.top10);
    const top10 = extractList(data, ['items']).map(mapTopItem);
    const normalized = validateArrayPayload(top10, 'Die GewinnHai-PHP-API hat keine Top10-Daten geliefert.');
    await setCache(CACHE_KEYS.top10, normalized, { ttlMs: CACHE_TTL.top10 });
    return normalized;
  });
}
