// ============================================================
//  pekora.zip Trading Site — Backend Proxy v3
//  Node.js / Express — Proxies pekora.zip's live API
//
//  Improvements over v2:
//   • WebSocket live-activity push to all connected clients
//   • In-flight request deduplication (stampede protection)
//   • Smarter per-endpoint cache TTLs
//   • Full route coverage (catalog, economy, users, thumbnails,
//     games, groups, trades, presence, avatar, friends, search)
//   • /api/homepage compound fetch (all home data in 1 call)
//   • /api/item/:id/full compound fetch with economy + resellers
//   • /api/user/:id/full compound fetch
//   • /api/v/changes  — value-change delta endpoint
//   • graceful shutdown + health/ready endpoints
// ============================================================

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const fetch      = require('node-fetch');
const NodeCache  = require('node-cache');
const compression = require('compression');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const http       = require('http');
const WebSocket  = require('ws');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const PORT         = process.env.PORT        || 3000;
const PEKORA_BASE  = process.env.PEKORA_BASE || 'https://www.pekora.zip/apisite';
const FETCH_TIMEOUT = parseInt(process.env.FETCH_TIMEOUT || '9000', 10);

// ─── CACHE ────────────────────────────────────────────────
const cache = new NodeCache({ stdTTL: 60, checkperiod: 90 });

const TTL = {
  catalog:    120,   // item listings
  item:       300,   // individual item
  economy:     60,   // prices / RAP
  resellers:   45,   // reseller list
  user:       120,
  userFull:   120,
  avatar:     300,
  thumbnail:  600,
  games:      120,
  gameDetail: 300,
  groups:     300,
  trades:      30,   // very live
  search:      60,
  presence:    15,   // online status, very live
  friends:    120,
};

// ─── IN-FLIGHT DEDUPLICATION ──────────────────────────────
// Prevents a cache miss from spawning 50 identical upstream requests
const inflight = new Map();

// ─── WEBSOCKET CLIENTS ────────────────────────────────────
const wsClients = new Set();

wss.on('connection', ws => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));
  // Send a welcome ping
  safeSend(ws, { type: 'connected', ts: Date.now() });
});

function safeSend(ws, data) {
  try {
    if (ws.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify(data));
  } catch {}
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  wsClients.forEach(ws => {
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    } catch {}
  });
}

// ─── MIDDLEWARE ───────────────────────────────────────────
app.use(compression());
app.use(morgan('dev'));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

// Serve frontend (v3)
app.use(express.static(path.join(__dirname, '../frontend')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit reached. Slow down.' },
});
app.use('/api', limiter);

// ─── CORE PROXY HELPER ────────────────────────────────────

/**
 * proxyPekora(endpoint, req?, ttl, queryOverrides?)
 * - Caches by endpoint + query string
 * - Deduplicates in-flight requests
 * - Forwards cookie for authenticated calls
 */
async function proxyPekora(endpoint, req = null, ttl = 60, queryOverrides = {}) {
  const url = new URL(`${PEKORA_BASE}${endpoint}`);

  // Merge caller's query params + any overrides
  const qs = { ...(req?.query || {}), ...queryOverrides };
  Object.entries(qs).forEach(([k, v]) => {
    if (v != null) url.searchParams.set(k, v);
  });

  const cacheKey = url.toString();

  // 1. Cache hit
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return { data: cached, fromCache: true };

  // 2. In-flight dedup
  if (inflight.has(cacheKey)) {
    const data = await inflight.get(cacheKey);
    return { data, fromCache: false };
  }

  // 3. Fresh fetch
  const promise = (async () => {
    const headers = {
      Accept: 'application/json',
      'User-Agent': 'PekoraSite/3.0',
    };
    if (req?.headers?.cookie) headers.Cookie = req.headers.cookie;

    const res = await fetch(url.toString(), {
      headers,
      timeout: FETCH_TIMEOUT,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw Object.assign(new Error(`Pekora ${res.status}`), { status: res.status, body });
    }

    const data = await res.json();
    cache.set(cacheKey, data, ttl);
    return data;
  })();

  inflight.set(cacheKey, promise);
  try {
    const data = await promise;
    return { data, fromCache: false };
  } finally {
    inflight.delete(cacheKey);
  }
}

async function proxyPost(endpoint, body, req, ttl = 0) {
  const url  = `${PEKORA_BASE}${endpoint}`;
  const cacheKey = url + JSON.stringify(body);

  if (ttl > 0) {
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return { data: cached, fromCache: true };
  }

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'PekoraSite/3.0',
  };
  if (req?.headers?.cookie) headers.Cookie = req.headers.cookie;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    timeout: FETCH_TIMEOUT,
  });

  if (!res.ok) throw Object.assign(new Error(`Pekora POST ${res.status}`), { status: res.status });
  const data = await res.json();
  if (ttl > 0) cache.set(cacheKey, data, ttl);
  return { data, fromCache: false };
}

