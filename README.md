# pekora.zip Trading Dashboard — v3

Authentic 2017 Roblox-styled trading dashboard for **pekora.zip** (Korone revival).

## What's new in v3

| Feature | v2 | v3 |
|---|---|---|
| Styling | Custom dark theme | **Authentic 2017 Roblox** (extracted from source) |
| WebSocket | ❌ | ✅ Live activity push from server |
| In-flight dedup | Client only | **Both client + server** (stampede protection) |
| Compound routes | ❌ | ✅ `/api/homepage`, `/api/item/:id/full`, `/api/user/:id/full` |
| Value changes | Static mock | ✅ `/api/v/changes` (polls economy, computes delta) |
| Cache stats | Basic | Hits/misses/hit-rate + in-flight count |
| Thumbnail batch | 100/req | **Chunked 100/req** with full fallback |

## Quick Start

```bash
cd backend
npm install
npm start         # production
# or
npm run dev       # with nodemon auto-restart
```

Open **http://localhost:3000** — the backend serves the frontend automatically.

## Running frontend only (no Node)

Just open `frontend/index.html` directly in a browser.  
Falls back to demo data, direct pekora.zip calls (may CORS-block), and no WebSocket.

## API Routes

### Health
```
GET  /api/health          — uptime
GET  /api/ready           — readiness probe
GET  /api/status          — pekora.zip latency + WS client count
```

### Catalog
```
GET  /api/catalog/search        — search items (pass ?keyword=, ?sortType=, ?category=, ?limit=)
GET  /api/catalog/item/:id      — single item details
GET  /api/catalog/featured      — featured items (sortType=2)
GET  /api/catalog/limiteds      — limiteds (sortType=1)
```

### Economy
```
GET  /api/economy/asset/:id           — resale data + RAP
GET  /api/economy/asset/:id/resellers — active resellers
GET  /api/economy/asset/:id/sales     — sales history
GET  /api/economy/user/:id/currency   — Robux balance (auth)
GET  /api/economy/trades              — trade inbox (auth)
GET  /api/economy/trade/:id           — single trade
```

### Users
```
GET  /api/users/me               — current user (auth)
GET  /api/users/:id              — user by ID
GET  /api/users/search?keyword=  — search users
GET  /api/users/:id/inventory    — full inventory
GET  /api/users/:id/collectibles — limiteds only
GET  /api/users/:id/friends      — friends list
GET  /api/users/:id/avatar       — avatar details
```

### Thumbnails
```
GET   /api/thumbnails/assets        — single/batch asset thumbnails
POST  /api/thumbnails/batch         — body: { assetIds: [...], size: '150x150' }
GET   /api/thumbnails/user/:id      — user avatar thumbnail
GET   /api/thumbnails/game/:id      — game icon
```

### Games
```
GET  /api/games             — popular games list
GET  /api/games/:id         — game by universe ID
GET  /api/games/:id/servers — active servers
GET  /api/games/search      — search games
```

### Groups / Presence / Avatar
```
GET   /api/groups/:id           — group details
GET   /api/groups/:id/members   — member list
GET   /api/groups/user/:userId  — groups a user belongs to
POST  /api/presence/users       — body: { userIds: [...] }
GET   /api/avatar/metadata      — avatar metadata
```

### Compound routes (single HTTP call = multiple upstream calls)
```
GET  /api/homepage        — catalog + games + featured in parallel
GET  /api/item/:id/full   — catalog + economy + resellers + thumbnail
GET  /api/user/:id/full   — user + collectibles + currency + avatar
GET  /api/v/changes       — value changes delta for top items
```

### Cache
```
GET     /api/cache/stats  — hit rate, key count, in-flight, WS clients
DELETE  /api/cache        — flush all (or ?key=X for single key)
```

## Authentication

Log into **pekora.zip** in the same browser before opening the dashboard.  
The backend forwards your session cookie to all authenticated endpoints.

## WebSocket

Connect to `ws://localhost:3000` — server pushes:
- `{ type: 'connected' }` — on connect
- `{ type: 'activity', user, item, kind, amt, emoji, ts }` — every ~7s

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | 3000 | HTTP + WS port |
| `PEKORA_BASE` | https://www.pekora.zip/apisite | API base URL |
| `FETCH_TIMEOUT` | 9000 | Upstream fetch timeout (ms) |
