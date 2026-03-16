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

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
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

function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('//')) return `https:${value}`;
  return value;
}

function normalizeDate(value: unknown): string | undefined {
  const dateString = asString(value);
  if (!dateString) return undefined;

  const parsed = new Date(dateString);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return dateString;
}

export function mapGiveaway(raw: unknown): Giveaway {
  const item = asRecord(raw);

  const id =
    firstString(item.id, item.giveaway_id, item.uuid, item.slug, item.url) ??
    firstString(item.title, item.name, item.headline, item.url) ??
    'unknown';
  const slug = firstString(item.slug, item.seo_slug, item.id, item.giveaway_id) ?? id;

  return {
    id,
    slug,
    title: firstString(item.title, item.name, item.headline) ?? 'Unbenanntes Gewinnspiel',
    teaser:
      firstString(item.teaser, item.summary, item.short_description, item.description) ??
      'Keine Kurzbeschreibung verfügbar.',
    description: firstString(item.description, item.content, item.long_description, item.body),
    imageUrl: normalizeUrl(firstString(item.imageUrl, item.image_url, item.image, item.thumbnail, item.cover_image)),
    categoryId: firstString(item.categoryId, item.category_id, item.categorySlug, item.category_slug, item.category),
    expiresAt: normalizeDate(firstString(item.expiresAt, item.expires_at, item.expiration_date, item.end_date)),
    sourceUrl:
      normalizeUrl(firstString(item.sourceUrl, item.source_url, item.url, item.link, item.permalink)) ??
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
    iconUrl: normalizeUrl(firstString(item.iconUrl, item.icon_url, item.icon))
  };
}

export function mapTopItem(raw: unknown, index: number): TopItem {
  const item = asRecord(raw);

  return {
    id: firstString(item.id, item.top_id, item.giveaway_id, item.slug, index + 1) ?? String(index + 1),
    rank: asNumber(item.rank ?? item.position ?? item.place) ?? index + 1,
    title: firstString(item.title, item.name, item.headline) ?? `Top-Eintrag ${index + 1}`,
    teaser: firstString(item.teaser, item.summary, item.description),
    giveawayId: firstString(item.giveawayId, item.giveaway_id, item.slug, item.id)
  };
}

const ENVELOPE_KEYS = ['data', 'result', 'results', 'items', 'payload', 'response'] as const;

export function unwrapApiEnvelope(rawData: unknown): unknown {
  let current = rawData;

  for (let i = 0; i < 4; i += 1) {
    if (Array.isArray(current)) return current;

    const record = asRecord(current);
    let next: unknown;

    for (const key of ENVELOPE_KEYS) {
      if (key in record && record[key] != null) {
        next = record[key];
        break;
      }
    }

    if (!next) return current;
    current = next;
  }

  return current;
}

export function extractList(rawData: unknown, nestedKeys: string[] = []): unknown[] {
  const candidate = unwrapApiEnvelope(rawData);
  if (Array.isArray(candidate)) return candidate;

  const record = asRecord(candidate);
  for (const key of nestedKeys) {
    const nested = record[key];
    if (Array.isArray(nested)) {
      return nested;
    }

    const nestedEnvelope = unwrapApiEnvelope(nested);
    if (Array.isArray(nestedEnvelope)) return nestedEnvelope;
  }

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

export function extractDetail(rawData: unknown): unknown {
  const candidate = unwrapApiEnvelope(rawData);

  if (candidate && typeof candidate === 'object') {
    const dataRecord = candidate as Record<string, unknown>;
    return dataRecord.item ?? dataRecord.giveaway ?? dataRecord.entry ?? candidate;
  }

  return candidate;
}
