const express = require('express');
const cors = require('cors');

const { pool } = require('./db');
const { getCategories, getGiveawayDetail, getGiveaways, getTop10, searchGiveaways } = require('./service');

const app = express();
const port = Number(process.env.APP_API_PORT || 3001);

app.disable('x-powered-by');
app.use(cors({ origin: process.env.APP_API_CORS_ORIGIN?.split(',').map((value) => value.trim()).filter(Boolean) || true }));
app.use(express.json());

function sendSuccess(res, data, meta) {
  res.json({ ok: true, data, meta });
}

function normalizeIdOrSlug(value) {
  return String(value || '').trim().replace(/^\/+|\/+$/g, '').split('/').filter(Boolean).pop();
}

app.get('/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1');
    sendSuccess(res, { status: 'ok' });
  } catch (error) {
    next(error);
  }
});

app.get('/app-api/giveaways', async (req, res, next) => {
  try {
    const data = await getGiveaways({
      categoryId: req.query.categoryId ? String(req.query.categoryId) : undefined,
      categorySlug: req.query.categorySlug ? String(req.query.categorySlug) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined
    });
    sendSuccess(res, data, { total: data.length });
  } catch (error) {
    next(error);
  }
});

app.get('/app-api/giveaways/:idOrSlug', async (req, res, next) => {
  try {
    const item = await getGiveawayDetail(normalizeIdOrSlug(req.params.idOrSlug));
    if (!item) {
      res.status(404).json({ ok: false, error: 'giveaway_not_found', message: 'Gewinnspiel nicht gefunden.' });
      return;
    }
    sendSuccess(res, item);
  } catch (error) {
    next(error);
  }
});

app.get('/app-api/categories', async (_req, res, next) => {
  try {
    const data = await getCategories();
    sendSuccess(res, data, { total: data.length });
  } catch (error) {
    next(error);
  }
});

app.get('/app-api/top10', async (_req, res, next) => {
  try {
    const data = await getTop10();
    sendSuccess(res, data, { total: data.length, derived: true });
  } catch (error) {
    next(error);
  }
});

app.get('/app-api/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      res.status(400).json({ ok: false, error: 'invalid_query', message: 'Suchbegriff muss mindestens 2 Zeichen lang sein.' });
      return;
    }
    const data = await searchGiveaways(q, {
      categoryId: req.query.categoryId ? String(req.query.categoryId) : undefined,
      categorySlug: req.query.categorySlug ? String(req.query.categorySlug) : undefined
    });
    sendSuccess(res, data, { total: data.length, q });
  } catch (error) {
    next(error);
  }
});

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'endpoint_not_found', message: 'App-API-Endpunkt nicht gefunden.' });
});

app.use((error, _req, res) => {
  console.error('[app-api]', error);
  res.status(500).json({ ok: false, error: 'server_error', message: 'App-API konnte die Datenbankabfrage nicht verarbeiten.' });
});

app.listen(port, () => {
  console.log(`[app-api] listening on :${port}`);
});