// ─── ROUTE FACTORY ────────────────────────────────────────
// Creates a simple GET proxy route
function proxyRoute(path, endpointFn, ttl) {
  app.get(path, async (req, res) => {
    try {
      const endpoint = typeof endpointFn === 'function' ? endpointFn(req) : endpointFn;
      const { data, fromCache } = await proxyPekora(endpoint, req, ttl);
      res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
      res.json({ success: true, data });
    } catch (err) {
      const status = err.status || 502;
      res.status(status).json({ success: false, error: err.message });
    }
  });
}

// ─── ERROR HANDLER ────────────────────────────────────────
function handleErr(err, res) {
  console.error('[proxy]', err.message);
  res.status(err.status || 502).json({ success: false, error: err.message });
}

// ══════════════════════════════════════════════════════════
//  ROUTES
// ══════════════════════════════════════════════════════════

// ── HEALTH / STATUS ───────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.get('/api/ready',  (_, res) => res.json({ ready: true }));

app.get('/api/status', async (req, res) => {
  const t0 = Date.now();
  try {
    await fetch(`${PEKORA_BASE}/users/v1/users/1`, { timeout: 4000 });
    res.json({ pekora: 'online', latencyMs: Date.now() - t0, wsClients: wsClients.size });
  } catch {
    res.json({ pekora: 'offline', latencyMs: Date.now() - t0, wsClients: wsClients.size });
  }
});

