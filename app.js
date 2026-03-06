// ============================================================
//  pekora.zip Trading Dashboard — App
//  Authentic Roblox 2017 UI, live pekora.zip API
// ============================================================

// ── MOCK DATA ────────────────────────────────────────────────
const MOCK = {
  catalog: [
    { id: 119418776,  name: "Dominus Infernus",         by: "Roblox",  price: "8,000,000", badge: "limited-u" },
    { id: 62571865,   name: "Sparkle Time Fedora",       by: "Roblox",  price: "42,000",    badge: "limited"   },
    { id: 11884330,   name: "Clockwork's Headphones",    by: "Roblox",  price: "25,000",    badge: null        },
    { id: 1117856536, name: "Winter's Crown",            by: "Roblox",  price: "180,000",   badge: "limited"   },
    { id: 19398,      name: "Perfectly Generic Object",  by: "Roblox",  price: "6,250,000", badge: "limited-u" },
    { id: 1081796,    name: "Valkyrie Helm",             by: "Roblox",  price: "19,000",    badge: null        },
    { id: 80109,      name: "Bucket o' Flames",          by: "Roblox",  price: "8,500",     badge: "limited"   },
    { id: 62228266,   name: "Frozen Time Fedora",        by: "Roblox",  price: "46,500",    badge: "limited"   },
    { id: 1365767,    name: "Red Sparkle Time Fedora",   by: "Roblox",  price: "220,000",   badge: "limited"   },
    { id: 302438829,  name: "Dominus Aureus",            by: "Roblox",  price: "1,300,000", badge: "limited-u" },
    { id: 1082173,    name: "Bling Bling Fedora",        by: "Roblox",  price: "34,500",    badge: null        },
    { id: 71485,      name: "Top Hat of Intelligence",   by: "Roblox",  price: "12,000",    badge: null        },
  ],
  valueChanges: [
    { name: "Dominus Rex",            rap: "320M",  val: "350M",  pct: "+9.4%",  dir: "up"   },
    { name: "Bucket o' Flames",       rap: "7,900", val: "9,500", pct: "+22.3%", dir: "up"   },
    { name: "Winter's Crown",         rap: "172K",  val: "180K",  pct: "+8.7%",  dir: "up"   },
    { name: "Sparkle Time Fedora",    rap: "38.5K", val: "42K",   pct: "+3.2%",  dir: "up"   },
    { name: "Frozen Time Fedora",     rap: "44K",   val: "46.5K", pct: "+5.7%",  dir: "up"   },
    { name: "Clockwork's Headphones", rap: "23.1K", val: "22.8K", pct: "-1.1%",  dir: "down" },
    { name: "Perfectly Generic",      rap: "6.0M",  val: "6.25M", pct: "-0.5%",  dir: "down" },
    { name: "Blue Valkyrie Helm",     rap: "310K",  val: "295K",  pct: "-4.8%",  dir: "down" },
  ],
  activity: [
    { user:"xX_NoobSlayer",  item:"Dominus Infernus",       type:"sold",   amt:"+8.0M", emoji:"😈", ago:"2m"  },
    { user:"pekora_fan99",   item:"Sparkle Time Fedora",    type:"bought", amt:"-42K",  emoji:"🎩", ago:"4m"  },
    { user:"rblx_trader",    item:"Winter's Crown",         type:"sold",   amt:"+180K", emoji:"👑", ago:"7m"  },
    { user:"limited_king",   item:"Valkyrie Helm",          type:"trade",  amt:"~19K",  emoji:"⚔️", ago:"11m" },
    { user:"ugc_hunter",     item:"Bucket o' Flames",       type:"bought", amt:"-8.5K", emoji:"🔥", ago:"14m" },
    { user:"trade_wizard",   item:"Perfectly Generic",      type:"sold",   amt:"+6.2M", emoji:"⬜", ago:"18m" },
  ],
  leaderboard: [
    { rank:1, name:"Roblox_Billionaire", value:"5.2B",  emoji:"👑" },
    { rank:2, name:"DominusCollector",   value:"3.8B",  emoji:"😈" },
    { rank:3, name:"LimitedKingXX",      value:"2.1B",  emoji:"💎" },
    { rank:4, name:"SparkleGod2024",     value:"987M",  emoji:"✨" },
    { rank:5, name:"pekora_whale",       value:"740M",  emoji:"🐋" },
    { rank:6, name:"ValkyrieFarmer",     value:"512M",  emoji:"⚔️" },
    { rank:7, name:"FedoraLord99",       value:"381M",  emoji:"🎩" },
    { rank:8, name:"UGCSniper",          value:"270M",  emoji:"🎯" },
  ],
  ticker: [
    { name:"Dominus Rex",           price:"350M",  pct:"+9.4%",  dir:"up"   },
    { name:"Sparkle Time",          price:"42K",   pct:"+3.2%",  dir:"up"   },
    { name:"Winter's Crown",        price:"180K",  pct:"+8.7%",  dir:"up"   },
    { name:"Clockwork Headphones",  price:"22.8K", pct:"-1.1%",  dir:"down" },
    { name:"Perfectly Generic",     price:"6.25M", pct:"-0.5%",  dir:"down" },
    { name:"Valkyrie Helm",         price:"19K",   pct:"+1.5%",  dir:"up"   },
    { name:"Frozen Time Fedora",    price:"46.5K", pct:"+5.7%",  dir:"up"   },
    { name:"Blue Valkyrie",         price:"295K",  pct:"-4.8%",  dir:"down" },
    { name:"Bucket o' Flames",      price:"9.5K",  pct:"+22.3%", dir:"up"   },
  ],
};

