// decks.js — import CSV decklist da Carde.io + matching contro il provider carte attivo
import { listCards, searchTyped, getCardDetail } from './providers.js';

// ── CSV parsing (campi quotati, virgole/virgolette interne) ──
function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

export function parseDecksCsv(text) {
  const lines = text.split(/\r\n|\n/).filter(l => l.length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]);
  const idx = name => header.indexOf(name);

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    if (f.length < header.length) continue;
    const userId = f[idx('user__id')];
    if (!userId) continue;
    rows.push({
      userId,
      userLabel:      f[idx('user__best_identifier')] || userId,
      deckName:       f[idx('deck_name')] || '',
      format:         f[idx('format')] || '',
      domainIdentity: f[idx('domain_identity')] || '',
      sectionKey:     f[idx('section__key')] || '',
      cardName:       f[idx('card__name')] || '',
      cardQuantity:   parseInt(f[idx('card__quantity')], 10) || 1,
      cardType:       f[idx('card__type')] || '',
      cardRarity:     f[idx('card__rarity')] || '',
      cardSetCode:    f[idx('card__set_code')] || '',
    });
  }
  return rows;
}

// ── Concorrenza limitata (nessuna dipendenza esterna) ──
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function pickImage(card) {
  return {
    image: card.image_thumb?.large ?? card.image_thumb?.medium ?? card.image ?? '',
    resolved: true,
  };
}

// ── Matching: Unit / Spell / Gear / Rune (main, rune_pool, sideboard, champion) ──
async function resolveGeneric(name, setCode, rarity) {
  const tryQuery = (setId) => listCards({ q: name, setId, limit: 10 });

  let candidates = (await tryQuery(setCode)).filter(c => c.name === name);

  if (candidates.length === 0 && setCode.includes('-')) {
    const trimmedSet = setCode.split('-')[0];
    candidates = (await tryQuery(trimmedSet)).filter(c => c.name === name);
  }

  if (candidates.length === 0) {
    candidates = (await tryQuery(undefined)).filter(c => c.name === name);
  }

  if (candidates.length === 0) return { image: '', resolved: false };
  if (candidates.length === 1) return pickImage(candidates[0]);

  const wantVariant = rarity === 'Showcase';
  const preferred = candidates.find(c => (wantVariant ? !!c.variant : !c.variant));
  return pickImage(preferred || candidates[0]);
}

// ── Matching: Legend / Battlefield (ricerca per tipo, nomi spesso diversi tra provider) ──
async function resolveTyped(name, type, setCode) {
  const attempts = [name];
  if (name.includes(',')) {
    const parts = name.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      attempts.push(parts[parts.length - 1]);
      attempts.push(parts[0]);
    }
  }

  let candidates = [];
  for (const q of attempts) {
    candidates = await searchTyped({ q, types: type, limit: 10 });
    if (candidates.length) break;
  }
  if (candidates.length === 0) return { image: '', resolved: false };

  const chosen = candidates.find(c => c.set_id === setCode) || candidates[0];
  let image = chosen.thumbnail_url || '';
  try {
    const detail = await getCardDetail(chosen.card_id);
    image = detail.image_thumb?.large ?? detail.image_thumb?.medium ?? image;
  } catch { /* usa il thumbnail già ottenuto */ }

  return { image, resolved: true };
}

function cardKeyOf(r) {
  return `${r.sectionKey === 'legend' || r.sectionKey === 'battlefield' ? 'typed' : 'generic'}::${r.cardType}::${r.cardSetCode}::${r.cardName}`;
}

export async function buildDeckLibrary(rows) {
  const uniqueMap = new Map();
  for (const r of rows) {
    const key = cardKeyOf(r);
    if (!uniqueMap.has(key)) uniqueMap.set(key, r);
  }
  const uniqueRows = [...uniqueMap.values()];

  const resolvedList = await mapWithConcurrency(uniqueRows, 6, async (r) => {
    const isTyped = r.sectionKey === 'legend' || r.sectionKey === 'battlefield';
    return isTyped
      ? resolveTyped(r.cardName, r.cardType, r.cardSetCode)
      : resolveGeneric(r.cardName, r.cardSetCode, r.cardRarity);
  });

  const resolvedByKey = new Map();
  uniqueRows.forEach((r, i) => resolvedByKey.set(cardKeyOf(r), resolvedList[i]));

  const users = new Map();
  for (const r of rows) {
    if (!users.has(r.userId)) {
      users.set(r.userId, {
        userId: r.userId,
        userLabel: r.userLabel,
        deckName: r.deckName,
        format: r.format,
        domainIdentity: r.domainIdentity,
        legend: null,
        champion: null,
        main: [],
        battlefields: [],
        runes: [],
        sideboard: [],
      });
    }
    const deck = users.get(r.userId);
    const resolved = resolvedByKey.get(cardKeyOf(r)) ?? { image: '', resolved: false };
    const card = { name: r.cardName, image: resolved.image, quantity: r.cardQuantity, resolved: resolved.resolved };

    switch (r.sectionKey) {
      case 'legend':     deck.legend = card; break;
      case 'champion':   deck.champion = card; break;
      case 'main':       deck.main.push(card); break;
      case 'battlefield':deck.battlefields.push(card); break;
      case 'rune_pool':  deck.runes.push(card); break;
      case 'sideboard':  deck.sideboard.push(card); break;
      default: break;
    }
  }

  let unresolvedCount = 0;
  const unresolvedSamples = [];
  for (const r of uniqueRows) {
    const resolved = resolvedByKey.get(cardKeyOf(r));
    if (!resolved.resolved) {
      unresolvedCount++;
      if (unresolvedSamples.length < 20) {
        unresolvedSamples.push({ name: r.cardName, type: r.cardType, setCode: r.cardSetCode });
      }
    }
  }

  return {
    library: users,
    summary: {
      users: users.size,
      uniqueCards: uniqueRows.length,
      resolved: uniqueRows.length - unresolvedCount,
      unresolved: unresolvedCount,
      unresolvedSamples,
    },
  };
}

// ── Libreria in-memory ──
let deckLibrary = new Map();

export function setDeckLibrary(map) {
  deckLibrary = map;
}

export function getDeck(userId) {
  return deckLibrary.get(String(userId)) ?? null;
}

export function listDecks() {
  return [...deckLibrary.values()].map(d => {
    const allCards = [...d.main, ...d.battlefields, ...d.runes, ...d.sideboard, d.legend, d.champion].filter(Boolean);
    return {
      userId: d.userId,
      userLabel: d.userLabel,
      deckName: d.deckName,
      format: d.format,
      mainCount: d.main.reduce((s, c) => s + c.quantity, 0),
      unresolvedCount: allCards.filter(c => !c.resolved).length,
    };
  });
}