// ── CATALOG ───────────────────────────────────────────────
app.get('/api/catalog/search', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      '/catalog/v1/search/items',
      req,
      TTL.catalog,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/catalog/item/:id', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/catalog/v1/catalog/items/${req.params.id}/details`,
      req,
      TTL.item,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/catalog/featured', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      '/catalog/v1/search/items',
      req,
      TTL.catalog,
      { sortType: 2, limit: 30, category: 'Accessories' },
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/catalog/limiteds', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      '/catalog/v1/search/items',
      req,
      TTL.catalog,
      { sortType: 1, limit: req.query.limit || 30, category: 'Accessories' },
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

// ── ECONOMY ───────────────────────────────────────────────
app.get('/api/economy/asset/:id', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/economy/v1/assets/${req.params.id}/resale-data`,
      req,
      TTL.economy,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/economy/asset/:id/resellers', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/economy/v1/assets/${req.params.id}/resellers`,
      req,
      TTL.resellers,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/economy/asset/:id/sales', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/economy/v1/assets/${req.params.id}/resale-data`,
      req,
      TTL.economy,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/economy/user/:id/currency', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/economy/v1/users/${req.params.id}/currency`,
      req,
      TTL.user,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

// Trades list (requires auth)
app.get('/api/economy/trades', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      '/trades/v1/trades/inbound',
      req,
      TTL.trades,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/economy/trade/:id', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/trades/v1/trades/${req.params.id}`,
      req,
      TTL.trades,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

// ── USERS ─────────────────────────────────────────────────
app.get('/api/users/me', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora('/users/v1/users/authenticated', req, 30);
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/users/v1/users/${req.params.id}`, req, TTL.user,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/users/search', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      '/users/v1/users/search', req, TTL.search,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/users/:id/inventory', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/inventory/v2/users/${req.params.id}/inventory`,
      req, TTL.user,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/users/:id/collectibles', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/inventory/v1/users/${req.params.id}/assets/collectibles`,
      req, TTL.user,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/users/:id/friends', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/friends/v1/users/${req.params.id}/friends`,
      req, TTL.friends,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/users/:id/avatar', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/avatar/v1/users/${req.params.id}/avatar`,
      req, TTL.avatar,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

// ── THUMBNAILS ────────────────────────────────────────────
app.get('/api/thumbnails/assets', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      '/thumbnails/v1/assets', req, TTL.thumbnail,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

// Batch thumbnails — POST body {assetIds:[...], size, format}
app.post('/api/thumbnails/batch', async (req, res) => {
  try {
    const { assetIds = [], size = '150x150', format = 'Png' } = req.body;
    if (!assetIds.length) return res.json({ success: true, data: {} });

    const CHUNK = 100;
    const results = {};

    for (let i = 0; i < assetIds.length; i += CHUNK) {
      const chunk = assetIds.slice(i, i + CHUNK);
      const qs = chunk.map(id => `assetIds=${id}`).join('&');
      try {
        const { data } = await proxyPekora(
          `/thumbnails/v1/assets?${qs}&size=${size}&format=${format}&isCircular=false`,
          req, TTL.thumbnail,
        );
        const list = data?.data || (Array.isArray(data) ? data : []);
        list.forEach(t => {
          if (t.imageUrl) results[t.targetId] = t.imageUrl;
        });
      } catch {}
    }

    res.json({ success: true, data: results });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/thumbnails/user/:id', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/thumbnails/v1/users/${req.params.id}/avatar`,
      req, TTL.thumbnail,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/thumbnails/game/:id', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/thumbnails/v1/games/${req.params.id}/icons`,
      req, TTL.thumbnail,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

// ── GAMES ─────────────────────────────────────────────────
app.get('/api/games', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      '/games/v2/games', req, TTL.games,
      { sortToken: '', gameFilter: 'default', limit: req.query.limit || 18 },
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/games/:id', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/games/v1/games?universeIds=${req.params.id}`,
      req, TTL.gameDetail,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/games/:id/servers', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/games/v1/games/${req.params.id}/servers/Public`,
      req, TTL.games,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/games/search', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      '/games/v1/games/list', req, TTL.games,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

// ── GROUPS ────────────────────────────────────────────────
app.get('/api/groups/:id', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/groups/v1/groups/${req.params.id}`, req, TTL.groups,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/groups/:id/members', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/groups/v1/groups/${req.params.id}/users`, req, TTL.groups,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

app.get('/api/groups/user/:userId', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      `/groups/v1/users/${req.params.userId}/groups/roles`, req, TTL.groups,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

// ── PRESENCE ──────────────────────────────────────────────
app.post('/api/presence/users', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPost(
      '/presence/v1/presence/users',
      req.body, req, TTL.presence,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

// ── AVATAR ────────────────────────────────────────────────
app.get('/api/avatar/metadata', async (req, res) => {
  try {
    const { data, fromCache } = await proxyPekora(
      '/avatar/v1/avatar/metadata', req, 3600,
    );
    res.set('X-Cache', fromCache ? 'HIT' : 'MISS');
    res.json({ success: true, data });
  } catch (err) { handleErr(err, res); }
});

// ── VALUE CHANGES ─────────────────────────────────────────
// Poll economy endpoint for top items and compute RAP delta
const valueCache = new Map();   // assetId → { rap, lastSeen }

app.get('/api/v/changes', async (req, res) => {
  // Returns a mock delta until we have enough history
  const TOP_IDS = [
    119418776, 62571865, 11884330, 1117856536, 19398,
    1081796, 80109, 62228266, 1365767, 302438829,
  ];

  const results = [];

  await Promise.allSettled(TOP_IDS.map(async id => {
    try {
      const { data } = await proxyPekora(
        `/economy/v1/assets/${id}/resale-data`, null, TTL.economy,
      );
      const rap = data?.recentAveragePrice ?? 0;
      const prev = valueCache.get(id)?.rap ?? rap;
      const pct  = prev > 0 ? ((rap - prev) / prev * 100).toFixed(1) : '0.0';
      valueCache.set(id, { rap, lastSeen: Date.now() });

      results.push({
        id,
        name: data?.assetName || `Item #${id}`,
        rap,
        prev,
        change: parseFloat(pct),
        dir: parseFloat(pct) >= 0 ? 'up' : 'down',
      });
    } catch {}
  }));

  results.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  res.json({ success: true, data: results });
});

// ── COMPOUND ROUTES ───────────────────────────────────────

// /api/homepage — everything the homepage needs in one shot
app.get('/api/homepage', async (req, res) => {
  const [catalogR, gamesR, featuredR] = await Promise.allSettled([
    proxyPekora('/catalog/v1/search/items', req, TTL.catalog,
      { sortType: 1, limit: 24, category: 'Accessories' }),
    proxyPekora('/games/v2/games', req, TTL.games,
      { sortToken: '', gameFilter: 'default', limit: 6 }),
    proxyPekora('/catalog/v1/search/items', req, TTL.catalog,
      { sortType: 2, limit: 8, category: 'Accessories' }),
  ]);

  res.json({
    success: true,
    data: {
      catalog:  catalogR.status  === 'fulfilled' ? catalogR.value.data  : null,
      games:    gamesR.status    === 'fulfilled' ? gamesR.value.data    : null,
      featured: featuredR.status === 'fulfilled' ? featuredR.value.data : null,
    },
  });
});

// /api/item/:id/full — full item details: catalog + economy + resellers + thumbnail
app.get('/api/item/:id/full', async (req, res) => {
  const { id } = req.params;

  const [catalogR, economyR, resellersR] = await Promise.allSettled([
    proxyPekora(`/catalog/v1/catalog/items/${id}/details`, req, TTL.item),
    proxyPekora(`/economy/v1/assets/${id}/resale-data`, req, TTL.economy),
    proxyPekora(`/economy/v1/assets/${id}/resellers`, req, TTL.resellers),
  ]);

  // Thumbnail separately (might 404 on non-image assets)
  let thumbnail = null;
  try {
    const { data } = await proxyPekora(
      `/thumbnails/v1/assets?assetIds=${id}&size=420x420&format=Png&isCircular=false`,
      req, TTL.thumbnail,
    );
    thumbnail = (data?.data || data)?.[0]?.imageUrl || null;
  } catch {}

  res.json({
    success: true,
    data: {
      item:      catalogR.status   === 'fulfilled' ? catalogR.value.data   : null,
      economy:   economyR.status   === 'fulfilled' ? economyR.value.data   : null,
      resellers: resellersR.status === 'fulfilled' ? resellersR.value.data : null,
      thumbnail,
    },
  });
});

// /api/user/:id/full — user + collectibles + avatar thumbnail + currency
app.get('/api/user/:id/full', async (req, res) => {
  const { id } = req.params;

  const [userR, collectiblesR, currencyR, avatarR] = await Promise.allSettled([
    proxyPekora(`/users/v1/users/${id}`, req, TTL.user),
    proxyPekora(`/inventory/v1/users/${id}/assets/collectibles`, req, TTL.user),
    proxyPekora(`/economy/v1/users/${id}/currency`, req, TTL.user),
    proxyPekora(`/thumbnails/v1/users/${id}/avatar?size=150x150&format=Png`, req, TTL.thumbnail),
  ]);

  res.json({
    success: true,
    data: {
      user:        userR.status        === 'fulfilled' ? userR.value.data        : null,
      collectibles:collectiblesR.status=== 'fulfilled' ? collectiblesR.value.data: null,
      currency:    currencyR.status    === 'fulfilled' ? currencyR.value.data    : null,
      avatarUrl:   avatarR.status      === 'fulfilled'
                     ? (avatarR.value.data?.imageUrl || null)
                     : null,
    },
  });
});

// ── CACHE MANAGEMENT ──────────────────────────────────────
app.get('/api/cache/stats', (_, res) => {
  const stats = cache.getStats();
  res.json({
    success: true,
    data: {
      keys:      cache.keys().length,
      hits:      stats.hits,
      misses:    stats.misses,
      hitRate:   stats.hits / Math.max(1, stats.hits + stats.misses),
      inflight:  inflight.size,
      wsClients: wsClients.size,
    },
  });
});

app.delete('/api/cache', (req, res) => {
  const { key } = req.query;
  if (key) {
    cache.del(key);
    res.json({ success: true, deleted: key });
  } else {
    cache.flushAll();
    res.json({ success: true, flushed: true });
  }
});

// ── WS BROADCAST TEST (dev) ───────────────────────────────
app.post('/api/_broadcast', express.json(), (req, res) => {
  broadcast(req.body);
  res.json({ success: true, clients: wsClients.size });
});

// ── SPA FALLBACK ──────────────────────────────────────────
app.get('*', (_, res) =>
  res.sendFile(path.join(__dirname, '../frontend/index.html')),
);

// ══════════════════════════════════════════════════════════
//  LIVE ACTIVITY SIMULATION (broadcasts to all WS clients)
//  In production this would be replaced by real trade events
// ══════════════════════════════════════════════════════════
const LIVE_NAMES  = ['trade_wizard','xX_NoobSlayer','ugc_hunter','rblx_trader','pekora_fan99','limited_king','sparkle_god','dominus_lord'];
const LIVE_ITEMS  = ['Dominus Infernus','Sparkle Time Fedora',"Winter's Crown",'Valkyrie Helm',"Bucket o' Flames",'Clockwork Headphones'];
const LIVE_EMOJIS = ['💎','🎩','👑','🔥','⚔️','😈','✨','🐋'];
const LIVE_TYPES  = ['sold','bought','traded'];

setInterval(() => {
  if (!wsClients.size) return;
  const dir = Math.random() > 0.45 ? '+' : '-';
  const amt = (Math.random() * 300 + 1).toFixed(0);
  broadcast({
    type:  'activity',
    user:  LIVE_NAMES[Math.random() * LIVE_NAMES.length | 0],
    item:  LIVE_ITEMS[Math.random() * LIVE_ITEMS.length | 0],
    kind:  LIVE_TYPES[Math.random() * 3 | 0],
    amt:   `${dir}${amt}K`,
    emoji: LIVE_EMOJIS[Math.random() * LIVE_EMOJIS.length | 0],
    ts:    Date.now(),
  });
}, 7000);

// ══════════════════════════════════════════════════════════
//  START
// ══════════════════════════════════════════════════════════
server.listen(PORT, () => {
  console.log(`\n🐰 pekora.zip Trading Site v3`);
  console.log(`   ├── HTTP  → http://localhost:${PORT}`);
  console.log(`   ├── WS    → ws://localhost:${PORT}`);
  console.log(`   └── API   → http://localhost:${PORT}/api\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received — shutting down gracefully');
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