// ── STATE ────────────────────────────────────────────────────
const STATE = {
  apiOnline: false,
  currentUser: null,
  activeTab: 'limiteds',
  feed: [...MOCK.activity],
};

// ── UTILS ─────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const fmtN = n => {
  if (n == null) return '—';
  if (n >= 1e9) return (n/1e9).toFixed(1)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(1)+'M';
  if (n >= 1e3) return (n/1e3).toFixed(1)+'K';
  return n.toLocaleString();
};

// ── SKELETONS ────────────────────────────────────────────────
function skeletonGrid(n = 12) {
  return Array.from({length:n}, () => `
    <div class="sk-item-card">
      <div class="sk-thumb"></div>
      <div class="sk-line" style="margin-top:8px"></div>
      <div class="sk-line short"></div>
      <div class="sk-line short" style="margin-bottom:8px"></div>
    </div>
  `).join('');
}

// ── ITEM CARD RENDERING ──────────────────────────────────────
function thumbFor(item) {
  if (item.thumbnail) {
    return `<img class="item-card-thumb loaded" src="${item.thumbnail}" alt="${item.name}"
              onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'item-card-thumb-placeholder',textContent:'🎮'}))">`;
  }
  if (item.id && Number(item.id) > 100) {
    const src = `https://www.pekora.zip/apisite/thumbnails/v1/assets?assetId=${item.id}&width=150&height=150&format=Png`;
    return `<img class="item-card-thumb" src="${src}" alt="${item.name}"
              onload="this.classList.add('loaded')"
              onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'item-card-thumb-placeholder',textContent:'🎮'}))">`;
  }
  return `<span class="item-card-thumb-placeholder">🎮</span>`;
}

function badgeLabel(badge) {
  if (!badge) return '';
  const labels = { 'limited-u': 'Limited U', 'limited': 'Limited', 'sale': 'Sale', 'new': 'New' };
  return `<span class="item-label ${badge}">${labels[badge] || badge}</span>`;
}

function renderItemGrid(containerId, items) {
  const el = $(containerId);
  if (!el) return;
  if (!items?.length) {
    el.innerHTML = `<div class="empty-state">No items found</div>`;
    return;
  }
  el.innerHTML = items.map(item => `
    <div class="item-card-container" data-id="${item.id}" onclick="openItemModal(${item.id}, '${(item.name||'').replace(/'/g,"\\'")}')">
      <div class="item-card-thumb-container">
        ${thumbFor(item)}
        ${badgeLabel(item.badge)}
      </div>
      <div class="item-card-name" title="${item.name}">${item.name}</div>
      <div class="item-card-creator">By ${item.by || 'Roblox'}</div>
      <div class="item-card-price">
        ${item.price !== 'Off Sale'
          ? `<span class="robux-icon">R$</span><span>${item.price}</span>`
          : `<span class="price-off-sale">Off Sale</span>`
        }
      </div>
    </div>
  `).join('');
}

