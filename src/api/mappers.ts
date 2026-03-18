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

function asStringFromUnknown(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return asString(value);
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = asStringFromUnknown(entry);
      if (nested) return nested;
    }
    return undefined;
  }

  const record = asRecord(value);
  return firstString(record.rendered, record.raw, record.value, record.label, record.text, record.title, record.name);
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = asString(value);
  if (!normalized) return undefined;
  const parsed = Number(normalized.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const normalized = asStringFromUnknown(value);
    if (normalized) return normalized;
  }

  return undefined;
}

function firstArray(...values: unknown[]): unknown[] | undefined {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) return value;
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

function stripHtml(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return decodeHtmlEntities(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || undefined;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeText(value: unknown): string | undefined {
  const raw = asStringFromUnknown(value);
  if (!raw) return undefined;
  const plain = stripHtml(raw) ?? decodeHtmlEntities(raw);
  const normalized = normalizeWhitespace(plain);
  return normalized || undefined;
}

export function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed || /^(javascript|data):/i.test(trimmed)) return undefined;
  if (trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/')) return `https://www.gewinnhai.de${trimmed}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\s/g, '').replace(/#.*$/, '');
  if (/^www\./i.test(trimmed)) return `https://${trimmed.replace(/\s/g, '')}`;
  return `https://${trimmed.replace(/\s/g, '')}`;
}

function normalizeDate(value: unknown): string | undefined {
  const dateString = normalizeText(value);
  if (!dateString) return undefined;

  const parsed = new Date(dateString);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();

  const german = dateString.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!german) return dateString;
  const [, day, month, year] = german;
  const isoDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`);
  return Number.isNaN(isoDate.getTime()) ? dateString : isoDate.toISOString();
}

function toSlug(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function extractUrlFromHtml(value: unknown): string | undefined {
  const text = asStringFromUnknown(value);
  if (!text) return undefined;
  const href = text.match(/(?:href|data-href|data-url)\s*=\s*['"]([^'"]+)['"]/i)?.[1];
  if (href) return normalizeUrl(href);
  const direct = text.match(/https?:\/\/[^\s'"<>]+/i)?.[0];
  return normalizeUrl(direct);
}

function extractSourceUrl(item: Record<string, unknown>): string | undefined {
  const explicit = [
    item.sourceUrl,
    item.source_url,
    item.url,
    item.link,
    item.external_url,
    item.teilnahmelink,
    item.participation_url,
    item.cta_url,
    asRecord(item.links).external,
    asRecord(item.links).participate,
    extractUrlFromHtml(item.description),
    extractUrlFromHtml(item.details)
  ]
    .map((entry) => normalizeUrl(asStringFromUnknown(entry)))
    .filter(Boolean) as string[];

  const nonGewinnhai = explicit.find((entry) => {
    try {
      return !/(^|\.)gewinnhai\.de$/i.test(new URL(entry).hostname);
    } catch {
      return true;
    }
  });

  return nonGewinnhai ?? explicit[0];
}

function fallbackId(item: Record<string, unknown>, slug: string | undefined, title: string | undefined): string {
  return firstString(item.id, item.giveaway_id, item.item_id, slug, toSlug(title), item.url) ?? 'unknown';
}

function fallbackTitle(item: Record<string, unknown>, slug: string): string {
  const fromSlug = slug.replace(/[-_]+/g, ' ').trim();
  if (fromSlug) return fromSlug.charAt(0).toUpperCase() + fromSlug.slice(1);
  return normalizeText(firstString(item.category_name, item.category, item.cat)) ?? 'Gewinnspiel';
}

export function mapGiveaway(raw: unknown): Giveaway {
  const item = asRecord(raw);
  const nestedCategory = asRecord(item.category);
  const nestedMeta = asRecord(item.meta);
  const nestedLinks = asRecord(item.links);

  const title = normalizeText(firstString(item.title, item.name, item.headline, nestedMeta.title));
  const slug =
    firstString(item.slug, item.seo_slug, item.post_name, nestedMeta.slug, item.id, toSlug(title), extractUrlFromHtml(item.url)) ?? 'unknown';
  const id = fallbackId(item, slug, title);

  return {
    id,
    slug,
    title: title ?? fallbackTitle(item, slug),
    teaser:
      normalizeText(firstString(item.teaser, item.summary, item.short_description, item.subtitle, item.description_short, nestedMeta.teaser)) ??
      'Mehr Details in der Gewinnspielansicht.',
    description: normalizeText(firstString(item.description, item.details, item.body, item.content, nestedMeta.description)),
    imageUrl: normalizeUrl(
      firstString(item.imageUrl, item.image_url, item.image, item.thumbnail, item.cover, item.cover_image, nestedLinks.image, nestedMeta.image)
    ),
    categoryId: firstString(item.categoryId, item.category_id, item.cat_id, nestedCategory.id, item.cat),
    categorySlug: firstString(item.categorySlug, item.category_slug, item.cat, nestedCategory.slug, nestedCategory.name),
    categoryLabel: normalizeText(firstString(item.categoryLabel, item.category_name, nestedCategory.title, nestedCategory.name, item.category, item.cat)),
    expiresAt: normalizeDate(firstString(item.expiresAt, item.expires_at, item.end_date, item.enddatum, item.ending_at, nestedMeta.end_date)),
    sourceUrl: extractSourceUrl(item),
    featured: Boolean(item.featured ?? item.is_featured ?? item.top)
  };
}

export function mapCategory(raw: unknown): Category {
  const item = asRecord(raw);
  const title = normalizeText(firstString(item.title, item.name, item.label, item.slug));
  return {
    id: firstString(item.id, item.category_id, item.slug, title) ?? 'unknown',
    slug: firstString(item.slug, item.category_slug, item.id, toSlug(title)) ?? 'unknown',
    title: title ?? 'Kategorie',
    iconUrl: normalizeUrl(firstString(item.iconUrl, item.icon_url, item.icon, item.image, item.thumbnail))
  };
}

export function mapTopItem(raw: unknown, index: number): TopItem {
  const item = asRecord(raw);
  const nestedItem = asRecord(item.item);
  const title = normalizeText(firstString(item.title, item.name, item.headline, nestedItem.title, nestedItem.name)) ?? `Top ${index + 1}`;
  const giveawaySlug = firstString(item.slug, item.giveaway_slug, nestedItem.slug, nestedItem.seo_slug, toSlug(title));
  const giveawayId = firstString(item.giveaway_id, item.item_id, nestedItem.id, giveawaySlug, item.id);

  return {
    id: firstString(item.id, item.rank, giveawayId, index + 1) ?? String(index + 1),
    rank: asNumber(item.rank ?? item.position ?? item.place) ?? index + 1,
    title,
    teaser: normalizeText(firstString(item.teaser, item.summary, item.description, nestedItem.teaser)),
    giveawayId,
    giveawaySlug,
    sourceUrl: normalizeUrl(firstString(item.url, item.link, item.source_url, nestedItem.url, nestedItem.link))
  };
}

const ENVELOPE_KEYS = ['data', 'result', 'results', 'payload', 'response'] as const;

export function unwrapApiEnvelope(rawData: unknown): unknown {
  let current = rawData;

  for (let i = 0; i < 5; i += 1) {
    if (Array.isArray(current)) return current;
    const record = asRecord(current);
    const next = ENVELOPE_KEYS.map((key) => record[key]).find((value) => value != null);
    if (next == null) return current;
    current = next;
  }

  return current;
}

export function extractList(rawData: unknown, nestedKeys: string[] = []): unknown[] {
  const candidate = unwrapApiEnvelope(rawData);
  if (Array.isArray(candidate)) return candidate;

  const record = asRecord(candidate);
  const preferred = firstArray(record.items, record.list, record.entries, record.newest, record.top10, record.top3);
  if (preferred) return preferred;

  for (const key of nestedKeys) {
    const nested = unwrapApiEnvelope(record[key]);
    if (Array.isArray(nested)) return nested;
    const nestedRecord = asRecord(nested);
    const nestedItems = firstArray(nestedRecord.items, nestedRecord.list, nestedRecord.entries);
    if (nestedItems) return nestedItems;
  }

  return [];
}

export function extractDetail(rawData: unknown): unknown {
  const candidate = unwrapApiEnvelope(rawData);
  if (!candidate || typeof candidate !== 'object') return candidate;
  const record = candidate as Record<string, unknown>;
  return record.item ?? record.data ?? candidate;
}
