import { SearchParams } from '../types/models';

export function normalizeSearchParams(params?: SearchParams): SearchParams | undefined {
  if (!params) return undefined;

  const query = params.query?.trim();
  const categoryId = params.categoryId?.trim();
  const categorySlug = params.categorySlug?.trim().toLowerCase();

  const normalized: SearchParams = {
    query: query && query.length >= 2 ? query : undefined,
    categoryId: categoryId || undefined,
    categorySlug: categorySlug || undefined
  };

  return normalized.query || normalized.categoryId || normalized.categorySlug ? normalized : undefined;
}

export function hasActiveSearchParams(params?: SearchParams): boolean {
  const normalized = normalizeSearchParams(params);
  return Boolean(normalized?.query || normalized?.categoryId || normalized?.categorySlug);
}