// ── VALUE CHANGES ────────────────────────────────────────────
function renderValueChanges(rows) {
  const tbody = $('value-changes-body');
  if (!tbody) return;
  const data = rows || MOCK.valueChanges;
  tbody.innerHTML = data.map(r => `
    <tr>
      <td class="col-name">${r.name}</td>
      <td class="col-num">${r.rap}</td>
      <td class="col-num">${r.val}</td>
      <td class="col-change">
        <span class="change-pill ${r.dir}">${r.dir==='up'?'▲':'▼'} ${r.pct||r.change}</span>
      </td>
    </tr>
  `).join('');
}

// ── ACTIVITY FEED ────────────────────────────────────────────
function renderActivityFeed() {
  const el = $('activity-feed');
  if (!el) return;
  el.innerHTML = STATE.feed.slice(0, 8).map(a => {
    const dir = a.amt?.startsWith('+') ? 'up' : a.amt?.startsWith('-') ? 'down' : 'neutral';
    return `
      <div class="activity-row">
        <div class="activity-emoji">${a.emoji}</div>
        <div class="activity-text">
          <strong>${a.user}</strong> ${a.type} <em>${a.item}</em>
        </div>
        <div class="activity-amount ${dir}">${a.amt}</div>
        <div class="activity-time">${a.ago}</div>
      </div>
    `;
  }).join('');
}

// ── LEADERBOARD ──────────────────────────────────────────────
function renderLeaderboard(users) {
  const el = $('leaderboard-list');
  if (!el) return;
  const list = users || MOCK.leaderboard;
  el.innerHTML = list.map((p, i) => {
    const r = p.rank || (i + 1);
    const rankCls = r===1?'gold':r===2?'silver':r===3?'bronze':'';
    return `
      <div class="lb-row" onclick="openUserProfile(${p.id||''})">
        <div class="lb-rank ${rankCls}">#${r}</div>
        <div class="lb-avatar">${p.emoji||'👤'}</div>
        <div class="lb-name">${p.name||p.displayName||'Unknown'}</div>
        <div class="lb-value">R$ ${p.value||fmtN(p.robuxAmount)||'—'}</div>
      </div>
    `;
  }).join('');
}

// ── TICKER ───────────────────────────────────────────────────
function renderTicker(data) {
  const el = $('ticker-track');
  if (!el) return;
  const items = data || MOCK.ticker;
  el.innerHTML = [...items, ...items].map(t => `
    <span class="ticker-item">
      <span class="name">${t.name}</span>
      <span class="price">R$ ${t.price}</span>
      <span class="change ${t.dir}">${t.dir==='up'?'▲':'▼'} ${t.pct||t.change}</span>
    </span>
  `).join('');
}

// ── GAMES ────────────────────────────────────────────────────
function renderGames(data) {
  const el = $('games-grid');
  if (!el) return;
  const list = data?.games || data?.data || (Array.isArray(data) ? data : []);
  if (!list.length) {
    el.innerHTML = `<div class="empty-state" style="grid-column:1/-1">Could not load games</div>`;
    return;
  }
  el.innerHTML = list.slice(0, 6).map(g => `
    <div class="game-card" onclick="window.open('https://www.pekora.zip/games/${g.placeId||g.id||''}','_blank')">
      <div class="game-thumb">🎮</div>
      <div class="game-info-bar">
        <div class="game-name">${g.name||g.title||'Unknown Game'}</div>
        <div class="game-meta">
          <span>👥 ${fmtN(g.playing||g.placeVisits||0)}</span>
          ${g.maxPlayers?`<span>max ${g.maxPlayers}</span>`:''}
        </div>
      </div>
    </div>
  `).join('');
}

