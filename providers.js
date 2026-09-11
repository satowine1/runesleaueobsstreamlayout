// providers.js — astrazione multi-provider per i dati carte.
// Normalizza Riftcodex e RiftScribe nella stessa forma (quella storica di RiftScribe),
// così il resto del codice (server.js, decks.js, admin.js) non deve sapere quale sia attivo.
import axios from 'axios';

const TIMEOUT = 6000;

const RIFTCODEX_BASE = 'https://api.riftcodex.com';
const RIFTSCRIBE_BASE = 'https://riftscribe.gg';

const PROVIDERS = {
  riftcodex:  { id: 'riftcodex',  label: 'Riftcodex' },
  riftscribe: { id: 'riftscribe', label: 'RiftScribe' },
};

let activeProvider = 'riftcodex';

export function listProviders() {
  return Object.values(PROVIDERS);
}

export function getActiveProvider() {
  return activeProvider;
}

export function setActiveProvider(id) {
  if (!PROVIDERS[id]) throw new Error(`Provider sconosciuto: ${id}`);
  activeProvider = id;
  return activeProvider;
}

// ── Stato di salute per-provider: aggiornato ad ogni chiamata reale (successo/fallimento)
//    e da un check periodico, così il pallino nell'admin riflette sia l'esito dell'ultimo
//    utilizzo sia i controlli automatici. ──
const health = {
  riftcodex:  { healthy: null, lastChecked: null },
  riftscribe: { healthy: null, lastChecked: null },
};

function markHealth(id, ok) {
  health[id] = { healthy: ok, lastChecked: new Date().toISOString() };
}

export function getHealth() {
  return {
    riftcodex:  { ...health.riftcodex },
    riftscribe: { ...health.riftscribe },
  };
}

