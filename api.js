// ============================================================
//  pekora.zip Trading Site — API Client v3
//  Auto-detects environment, uses WebSocket when available
// ============================================================

const API = (() => {

  // ── ENV DETECTION ────────────────────────────────────────
  const IS_FILE  = location.protocol === 'file:';
  const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const HAS_BACKEND = IS_LOCAL && !IS_FILE;

  function backendUrl(path) { return HAS_BACKEND ? `/api${path}` : null; }

  const PEKORA = 'https://www.pekora.zip/apisite';

  // ── CLIENT-SIDE CACHE ────────────────────────────────────
  const clientCache = new Map();
  const TTL = { default: 60_000, thumbnail: 600_000, economy: 45_000, short: 15_000 };

  function cGet(k) {
    const e = clientCache.get(k);
    if (!e) return undefined;
    if (Date.now() > e.exp) { clientCache.delete(k); return undefined; }
    return e.val;
  }
  function cSet(k, v, ms = TTL.default) {
    clientCache.set(k, { val: v, exp: Date.now() + ms });
  }

  // ── IN-FLIGHT DEDUP ──────────────────────────────────────
  const inflight = new Map();

  // ── CORE FETCH ───────────────────────────────────────────
  async function apiFetch(backendPath, pekoraPath, opts = {}) {
    const { ttl = TTL.default, method = 'GET', body } = opts;
    const bUrl = backendUrl(backendPath);
    const finalUrl = bUrl || `${PEKORA}${pekoraPath}`;
    const key = method + finalUrl + (body ? JSON.stringify(body) : '');

    const cached = cGet(key);
    if (cached !== undefined) return cached;
    if (inflight.has(key)) return inflight.get(key);

    const p = (async () => {
      const o = { method, headers: { Accept: 'application/json' }, credentials: 'include' };
      if (body) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
      const r = await fetch(finalUrl, o);
      if (!r.ok) throw new Error(`API ${r.status}`);
      const j = await r.json();
      const data = (bUrl && j?.data !== undefined) ? j.data : j;
      cSet(key, data, ttl);
      return data;
    })();

    inflight.set(key, p);
    try { return await p; } finally { inflight.delete(key); }
  }

  // ── WEBSOCKET ────────────────────────────────────────────
  let ws = null;
  const handlers = new Map();

  function connectWS() {
    if (!HAS_BACKEND) return;
    try {
      ws = new WebSocket(`ws://${location.host}`);
      ws.onmessage = e => {
        try {
          const msg = JSON.parse(e.data);
          handlers.get(msg.type)?.(msg);
          handlers.get('*')?.(msg);
        } catch {}
      };
      ws.onclose = () => { ws = null; setTimeout(connectWS, 5000); };
      ws.onerror = () => ws?.close();
    } catch {}
  }

  // Delay connect slightly so app.js can register handlers first
  setTimeout(connectWS, 300);

  // ── THUMBNAIL BATCH ──────────────────────────────────────
  async function getThumbnails(ids, size = '150x150') {
    if (!ids?.length) return {};
    if (HAS_BACKEND) {
      try {
        const r = await fetch('/api/thumbnails/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetIds: ids, size }),
          credentials: 'include',
        });
        if (r.ok) { const j = await r.json(); return j.data || {}; }
      } catch {}
    }
    // Fallback: direct (may CORS-fail)
    const result = {};
    const CHUNK = 100;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const qs = chunk.map(id => `assetIds=${id}`).join('&');
      try {
        const data = await apiFetch(
          `/thumbnails/assets?${qs}&size=${size}&format=Png`,
          `/thumbnails/v1/assets?${qs}&size=${size}&format=Png`,
          { ttl: TTL.thumbnail },
        );
        const list = data?.data || (Array.isArray(data) ? data : []);
        list.forEach(t => { if (t.imageUrl) result[t.targetId] = t.imageUrl; });
      } catch {}
    }
    return result;
  }

  // ── PUBLIC ───────────────────────────────────────────────
  return {
    // Status
    getStatus: () => apiFetch('/status', '/users/v1/users/1', { ttl: 5000 }),

    // Auth
    getMe: () => apiFetch('/users/me', '/users/v1/users/authenticated', { ttl: 30_000 }),

    // Catalog
    getCatalog: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiFetch(`/catalog/search?${qs}`, `/catalog/v1/search/items?${qs}`);
    },
    getItem: id => apiFetch(`/catalog/item/${id}`, `/catalog/v1/catalog/items/${id}/details`, { ttl: TTL.default * 5 }),

    // Economy
    getAssetEconomy:  id  => apiFetch(`/economy/asset/${id}`,           `/economy/v1/assets/${id}/resale-data`, { ttl: TTL.economy }),
    getResellers:     id  => apiFetch(`/economy/asset/${id}/resellers`,  `/economy/v1/assets/${id}/resellers`,   { ttl: TTL.economy }),
    getUserCurrency:  id  => apiFetch(`/economy/user/${id}/currency`,    `/economy/v1/users/${id}/currency`),

    // Compound routes (backend-only but degrade gracefully)
    getHomepage:      ()  => apiFetch('/homepage',        '/catalog/v1/search/items', { ttl: 90_000 }),
    getItemFull:      id  => apiFetch(`/item/${id}/full`, `/catalog/v1/catalog/items/${id}/details`),
    getUserFull:      id  => apiFetch(`/user/${id}/full`, `/users/v1/users/${id}`),
    getValueChanges:  ()  => apiFetch('/v/changes',       '/economy/v1/assets/1/resale-data', { ttl: 60_000 }),

    // Users
    getUser:              id => apiFetch(`/users/${id}`,               `/users/v1/users/${id}`),
    searchUsers:          q  => apiFetch(`/users/search?keyword=${encodeURIComponent(q)}`, `/users/v1/users/search?keyword=${encodeURIComponent(q)}`, { ttl: TTL.default }),
    getUserCollectibles:  id => apiFetch(`/users/${id}/collectibles`,  `/inventory/v1/users/${id}/assets/collectibles`),
    getUserFriends:       id => apiFetch(`/users/${id}/friends`,       `/friends/v1/users/${id}/friends`),
    getUserAvatar:        id => apiFetch(`/users/${id}/avatar`,        `/avatar/v1/users/${id}/avatar`),

    // Thumbnails
    getThumbnails,

    // Games
    getGames: (limit = 18) => apiFetch(`/games?limit=${limit}`, `/games/v2/games?sortToken=&gameFilter=default&limit=${limit}`, { ttl: 120_000 }),
    getGame:  id            => apiFetch(`/games/${id}`,          `/games/v1/games?universeIds=${id}`, { ttl: 300_000 }),

    // Groups
    getGroup: id => apiFetch(`/groups/${id}`, `/groups/v1/groups/${id}`, { ttl: 300_000 }),

    // Presence
    getPresence: userIds => apiFetch('/presence/users', '/presence/v1/presence/users', { method: 'POST', body: { userIds }, ttl: TTL.short }),

    // WebSocket
    onWS: (type, fn) => handlers.set(type, fn),

    // Cache
    clearCache:   () => clientCache.clear(),
    getCacheSize: () => clientCache.size,
  };
})();