// ── NORMALIZE API → display items ───────────────────────────
function normalizeItems(raw) {
  const list = raw?.data || raw?.Data || (Array.isArray(raw) ? raw : []);
  return list.map(item => ({
    id: item.id || item.Id,
    name: item.name || item.Name || 'Unknown',
    by: item.creatorName || item.Creator?.Name || 'Roblox',
    price: item.price != null ? item.price.toLocaleString()
         : item.Price != null ? item.Price.toLocaleString()
         : 'Off Sale',
    thumbnail: null,
    badge: item.itemRestrictions?.includes('LimitedUnique') ? 'limited-u'
         : item.itemRestrictions?.includes('Limited') ? 'limited'
         : null,
  }));
}

async function loadThumbnails(items) {
  const ids = items.map(i => i.id).filter(Boolean);
  if (!ids.length) return;
  try {
    const thumbs = await API.getThumbnails(ids, '150x150');
    items.forEach(item => { if (thumbs[item.id]) item.thumbnail = thumbs[item.id]; });
  } catch {}
}

// ── API STATUS ───────────────────────────────────────────────
function setStatus(online, ms) {
  const el = $('api-status');
  if (!el) return;
  if (online) {
    el.className = 'api-status-badge live';
    el.textContent = ms ? `Live · ${ms}ms` : 'Live';
  } else {
    el.className = 'api-status-badge';
    el.textContent = '⚠ Demo';
  }
}

// ── STAT COUNTERS ────────────────────────────────────────────
function animateCounter(id, target, suffix = '') {
  const el = $(id);
  if (!el) return;
  const dur = 1600, t0 = performance.now();
  const float = String(target).includes('.');
  const tick = now => {
    const p = Math.min((now - t0) / dur, 1);
    const v = target * (1 - Math.pow(1 - p, 3));
    el.textContent = (float ? v.toFixed(1) : Math.floor(v).toLocaleString()) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function setupCounters() {
  const bar = $('stats-bar');
  if (!bar) return;
  const obs = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    obs.disconnect();
    animateCounter('stat-items',   124832);
    animateCounter('stat-traders',  52410);
    animateCounter('stat-trades',    8.3, 'M');
    animateCounter('stat-volume',    4.7, 'B');
  }, { threshold: 0.2 });
  obs.observe(bar);
}

