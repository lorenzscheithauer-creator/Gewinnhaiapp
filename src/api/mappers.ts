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

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('//')) return `https:${value}`;
  if (value.startsWith('/')) return `https://www.gewinnhai.de${value}`;
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

function stripHtml(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return decodeHtmlEntities(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractWpField(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  const record = asRecord(value);
  return asString(record.rendered);
}

function extractWpCategoryId(item: Record<string, unknown>): string | undefined {
  if (Array.isArray(item.categories) && item.categories.length > 0) {
    return asString(item.categories[0]);
  }

  const embedded = asRecord(item._embedded);
  const terms = embedded['wp:term'];
  if (!Array.isArray(terms)) return undefined;

  const firstTermGroup = terms.find((group) => Array.isArray(group));
  if (!Array.isArray(firstTermGroup) || firstTermGroup.length === 0) return undefined;

  const firstCategory = asRecord(firstTermGroup[0]);
  return firstString(firstCategory.id, firstCategory.slug, firstCategory.term_id);
}

function extractWordpressImage(item: Record<string, unknown>): string | undefined {
  const embedded = asRecord(item._embedded);
  const mediaList = embedded['wp:featuredmedia'];
  if (Array.isArray(mediaList) && mediaList.length > 0) {
    const firstMedia = asRecord(mediaList[0]);
    const sizes = asRecord(asRecord(firstMedia.media_details).sizes);
    const preferred = asRecord(sizes.medium_large ?? sizes.large ?? sizes.medium ?? sizes.full);
    return normalizeUrl(firstString(preferred.source_url, firstMedia.source_url, asRecord(firstMedia.guid).rendered));
  }

  return undefined;
}

function extractGiveawayIdFromWpLink(value: unknown): string | undefined {
  const link = asString(value);
  if (!link) return undefined;

  const clean = link.split('?')[0].replace(/\/+$/, '');
  const slug = clean.split('/').pop();
  return slug?.trim() ? slug : undefined;
}

export function mapGiveaway(raw: unknown): Giveaway {
  const item = asRecord(raw);
  const wpTitle = stripHtml(extractWpField(item.title));
  const wpTeaser = stripHtml(extractWpField(item.excerpt));
  const wpDescription = stripHtml(extractWpField(item.content));

  const id =
    firstString(item.id, item.giveaway_id, item.uuid, item.slug, item.url, extractGiveawayIdFromWpLink(item.link)) ??
    firstString(wpTitle, item.name, item.headline, item.url);
  const slug = firstString(item.slug, item.seo_slug, extractGiveawayIdFromWpLink(item.link), item.id, item.giveaway_id) ?? id ?? 'unknown';

  return {
    id: id ?? 'unknown',
    slug,
    title: firstString(wpTitle, item.title, item.name, item.headline) ?? '',
    teaser:
      firstString(wpTeaser, item.teaser, item.summary, item.short_description, item.description) ?? '',
    description: firstString(wpDescription, item.description, item.content, item.long_description, item.body),
    imageUrl: normalizeUrl(
      firstString(item.imageUrl, item.image_url, item.image, item.thumbnail, item.cover_image, extractWordpressImage(item))
    ),
    categoryId: firstString(item.categoryId, item.category_id, item.categorySlug, item.category_slug, item.category, extractWpCategoryId(item)),
    expiresAt: normalizeDate(firstString(item.expiresAt, item.expires_at, item.expiration_date, item.end_date, item.date_gmt, item.modified_gmt)),
    sourceUrl:
      normalizeUrl(
        firstString(item.sourceUrl, item.source_url, item.url, item.link, item.permalink, item.guid && asRecord(item.guid).rendered)
      ) ?? 'https://www.gewinnhai.de',
    featured: Boolean(item.featured ?? item.is_featured)
  };
}

export function mapCategory(raw: unknown): Category {
  const item = asRecord(raw);
  const title = firstString(item.title, item.name, item.label) ?? ''; 

  return {
    id: firstString(item.id, item.category_id, item.slug, title) ?? 'unknown',
    slug: firstString(item.slug, item.seo_slug, item.id, title) ?? (title.toLowerCase().replace(/\s+/g, '-') || 'unknown'),
    title,
    iconUrl: normalizeUrl(firstString(item.iconUrl, item.icon_url, item.icon, item.image, item.thumbnail))
  };
}

export function mapTopItem(raw: unknown, index: number): TopItem {
  const item = asRecord(raw);
  const wpTitle = stripHtml(extractWpField(item.title));
  const wpTeaser = stripHtml(extractWpField(item.excerpt));

  const giveawayId = firstString(
    item.giveawayId,
    item.giveaway_id,
    asRecord(item.acf).giveaway_id,
    extractGiveawayIdFromWpLink(item.source_url),
    extractGiveawayIdFromWpLink(item.link),
    item.slug,
    item.id
  );

  return {
    id: firstString(item.id, item.top_id, item.giveaway_id, item.slug, index + 1) ?? String(index + 1),
    rank: asNumber(item.rank ?? item.position ?? item.place ?? asRecord(item.acf).rank) ?? index + 1,
    title: firstString(wpTitle, item.title, item.name, item.headline) ?? '',
    teaser: firstString(wpTeaser, item.teaser, item.summary, item.description),
    giveawayId
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
