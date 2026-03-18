const { query, tablePrefix } = require('./db');

const POSTS = `${tablePrefix}posts`;
const POSTMETA = `${tablePrefix}postmeta`;
const TERMS = `${tablePrefix}terms`;
const TERM_TAXONOMY = `${tablePrefix}term_taxonomy`;
const TERM_RELATIONSHIPS = `${tablePrefix}term_relationships`;

const GIVEAWAY_POST_TYPES = (process.env.APP_API_POST_TYPES || 'post').split(',').map((value) => value.trim()).filter(Boolean);
const GIVEAWAY_CATEGORY_TAXONOMY = process.env.APP_API_CATEGORY_TAXONOMY || 'category';
const TOP10_TAG_SLUG = process.env.APP_API_TOP10_TAG_SLUG || 'top10';
const DEFAULT_LIMIT = Number(process.env.APP_API_DEFAULT_LIMIT || 50);
const SEARCH_LIMIT = Number(process.env.APP_API_SEARCH_LIMIT || 25);

function placeholders(values) {
  return values.map(() => '?').join(', ');
}

function decodeHtml(value) {
  if (!value) return '';
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(value) {
  return decodeHtml(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function toIso(value) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function normalizeImageUrl(value) {
  if (!value) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/')) {
    const origin = process.env.APP_API_PUBLIC_ORIGIN || 'https://www.gewinnhai.de';
    return `${origin.replace(/\/+$/, '')}${trimmed}`;
  }
  return trimmed;
}

function normalizeSlug(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '').split('/').filter(Boolean).pop();
}

function mapGiveawayRow(row) {
  const title = stripHtml(row.title) || `Gewinnspiel ${row.id}`;
  const description = stripHtml(row.content) || undefined;
  const teaser = stripHtml(row.excerpt) || description || title;
  const slug = normalizeSlug(row.slug || row.post_name || row.id);
  const sourceUrl = row.source_url || row.permalink || undefined;

  return {
    id: String(row.id),
    slug,
    title,
    teaser,
    description,
    imageUrl: normalizeImageUrl(row.image_url),
    categoryId: row.category_id ? String(row.category_id) : undefined,
    categorySlug: row.category_slug || undefined,
    categoryLabel: row.category_name ? stripHtml(row.category_name) : undefined,
    expiresAt: toIso(row.expires_at || row.post_date_gmt || row.post_date),
    sourceUrl,
    featured: Boolean(Number(row.is_featured || 0))
  };
}

function mapCategoryRow(row) {
  return {
    id: String(row.id),
    slug: row.slug,
    title: stripHtml(row.name) || row.slug,
    iconUrl: normalizeImageUrl(row.icon_url)
  };
}

function mapTop10Row(row, index) {
  const giveawayId = row.giveaway_id ? String(row.giveaway_id) : String(row.id);
  const giveawaySlug = row.giveaway_slug || row.slug;

  return {
    id: `top10-${giveawayId}-${index + 1}`,
    rank: Number(row.rank_hint) || index + 1,
    title: stripHtml(row.title) || `Top ${index + 1}`,
    teaser: stripHtml(row.excerpt) || stripHtml(row.content) || undefined,
    giveawayId,
    giveawaySlug,
    sourceUrl: row.source_url || row.permalink || undefined
  };
}

async function fetchGiveawayRows({ queryText, categoryId, categorySlug, limit = DEFAULT_LIMIT, exactIdOrSlug } = {}) {
  const origin = process.env.APP_API_PUBLIC_ORIGIN || 'https://www.gewinnhai.de';
  const params = [
    GIVEAWAY_CATEGORY_TAXONOMY,
    GIVEAWAY_CATEGORY_TAXONOMY,
    GIVEAWAY_CATEGORY_TAXONOMY,
    origin,
    ...GIVEAWAY_POST_TYPES
  ];
  const where = [`p.post_status = 'publish'`, `p.post_type IN (${placeholders(GIVEAWAY_POST_TYPES)})`];

  if (exactIdOrSlug) {
    where.push('(p.ID = ? OR p.post_name = ?)');
    params.push(Number(exactIdOrSlug) || -1, exactIdOrSlug);
  }

  if (categoryId) {
    where.push(`EXISTS (
      SELECT 1
      FROM ${TERM_RELATIONSHIPS} rel
      INNER JOIN ${TERM_TAXONOMY} tax ON tax.term_taxonomy_id = rel.term_taxonomy_id
      WHERE rel.object_id = p.ID AND tax.taxonomy = ? AND tax.term_id = ?
    )`);
    params.push(GIVEAWAY_CATEGORY_TAXONOMY, Number(categoryId));
  }

  if (categorySlug) {
    where.push(`EXISTS (
      SELECT 1
      FROM ${TERM_RELATIONSHIPS} rel
      INNER JOIN ${TERM_TAXONOMY} tax ON tax.term_taxonomy_id = rel.term_taxonomy_id
      INNER JOIN ${TERMS} term ON term.term_id = tax.term_id
      WHERE rel.object_id = p.ID AND tax.taxonomy = ? AND term.slug = ?
    )`);
    params.push(GIVEAWAY_CATEGORY_TAXONOMY, categorySlug);
  }

  if (queryText) {
    where.push('(p.post_title LIKE ? OR p.post_excerpt LIKE ? OR p.post_content LIKE ?)');
    const like = `%${queryText}%`;
    params.push(like, like, like);
  }

  params.push(Math.min(limit, 100));

  return query(
    `
      SELECT
        p.ID AS id,
        p.post_name AS slug,
        p.post_title AS title,
        p.post_excerpt AS excerpt,
        p.post_content AS content,
        p.post_date AS post_date,
        p.post_date_gmt AS post_date_gmt,
        (
          SELECT pm.meta_value
          FROM ${POSTMETA} pm
          WHERE pm.post_id = p.ID AND pm.meta_key = '_thumbnail_url'
          LIMIT 1
        ) AS image_url,
        (
          SELECT pm.meta_value
          FROM ${POSTMETA} pm
          WHERE pm.post_id = p.ID AND pm.meta_key = 'source_url'
          LIMIT 1
        ) AS source_url,
        (
          SELECT pm.meta_value
          FROM ${POSTMETA} pm
          WHERE pm.post_id = p.ID AND pm.meta_key = 'expires_at'
          LIMIT 1
        ) AS expires_at,
        (
          SELECT pm.meta_value
          FROM ${POSTMETA} pm
          WHERE pm.post_id = p.ID AND pm.meta_key = 'is_featured'
          LIMIT 1
        ) AS is_featured,
        (
          SELECT term.term_id
          FROM ${TERM_RELATIONSHIPS} rel
          INNER JOIN ${TERM_TAXONOMY} tax ON tax.term_taxonomy_id = rel.term_taxonomy_id AND tax.taxonomy = ?
          INNER JOIN ${TERMS} term ON term.term_id = tax.term_id
          WHERE rel.object_id = p.ID
          ORDER BY term.name ASC
          LIMIT 1
        ) AS category_id,
        (
          SELECT term.slug
          FROM ${TERM_RELATIONSHIPS} rel
          INNER JOIN ${TERM_TAXONOMY} tax ON tax.term_taxonomy_id = rel.term_taxonomy_id AND tax.taxonomy = ?
          INNER JOIN ${TERMS} term ON term.term_id = tax.term_id
          WHERE rel.object_id = p.ID
          ORDER BY term.name ASC
          LIMIT 1
        ) AS category_slug,
        (
          SELECT term.name
          FROM ${TERM_RELATIONSHIPS} rel
          INNER JOIN ${TERM_TAXONOMY} tax ON tax.term_taxonomy_id = rel.term_taxonomy_id AND tax.taxonomy = ?
          INNER JOIN ${TERMS} term ON term.term_id = tax.term_id
          WHERE rel.object_id = p.ID
          ORDER BY term.name ASC
          LIMIT 1
        ) AS category_name,
        CONCAT(?, '/', p.post_name, '/') AS permalink
      FROM ${POSTS} p
      WHERE ${where.join(' AND ')}
      ORDER BY p.post_date_gmt DESC, p.ID DESC
      LIMIT ?
    `,
    params
  );
}

async function getGiveaways(filters = {}) {
  const rows = await fetchGiveawayRows(filters);
  return rows.map(mapGiveawayRow);
}

async function getGiveawayDetail(idOrSlug) {
  const rows = await fetchGiveawayRows({ exactIdOrSlug: idOrSlug, limit: 1 });
  if (!rows.length) return null;
  return mapGiveawayRow(rows[0]);
}

async function getCategories() {
  const rows = await query(
    `
      SELECT
        t.term_id AS id,
        t.slug,
        t.name,
        (
          SELECT pm.meta_value
          FROM ${POSTMETA} pm
          WHERE pm.post_id = t.term_id AND pm.meta_key = 'icon_url'
          LIMIT 1
        ) AS icon_url
      FROM ${TERMS} t
      INNER JOIN ${TERM_TAXONOMY} tt ON tt.term_id = t.term_id AND tt.taxonomy = ?
      WHERE tt.count > 0
      ORDER BY t.name ASC
    `,
    [GIVEAWAY_CATEGORY_TAXONOMY]
  );

  return rows.map(mapCategoryRow);
}

async function getTop10() {
  const origin = process.env.APP_API_PUBLIC_ORIGIN || 'https://www.gewinnhai.de';
  const taggedRows = await query(
    `
      SELECT
        p.ID AS id,
        p.post_name AS slug,
        p.post_title AS title,
        p.post_excerpt AS excerpt,
        p.post_content AS content,
        (
          SELECT pm.meta_value
          FROM ${POSTMETA} pm
          WHERE pm.post_id = p.ID AND pm.meta_key = 'source_url'
          LIMIT 1
        ) AS source_url,
        CONCAT(?, '/', p.post_name, '/') AS permalink,
        p.ID AS giveaway_id,
        p.post_name AS giveaway_slug,
        ROW_NUMBER() OVER (ORDER BY p.post_date_gmt DESC, p.ID DESC) AS rank_hint
      FROM ${POSTS} p
      INNER JOIN ${TERM_RELATIONSHIPS} rel ON rel.object_id = p.ID
      INNER JOIN ${TERM_TAXONOMY} tt ON tt.term_taxonomy_id = rel.term_taxonomy_id
      INNER JOIN ${TERMS} t ON t.term_id = tt.term_id
      WHERE p.post_status = 'publish'
        AND p.post_type IN (${placeholders(GIVEAWAY_POST_TYPES)})
        AND tt.taxonomy = 'post_tag'
        AND t.slug = ?
      ORDER BY p.post_date_gmt DESC, p.ID DESC
      LIMIT 10
    `,
    [origin, ...GIVEAWAY_POST_TYPES, TOP10_TAG_SLUG]
  );

  const sourceRows = taggedRows.length ? taggedRows : await fetchGiveawayRows({ limit: 10 });
  return sourceRows.slice(0, 10).map(mapTop10Row).sort((a, b) => a.rank - b.rank);
}

async function searchGiveaways(queryText, filters = {}) {
  if (!queryText || queryText.trim().length < 2) {
    return [];
  }

  const rows = await fetchGiveawayRows({ queryText: queryText.trim(), categoryId: filters.categoryId, categorySlug: filters.categorySlug, limit: SEARCH_LIMIT });
  return rows.map(mapGiveawayRow);
}

module.exports = {
  getGiveaways,
  getGiveawayDetail,
  getCategories,
  getTop10,
  searchGiveaways
};