// ── TABS ─────────────────────────────────────────────────────
function setupTabs() {
  $$('#catalog-tabs .rbx-tab').forEach(tab => {
    tab.addEventListener('click', async () => {
      $$('#catalog-tabs .rbx-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      STATE.activeTab = tab.dataset.target;
      $('main-item-grid').innerHTML = skeletonGrid(12);

      try {
        if (!STATE.apiOnline) throw new Error('demo');
        let data;
        if (STATE.activeTab === 'limiteds') {
          data = await API.getCatalog({ category: 'Accessories', sortType: 1, limit: 24 });
        } else if (STATE.activeTab === 'ugc') {
          data = await API.getCatalog({ category: 'All', sortType: 3, limit: 24 });
        } else if (STATE.activeTab === 'top') {
          data = await API.getCatalog({ category: 'All', sortType: 5, limit: 24 });
        } else if (STATE.activeTab === 'new') {
          data = await API.getCatalog({ category: 'All', sortType: 0, limit: 24 });
        }
        const items = normalizeItems(data);
        if (items.length) {
          await loadThumbnails(items);
          renderItemGrid('main-item-grid', items);
        } else {
          renderItemGrid('main-item-grid', MOCK.catalog);
        }
      } catch {
        renderItemGrid('main-item-grid', MOCK.catalog);
      }
    });
  });
}

// ── SEARCH ───────────────────────────────────────────────────
window.doSearch = async function() {
  const q = $('nav-search-input')?.value?.trim();
  if (!q) return;
  const type = $('search-type')?.value || 'items';
  if (type === 'users') {
    try {
      const data = await API.searchUsers(q);
      const users = data?.data || [];
      $('main-item-grid').innerHTML = users.length
        ? users.map(u => `
            <div class="item-card-container" onclick="openUserProfile(${u.id})" style="cursor:pointer">
              <div class="item-card-thumb-container"><span class="item-card-thumb-placeholder">👤</span></div>
              <div class="item-card-name">${u.displayName||u.name}</div>
              <div class="item-card-creator">@${u.name}</div>
              <div class="item-card-price" style="font-size:11px;color:var(--rbx-blue)">View Profile →</div>
            </div>
          `).join('')
        : `<div class="empty-state">No players found for "${q}"</div>`;
    } catch {
      $('main-item-grid').innerHTML = `<div class="empty-state">Search unavailable in demo mode</div>`;
    }
  } else {
    window.open(`https://www.pekora.zip/catalog?Keyword=${encodeURIComponent(q)}`, '_blank');
  }
};

// ── ITEM MODAL ───────────────────────────────────────────────
window.openItemModal = async function(id, nameHint = '') {
  const modal = $('item-modal');
  const inner = $('item-modal-inner');
  if (!modal || !inner) return;

  modal.classList.add('open');
  inner.innerHTML = `
    <div class="modal-header-bar">
      <div class="modal-header-title">${nameHint || 'Loading…'}</div>
      <button class="modal-close-btn" onclick="closeItemModal()">✕</button>
    </div>
    <div class="spinner-wrap"><div class="spinner"></div>Loading item data…</div>
  `;

  try {
    const [catalogRes, economyRes] = await Promise.allSettled([
      API.getItem(id),
      API.getAssetEconomy(id),
    ]);
    const item    = catalogRes.status === 'fulfilled' ? catalogRes.value : null;
    const economy = economyRes.status === 'fulfilled' ? economyRes.value : null;

    const thumbs = await API.getThumbnails([id], '420x420').catch(() => ({}));
    const thumb  = thumbs[id];

    const name    = item?.name || nameHint || `Item #${id}`;
    const creator = item?.creatorName || 'Roblox';
    const price   = item?.price != null ? item.price.toLocaleString() : null;
    const rap     = economy?.recentAveragePrice;
    const sales   = economy?.sales;
    const remaining = economy?.remaining;

    inner.innerHTML = `
      <div class="modal-header-bar">
        <div class="modal-header-title">${name}</div>
        <button class="modal-close-btn" onclick="closeItemModal()">✕</button>
      </div>
      <div class="modal-body-grid">
        <div>
          <div class="modal-thumb-box">
            ${thumb
              ? `<img src="${thumb}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:3px">`
              : '<span style="font-size:56px">🎮</span>'}
          </div>
          ${item?.itemRestrictions?.length ? `
            <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">
              ${item.itemRestrictions.map(r => `<span class="item-label ${r==='LimitedUnique'?'limited-u':'limited'}" style="position:static;font-size:11px;padding:3px 7px;border-radius:3px">${r}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        <div>
          <div class="modal-item-name">${name}</div>
          <div class="modal-creator">By <a href="https://www.pekora.zip/users/1/profile" target="_blank">${creator}</a></div>
          <div class="modal-price-row">
            <div class="modal-price-big">
              <span class="robux-icon">R$</span>
              <span>${price ?? 'Off Sale'}</span>
            </div>
            ${rap != null ? `
              <div class="modal-rap-box">
                <div class="modal-rap-label">RAP</div>
                <div class="modal-rap-val">R$ ${fmtN(rap)}</div>
              </div>
            ` : ''}
          </div>
          ${item?.description ? `<div class="modal-desc">${item.description}</div>` : ''}
          <div class="modal-stats-row">
            ${sales != null ? `<div class="modal-stat-box"><div class="label">Total Sales</div><div class="val">${fmtN(sales)}</div></div>` : ''}
            ${remaining != null ? `<div class="modal-stat-box"><div class="label">Remaining</div><div class="val">${fmtN(remaining)}</div></div>` : ''}
            ${item?.favoriteCount != null ? `<div class="modal-stat-box"><div class="label">Favorites</div><div class="val">${fmtN(item.favoriteCount)}</div></div>` : ''}
          </div>
          <div class="modal-action-row">
            <a href="https://www.pekora.zip/catalog/${id}" target="_blank" class="btn-pekora" style="flex:1;justify-content:center">
              View on Pekora →
            </a>
            ${price ? `<a href="https://www.pekora.zip/catalog/${id}" target="_blank" class="btn-primary-rbx">Buy Now</a>` : ''}
          </div>
        </div>
      </div>
    `;
  } catch {
    inner.innerHTML = `
      <div class="modal-header-bar">
        <div class="modal-header-title">${nameHint || `Item #${id}`}</div>
        <button class="modal-close-btn" onclick="closeItemModal()">✕</button>
      </div>
      <div style="padding:40px;text-align:center;color:var(--rbx-text-dark)">
        <div style="font-size:36px;margin-bottom:12px">😕</div>
        <div style="margin-bottom:16px">Could not load item details.</div>
        <a href="https://www.pekora.zip/catalog/${id}" target="_blank" class="btn-pekora">View on Pekora →</a>
      </div>
    `;
  }
};

window.closeItemModal = function() {
  const m = $('item-modal');
  if (m) m.classList.remove('open');
};

window.openUserProfile = function(id) {
  if (id) window.open(`https://www.pekora.zip/users/${id}/profile`, '_blank');
};

// ── PLAYER LOOKUP ────────────────────────────────────────────
window.lookupPlayer = async function() {
  const input = $('player-lookup-input');
  const result = $('player-result');
  if (!input || !result) return;
  const q = input.value.trim();
  if (!q) return;

  result.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div>Searching…</div>`;

  try {
    let user = null;
    if (/^\d+$/.test(q)) {
      user = await API.getUser(q);
    } else {
      const res = await API.searchUsers(q);
      user = (res?.data || [])[0] || null;
    }

    if (!user) {
      result.innerHTML = `<div style="padding:12px;color:var(--rbx-text-dark);font-size:13px">No player found for "${q}"</div>`;
      return;
    }

    const [currencyRes, collectRes] = await Promise.allSettled([
      API.getUserCurrency(user.id),
      API.getUserCollectibles(user.id),
    ]);
    const currency = currencyRes.status === 'fulfilled' ? currencyRes.value : null;
    const collectibles = collectRes.status === 'fulfilled'
      ? (collectRes.value?.data?.length ?? collectRes.value?.length ?? 0)
      : null;

    result.innerHTML = `
      <div class="player-result-card">
        <div class="player-avi">👤</div>
        <div class="player-details">
          <div class="player-display">${user.displayName || user.name}</div>
          <div class="player-username">@${user.name}</div>
          <div class="player-stats-row">
            ${currency?.robux != null ? `
              <div class="player-stat-item">
                <div class="player-stat-label">Robux</div>
                <div class="player-stat-val" style="color:var(--rbx-green)">R$ ${fmtN(currency.robux)}</div>
              </div>
            ` : ''}
            ${collectibles != null ? `
              <div class="player-stat-item">
                <div class="player-stat-label">Limiteds</div>
                <div class="player-stat-val">${collectibles}</div>
              </div>
            ` : ''}
            ${user.created ? `
              <div class="player-stat-item">
                <div class="player-stat-label">Joined</div>
                <div class="player-stat-val">${new Date(user.created).getFullYear()}</div>
              </div>
            ` : ''}
          </div>
          <div style="margin-top:8px">
            <a href="https://www.pekora.zip/users/${user.id}/profile" target="_blank" class="btn-neutral-rbx" style="font-size:12px;padding:4px 10px">View Profile →</a>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    result.innerHTML = `<div style="padding:12px;color:var(--rbx-red);font-size:13px">Error: ${err.message}</div>`;
  }
};

// ── LIVE ACTIVITY PULSE ──────────────────────────────────────
function startActivityPulse() {
  const NAMES  = ['trade_wizard','xX_NoobSlayer','ugc_hunter','rblx_trader','pekora_fan99','limited_king','sparkle_god','dominus_lord'];
  const ITEMS  = ['Dominus Infernus','Sparkle Time Fedora',"Winter's Crown",'Valkyrie Helm',"Bucket o' Flames",'Clockwork Headphones','Frozen Time Fedora','Dominus Aureus'];
  const EMOJIS = ['💎','🎩','👑','🔥','⚔️','😈','✨','🐋','🎯'];
  const TYPES  = ['sold','bought','trade'];
  setInterval(() => {
    const dir = Math.random() > 0.45 ? '+' : '-';
    const amt = Math.floor(Math.random() * 300 + 1);
    STATE.feed.unshift({
      user:  NAMES[Math.random()*NAMES.length|0],
      item:  ITEMS[Math.random()*ITEMS.length|0],
      type:  TYPES[Math.random()*3|0],
      amt:   `${dir}${amt}K`,
      emoji: EMOJIS[Math.random()*EMOJIS.length|0],
      ago:   'just now',
    });
    if (STATE.feed.length > 12) STATE.feed.pop();
    renderActivityFeed();
  }, 6500);
}

// ── KEYBOARD ─────────────────────────────────────────────────
function setupKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeItemModal();
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      $('nav-search-input')?.focus();
    }
  });
  $('item-modal')?.addEventListener('click', e => {
    if (e.target === $('item-modal')) closeItemModal();
  });
  $('player-lookup-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') lookupPlayer();
  });
  $('nav-search-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });
}

