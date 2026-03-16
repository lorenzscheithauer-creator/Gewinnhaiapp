import { Category, Giveaway, TopItem } from '../types/models';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const str = asString(value);
    if (str) return str;
  }

  return undefined;
}

export function mapGiveaway(raw: unknown): Giveaway {
  const item = asRecord(raw);

  return {
    id: firstString(item.id, item.giveaway_id, item.uuid, item.slug, item.url) ?? firstString(item.title, item.name, item.headline, item.url) ?? 'unknown',
    slug: firstString(item.slug, item.seo_slug, item.id, item.giveaway_id) ?? 'unknown',
    title: firstString(item.title, item.name, item.headline) ?? 'Unbenanntes Gewinnspiel',
    teaser: firstString(item.teaser, item.summary, item.short_description, item.description) ?? 'Keine Kurzbeschreibung verfügbar.',
    description: firstString(item.description, item.content, item.long_description),
    imageUrl: firstString(item.imageUrl, item.image_url, item.image, item.thumbnail),
    categoryId: firstString(item.categoryId, item.category_id, item.categorySlug, item.category_slug),
    expiresAt: firstString(item.expiresAt, item.expires_at, item.expiration_date),
    sourceUrl:
      firstString(item.sourceUrl, item.source_url, item.url, item.link, item.permalink) ??
      'https://www.gewinnhai.de',
    featured: Boolean(item.featured ?? item.is_featured)
  };
}

export function mapCategory(raw: unknown): Category {
  const item = asRecord(raw);
  const title = firstString(item.title, item.name, item.label) ?? 'Unbekannte Kategorie';

  return {
    id: firstString(item.id, item.category_id, item.slug, title) ?? title,
    slug: firstString(item.slug, item.seo_slug, item.id, title) ?? title.toLowerCase().replace(/\s+/g, '-'),
    title,
    iconUrl: firstString(item.iconUrl, item.icon_url, item.icon)
  };
}

export function mapTopItem(raw: unknown, index: number): TopItem {
  const item = asRecord(raw);

  return {
    id: firstString(item.id, item.top_id, item.giveaway_id, item.slug, index + 1) ?? String(index + 1),
    rank: Number(item.rank ?? item.position ?? item.place ?? index + 1),
    title: firstString(item.title, item.name, item.headline) ?? `Top-Eintrag ${index + 1}`,
    teaser: firstString(item.teaser, item.summary, item.description),
    giveawayId: firstString(item.giveawayId, item.giveaway_id, item.slug, item.id)
  };
}

export function extractList(rawData: unknown, nestedKeys: string[]): unknown[] {
  if (Array.isArray(rawData)) return rawData;

  const dataRecord = asRecord(rawData);
  for (const key of nestedKeys) {
    const nested = dataRecord[key];
    if (Array.isArray(nested)) {
      return nested;
    }
  }

  return [];
}

export function extractDetail(rawData: unknown): unknown {
  if (rawData && typeof rawData === 'object') {
    const dataRecord = rawData as Record<string, unknown>;
    return dataRecord.item ?? dataRecord.giveaway ?? rawData;
  }

  return rawData;
}