// Esegue fn, marca lo stato di salute del provider in base all'esito.
// Se fallback non è undefined, in caso di errore lo ritorna invece di propagare l'eccezione.
async function withHealth(providerId, fn, fallback) {
  try {
    const result = await fn();
    markHealth(providerId, true);
    return result;
  } catch (err) {
    markHealth(providerId, false);
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

// ── Helpers Riftcodex: normalizzazione verso la forma storica RiftScribe ──
function extractKeywords(text) {
  if (!text) return [];
  const matches = [...text.matchAll(/\[([^\]]+)\]/g)].map(m => m[1].trim());
  return [...new Set(matches)].slice(0, 20);
}

function normalizeRiftcodexCard(c) {
  const img = c.media?.image_url ?? '';
  return {
    id: c.id,
    name: c.name,
    set_id: c.set?.set_id ?? '',
    collector_number: c.collector_number ?? null,
    variant: c.metadata?.alternate_art ? 'a' : '',
    rarity: c.classification?.rarity ?? '',
    type: c.classification?.type ?? '',
    faction: (c.classification?.domain?.[0] ?? '').toLowerCase(),
    domains: c.classification?.domain ?? [],
    stats: {
      energy: c.attributes?.energy ?? null,
      might:  c.attributes?.might  ?? null,
      power:  c.attributes?.power  ?? null,
    },
    image: img,
    image_thumb: { small: img, medium: img, large: img },
  };
}

function normalizeRiftcodexDetail(c) {
  return {
    description:  c.text?.plain   ?? '',
    flavor_text:  c.text?.flavour ?? '',
    keywords:     extractKeywords(c.text?.plain ?? ''),
    stats: {
      energy: c.attributes?.energy ?? null,
      might:  c.attributes?.might  ?? null,
      power:  c.attributes?.power  ?? null,
    },
    faction: (c.classification?.domain?.[0] ?? '').toLowerCase(),
    rarity:  c.classification?.rarity ?? '',
    image_thumb: { large: c.media?.image_url ?? '', medium: c.media?.image_url ?? '' },
  };
}

const DOMAINS = ['fury', 'calm', 'mind', 'body', 'chaos', 'order'];

// ── Adapter: Riftcodex ──
const riftcodex = {
  getFilters() {
    return withHealth('riftcodex', async () => {
      const { data } = await axios.get(`${RIFTCODEX_BASE}/sets`, { timeout: TIMEOUT });
      const sets = (data.items || []).map(s => s.set_id).filter(Boolean);
      return { sets, factions: DOMAINS };
    }, { sets: [], factions: DOMAINS });
  },

  listCards({ q, setId, faction, limit = 20 } = {}) {
    return withHealth('riftcodex', async () => {
      const url = q ? `${RIFTCODEX_BASE}/cards/name` : `${RIFTCODEX_BASE}/cards`;
      const params = { size: Math.min(limit, 100) };
      if (q) params.fuzzy = q;
      if (setId) params.set_id = setId;
      const { data } = await axios.get(url, { params, timeout: TIMEOUT });
      let items = (data.items || []).map(normalizeRiftcodexCard);
      if (faction) {
        const f = faction.toLowerCase();
        items = items.filter(c => c.domains.some(d => d.toLowerCase() === f));
      }
      return items.slice(0, limit);
    }, []);
  },

  searchTyped({ q, types, limit = 20 } = {}) {
    return withHealth('riftcodex', async () => {
      const { data } = await axios.get(`${RIFTCODEX_BASE}/cards/name`, {
        params: { fuzzy: q, size: 100 }, timeout: TIMEOUT
      });
      return (data.items || [])
        .filter(c => c.classification?.type === types)
        .slice(0, limit)
        .map(c => ({
          card_id: c.id,
          name: c.name,
          set_id: c.set?.set_id ?? '',
          thumbnail_url: c.media?.image_url ?? '',
        }));
    }, []);
  },

  getCardDetail(id) {
    return withHealth('riftcodex', async () => {
      const { data } = await axios.get(`${RIFTCODEX_BASE}/cards/${encodeURIComponent(id)}`, { timeout: TIMEOUT });
      return normalizeRiftcodexDetail(data);
    });
  },
};

// ── Adapter: RiftScribe (forma storica, passthrough) ──
const riftscribe = {
  getFilters() {
    return withHealth('riftscribe', async () => {
      const { data } = await axios.get(`${RIFTSCRIBE_BASE}/api/cards/filters`, { timeout: TIMEOUT });
      return { sets: data.sets || [], factions: data.factions || [] };
    }, { sets: [], factions: [] });
  },

  listCards({ q, setId, faction, limit = 20 } = {}) {
    return withHealth('riftscribe', async () => {
      const params = { limit };
      if (q) params.q = q;
      if (setId) params.set_id = setId;
      if (faction) params.faction = faction;
      const { data } = await axios.get(`${RIFTSCRIBE_BASE}/api/cards`, { params, timeout: TIMEOUT });
      return Array.isArray(data) ? data : [];
    }, []);
  },

  searchTyped({ q, types, limit = 20 } = {}) {
    return withHealth('riftscribe', async () => {
      const { data } = await axios.get(`${RIFTSCRIBE_BASE}/api/cards/search`, {
        params: { q, types, limit }, timeout: TIMEOUT
      });
      return Array.isArray(data) ? data : [];
    }, []);
  },

  getCardDetail(id) {
    return withHealth('riftscribe', async () => {
      const { data } = await axios.get(`${RIFTSCRIBE_BASE}/api/cards/${encodeURIComponent(id)}`, { timeout: TIMEOUT });
      return data;
    });
  },
};

const ADAPTERS = { riftcodex, riftscribe };

function current() {
  return ADAPTERS[activeProvider];
}

// ── API pubblica usata da server.js (proxy) e decks.js (matching CSV) ──
export function getFilters()      { return current().getFilters(); }
export function listCards(opts)   { return current().listCards(opts); }
export function searchTyped(opts) { return current().searchTyped(opts); }
export function getCardDetail(id) { return current().getCardDetail(id); }

// ── Health check periodico (indipendente dal provider attivo: controlla entrambi) ──
async function checkProviderHealth(id) {
  try {
    await ADAPTERS[id].getFilters();
  } catch { /* già marcato da withHealth */ }
}

export async function checkAllProvidersHealth() {
  await Promise.all(Object.keys(ADAPTERS).map(checkProviderHealth));
  return getHealth();
}

const HEALTH_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minuti
checkAllProvidersHealth();
setInterval(checkAllProvidersHealth, HEALTH_CHECK_INTERVAL_MS);