// ── NAV USER UPDATE ──────────────────────────────────────────
function updateNavUser(user) {
  if (!user) return;
  const login  = $('nav-login');
  const signup = $('nav-signup');
  if (login) {
    login.textContent = user.displayName || user.name || 'Profile';
    login.href = `https://www.pekora.zip/users/${user.id}/profile`;
  }
  if (signup) signup.style.display = 'none';
}

// ── WINDOW SWITCH TAB ────────────────────────────────────────
window.switchTab = function(name) {
  const tab = document.querySelector(`[data-target="${name}"]`);
  if (tab) tab.click();
};

// ════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {

  // Show skeletons immediately
  $('main-item-grid').innerHTML = skeletonGrid(12);

  // Static renders
  renderValueChanges();
  renderActivityFeed();
  renderLeaderboard();
  renderTicker();

  // Placeholder games
  $('games-grid').innerHTML = Array.from({length:6},(_,i) => `
    <div class="game-card">
      <div class="game-thumb" style="background:var(--rbx-section-hi)"></div>
      <div class="game-info-bar">
        <div class="sk-line" style="margin:0 0 4px"></div>
        <div class="sk-line short" style="margin:0"></div>
      </div>
    </div>
  `).join('');

  // Setup interactions
  setupTabs();
  setupCounters();
  setupKeyboard();
  startActivityPulse();

  // ── WebSocket live-activity from backend ──
  API.onWS('activity', msg => {
    STATE.feed.unshift({
      user:  msg.user,
      item:  msg.item,
      type:  msg.kind,
      amt:   msg.amt,
      emoji: msg.emoji,
      ago:   'just now',
    });
    if (STATE.feed.length > 12) STATE.feed.pop();
    renderActivityFeed();
  });

  // ── API Status ──
  try {
    const status = await API.getStatus();
    STATE.apiOnline = status?.pekora === 'online';
    setStatus(STATE.apiOnline, status?.latencyMs);
  } catch {
    setStatus(false);
  }

  // ── Auth ──
  if (STATE.apiOnline) {
    API.getMe().then(u => {
      if (u) {
        STATE.currentUser = u;
        updateNavUser(u);
        // Show robux if we can
        API.getUserCurrency(u.id).then(c => {
          if (c?.robux != null) {
            const rb = $('nav-robux');
            const amt = $('nav-robux-amount');
            if (rb && amt) { rb.style.display = 'flex'; amt.textContent = fmtN(c.robux); }
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }

  // ── Catalog items ──
  try {
    const data = STATE.apiOnline
      ? await API.getCatalog({ category: 'Accessories', sortType: 1, limit: 24 })
      : null;
    const items = data ? normalizeItems(data) : [];
    if (items.length) {
      await loadThumbnails(items);
      renderItemGrid('main-item-grid', items);
    } else {
      renderItemGrid('main-item-grid', MOCK.catalog);
    }
  } catch {
    renderItemGrid('main-item-grid', MOCK.catalog);
  }

  // ── Games ──
  if (STATE.apiOnline) {
    API.getGames(6).then(data => renderGames(data)).catch(() => {
      $('games-grid').innerHTML = `<div class="empty-state">Games unavailable</div>`;
    });
  } else {
    $('games-grid').innerHTML = `<div class="empty-state">Connect to pekora.zip to see live games</div>`;
  }
});
