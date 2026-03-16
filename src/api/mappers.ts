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
    const str = asStringFromUnknown(value);
    if (str) return str;
  }

  return undefined;
}

function extractUrlFromObject(value: unknown): string | undefined {
  const record = asRecord(value);
  return firstString(record.url, record.link, record.href, record.rendered, record.guid && asRecord(record.guid).rendered);
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

function firstArray(...values: unknown[]): unknown[] | undefined {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeText(value: unknown): string | undefined {
  const text = asString(value);
  if (!text) return undefined;
  const sanitized = normalizeWhitespace(decodeHtmlEntities(text));
  return sanitized || undefined;
}

export function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const withoutQuotes = trimmed.replace(/^['"]|['"]$/g, '');
  if (!withoutQuotes) return undefined;

  if (/^(javascript|data):/i.test(withoutQuotes)) return undefined;

  if (withoutQuotes.startsWith('mailto:') || withoutQuotes.startsWith('tel:')) {
    return withoutQuotes;
  }

  if (withoutQuotes.startsWith('//')) return `https:${withoutQuotes}`;
  if (withoutQuotes.startsWith('/')) return `https://www.gewinnhai.de${withoutQuotes}`;

  if (/^https?:\/\//i.test(withoutQuotes)) {
    return withoutQuotes.replace(/\s/g, '').replace(/#.*$/, '');
  }

  if (/^www\./i.test(withoutQuotes)) {
    return `https://${withoutQuotes.replace(/\s/g, '')}`;
  }

  return `https://${withoutQuotes.replace(/\s/g, '')}`;
}

function isGewinnhaiUrl(value: string | undefined): boolean {
  if (!value) return false;

  try {
    const url = new URL(value);
    return /(^|\.)gewinnhai\.de$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function normalizeDate(value: unknown): string | undefined {
  const dateString = normalizeText(value);
  if (!dateString) return undefined;

  const parsed = new Date(dateString);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  const deDate = dateString.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (deDate) {
    const [, day, month, year] = deDate;
    const parsedDeDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`);
    if (!Number.isNaN(parsedDeDate.getTime())) {
      return parsedDeDate.toISOString();
    }
  }

  return dateString;
}

function stripHtml(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return decodeHtmlEntities(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractUrlFromHtml(value: unknown): string | undefined {
  const text = asStringFromUnknown(value);
  if (!text) return undefined;

  const href = text.match(/(?:href|data-href|data-url)\s*=\s*['"]([^'"]+)['"]/i)?.[1];
  if (href) return normalizeUrl(href);

  const plainUrl = text.match(/https?:\/\/[^\s'"<>]+/i)?.[0];
  if (plainUrl) return normalizeUrl(plainUrl);

  return undefined;
}

function extractWpField(value: unknown): string | undefined {
  return asStringFromUnknown(value);
}

function extractWpCategoryId(item: Record<string, unknown>): string | undefined {
  if (Array.isArray(item.categories) && item.categories.length > 0) {
    return asString(item.categories[0]);
  }

  const embedded = asRecord(item._embedded);
  const terms = embedded['wp:term'];
  if (!Array.isArray(terms)) return undefined;

  for (const termGroup of terms) {
    if (!Array.isArray(termGroup) || termGroup.length === 0) continue;

    const preferredCategory = termGroup
      .map((entry) => asRecord(entry))
      .find((entry) => firstString(entry.taxonomy, entry.type) === 'category');

    const category = preferredCategory ?? asRecord(termGroup[0]);
    const candidate = firstString(category.id, category.slug, category.term_id);
    if (candidate) return candidate;
  }

  return undefined;
}

function extractWpCategoryMeta(item: Record<string, unknown>): { id?: string; slug?: string; label?: string } {
  const embedded = asRecord(item._embedded);
  const terms = embedded['wp:term'];
  if (!Array.isArray(terms)) {
    return {};
  }

  for (const termGroup of terms) {
    if (!Array.isArray(termGroup) || termGroup.length === 0) continue;

    const preferredCategory = termGroup
      .map((entry) => asRecord(entry))
      .find((entry) => firstString(entry.taxonomy, entry.type) === 'category');
    const category = preferredCategory ?? asRecord(termGroup[0]);

    const id = firstString(category.id, category.term_id);
    const slug = firstString(category.slug);
    const label = normalizeText(firstString(category.name, category.title));
    if (id || slug || label) {
      return { id, slug, label };
    }
  }

  return {};
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

  return normalizeUrl(
    firstString(
      item.jetpack_featured_media_url,
      extractUrlFromObject(item.featured_image),
      extractUrlFromObject(item.image),
      extractYoastImage(asRecord(item.yoast_head_json).og_image)
    )
  );
}

function extractGiveawayIdFromWpLink(value: unknown): string | undefined {
  const link = asString(value);
  if (!link) return undefined;

  const clean = link.split('?')[0].replace(/\/+$/, '');
  const slug = clean.split('/').pop();
  return slug?.trim() ? slug : undefined;
}

function extractAfcValue(item: Record<string, unknown>, key: string): unknown {
  const acf = asRecord(item.acf);
  return acf[key];
}

function extractYoastImage(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  return extractUrlFromObject(value[0]);
}

function extractSourceUrl(item: Record<string, unknown>, acf: Record<string, unknown>): string | undefined {
  const explicitCandidates = [
    item.sourceUrl,
    item.source_url,
    extractUrlFromObject(item.source),
    extractUrlFromObject(item.external_link),
    extractAfcValue(item, 'source_url'),
    extractAfcValue(item, 'external_url'),
    extractAfcValue(item, 'affiliate_link'),
    acf.source_url,
    acf.external_url,
    acf.affiliate_link,
    extractUrlFromHtml(item.content),
    extractUrlFromHtml(extractWpField(item.content))
  ]
    .map((entry) => normalizeUrl(asStringFromUnknown(entry)))
    .filter(Boolean) as string[];

  const nonGewinnhaiCandidate = explicitCandidates.find((entry) => !isGewinnhaiUrl(entry));
  if (nonGewinnhaiCandidate) return nonGewinnhaiCandidate;

  const explicitCandidate = explicitCandidates[0];
  if (explicitCandidate) return explicitCandidate;

  const fallbackCandidate = normalizeUrl(firstString(item.url, item.link, item.permalink, item.guid && asRecord(item.guid).rendered));
  if (fallbackCandidate && !isGewinnhaiUrl(fallbackCandidate)) {
    return fallbackCandidate;
  }

  return fallbackCandidate;
}

function toSlug(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function fallbackId(item: Record<string, unknown>, title: string | undefined): string | undefined {
  const sourceUrl = normalizeUrl(firstString(item.link, item.source_url, item.url, asRecord(item.guid).rendered));
  if (sourceUrl) return sourceUrl;
  return toSlug(title);
}

function fallbackTitle(item: Record<string, unknown>, id: string): string {
  const category = normalizeText(firstString(item.category_name, asRecord(item.acf).category_name));
  if (category) return `Gewinnspiel (${category})`;

  const inferred = id.split('/').pop()?.replace(/[-_]/g, ' ');
  if (inferred && inferred.length > 2) {
    return inferred.charAt(0).toUpperCase() + inferred.slice(1);
  }

  return 'Gewinnspiel';
}

function normalizeDescription(value: unknown): string | undefined {
  const normalized = normalizeText(value);
  if (!normalized) return undefined;

  return stripHtml(normalized);
}

export function mapGiveaway(raw: unknown): Giveaway {
  const item = asRecord(raw);
  const acf = asRecord(item.acf);
  const wpTitle = stripHtml(extractWpField(item.title));
  const wpTeaser = stripHtml(extractWpField(item.excerpt));
  const wpDescription = stripHtml(extractWpField(item.content));
  const wpCategoryMeta = extractWpCategoryMeta(item);
  const seoLinkSlug = extractGiveawayIdFromWpLink(item.link);

  const normalizedTitle = normalizeText(firstString(wpTitle, item.title, item.name, item.headline, acf.title, acf.headline)) ?? '';
  const normalizedTeaser = normalizeText(
    firstString(wpTeaser, item.teaser, item.summary, item.short_description, item.description, extractAfcValue(item, 'subtitle'), acf.teaser)
  );
  const id =
    firstString(item.id, item.giveaway_id, item.uuid, item.slug, item.url, extractAfcValue(item, 'giveaway_id'), acf.id, seoLinkSlug) ??
    firstString(wpTitle, item.name, item.headline, item.url) ??
    fallbackId(item, normalizedTitle);
  const slug =
    firstString(item.slug, item.seo_slug, seoLinkSlug, extractGiveawayIdFromWpLink(item.url), item.id, item.giveaway_id, toSlug(normalizedTitle)) ??
    id ??
    'unknown';

  const finalizedId = id ?? 'unknown';
  const finalizedTitle = normalizedTitle || fallbackTitle(item, finalizedId);

  return {
    id: finalizedId,
    slug,
    title: finalizedTitle,
    teaser: normalizedTeaser ?? 'Mehr Details in der Gewinnspielansicht.',
    description: normalizeDescription(
      firstString(wpDescription, item.description, item.content, item.long_description, item.body, extractAfcValue(item, 'description'), acf.content)
    ),
    imageUrl: normalizeUrl(
      firstString(
        item.imageUrl,
        item.image_url,
        item.image,
        item.thumbnail,
        item.cover_image,
        extractAfcValue(item, 'image'),
        extractAfcValue(item, 'thumbnail'),
        acf.image_url,
        extractWordpressImage(item)
      )
    ),
    categoryId: firstString(item.categoryId, item.category_id, item.categorySlug, item.category_slug, item.category, extractWpCategoryId(item), wpCategoryMeta.id),
    categorySlug: firstString(item.categorySlug, item.category_slug, asRecord(item.category).slug, asRecord(item.term).slug, wpCategoryMeta.slug),
    categoryLabel: normalizeText(firstString(item.categoryName, item.category_name, asRecord(item.category).name, asRecord(item.term).name, wpCategoryMeta.label)),
    expiresAt: normalizeDate(
      firstString(item.expiresAt, item.expires_at, item.expiration_date, item.end_date, item.date_gmt, item.modified_gmt, extractAfcValue(item, 'expires_at'))
    ),
    sourceUrl: extractSourceUrl(item, acf),
    featured: Boolean(item.featured ?? item.is_featured ?? extractAfcValue(item, 'featured') ?? acf.is_featured)
  };
}

export function mapCategory(raw: unknown): Category {
  const item = asRecord(raw);
  const wpTitle = stripHtml(extractWpField(item.name));
  const acf = asRecord(item.acf);
  const title = normalizeText(firstString(item.title, wpTitle, item.name, item.label)) ?? '';

  return {
    id: firstString(item.id, item.term_id, item.category_id, item.slug, title) ?? 'unknown',
    slug: firstString(item.slug, item.seo_slug, item.id, toSlug(title)) ?? (toSlug(title) || 'unknown'),
    title: title || 'Kategorie',
    iconUrl: normalizeUrl(firstString(item.iconUrl, item.icon_url, item.icon, item.image, item.thumbnail, acf.icon, acf.icon_url, acf.image))
  };
}

export function mapTopItem(raw: unknown, index: number): TopItem {
  const item = asRecord(raw);
  const acf = asRecord(item.acf);
  const nestedGiveaway = asRecord(item.giveaway);
  const nestedPost = asRecord(item.post);
  const wpTitle = stripHtml(extractWpField(item.title));
  const wpTeaser = stripHtml(extractWpField(item.excerpt));

  const giveawaySlug = firstString(
    item.slug,
    nestedGiveaway.slug,
    nestedPost.slug,
    extractGiveawayIdFromWpLink(item.link),
    extractGiveawayIdFromWpLink(item.source_url),
    extractGiveawayIdFromWpLink(nestedGiveaway.link),
    extractGiveawayIdFromWpLink(nestedPost.link)
  );
  const giveawayId = firstString(
    item.giveawayId,
    item.giveaway_id,
    acf.giveaway_id,
    nestedGiveaway.id,
    nestedPost.id,
    extractGiveawayIdFromWpLink(item.source_url),
    extractGiveawayIdFromWpLink(item.link),
    giveawaySlug,
    item.id
  );

  const title =
    normalizeText(
      firstString(
        wpTitle,
        item.title,
        item.name,
        item.headline,
        nestedGiveaway.title,
        nestedPost.title,
        extractWpField(nestedGiveaway.title),
        extractWpField(nestedPost.title),
        acf.title
      )
    ) ?? `Top ${index + 1}`;
  return {
    id: firstString(item.id, item.top_id, item.giveaway_id, item.slug, index + 1) ?? String(index + 1),
    rank: asNumber(item.rank ?? item.position ?? item.place ?? acf.rank) ?? index + 1,
    title,
    teaser: normalizeText(firstString(wpTeaser, item.teaser, item.summary, item.description, nestedGiveaway.excerpt, acf.teaser)),
    giveawayId,
    giveawaySlug,
    sourceUrl: normalizeUrl(
      firstString(item.sourceUrl, item.source_url, item.link, item.url, nestedGiveaway.link, nestedGiveaway.url, nestedPost.link, asRecord(item.guid).rendered)
    )
  };
}

const ENVELOPE_KEYS = ['data', 'result', 'results', 'items', 'payload', 'response', 'posts', 'entries'] as const;

export function unwrapApiEnvelope(rawData: unknown): unknown {
  let current = rawData;

  for (let i = 0; i < 5; i += 1) {
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

  const fallbackLists = firstArray(
    record.posts,
    record.entries,
    record.items,
    record.results,
    record.data,
    asRecord(record._embedded)['wp:term'],
    asRecord(record._embedded)['wp:featuredmedia']
  );
  if (fallbackLists?.length) {
    return fallbackLists.filter((entry) => entry && typeof entry === 'object');
  }

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

    if (value && typeof value === 'object') {
      const nestedValues = Object.values(value as Record<string, unknown>);
      if (nestedValues.every((entry) => entry && typeof entry === 'object')) {
        const objectList = nestedValues as unknown[];
        if (objectList.length) {
          return objectList;
        }
      }
    }
  }

  return [];
}

export function extractDetail(rawData: unknown): unknown {
  const candidate = unwrapApiEnvelope(rawData);

  if (candidate && typeof candidate === 'object') {
    const dataRecord = candidate as Record<string, unknown>;
    return dataRecord.item ?? dataRecord.giveaway ?? dataRecord.entry ?? dataRecord.post ?? candidate;
  }

  return candidate;
}
