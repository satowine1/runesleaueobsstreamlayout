import { getRoomId, connectWS } from '/client.js';

const roomId = getRoomId();
let currentId   = null;
let currentMode = null;
const root = document.getElementById('hlRoot');

const WIPE_MS = 550;

function render(state) {
  const card = state.highlightCard;
  const mode = state.highlightMode ?? 'card';
  const id   = card?.id ?? null;

  if (id === currentId && mode === currentMode) return;
  currentId   = id;
  currentMode = mode;

  swapTo(card ? buildHtml(card, mode) : '');
}

function buildHtml(card, mode) {
  switch (mode) {
    case 'tooltip': return tooltipHtml(card);
    case 'detail':  return detailHtml(card);
    default:        return cardHtml(card);
  }
}

// ── Wipe diagonale: la nuova carta entra sopra, rivelandosi con un taglio obliquo
//    che scorre da sinistra a destra e copre quella precedente (ferma sotto). ──
function swapTo(html) {
  const oldEl = root.firstElementChild;

  if (oldEl) {
    oldEl.style.position = 'absolute';
    oldEl.style.top = '0';
    oldEl.style.left = '0';
    oldEl.style.margin = '0';
    oldEl.style.animation = 'none';
    setTimeout(() => oldEl.remove(), WIPE_MS + 50);
  }

  if (!html) return;

  const tmp = document.createElement('div');
  tmp.innerHTML = html.trim();
  const newEl = tmp.firstElementChild;
  newEl.style.animation = `hlWipeIn ${WIPE_MS}ms cubic-bezier(0.65, 0, 0.35, 1) both`;
  root.appendChild(newEl);
}

function tooltipHtml(card) {
  return `
    <div class="obs-hl-wrap">
      <img class="obs-hl-img" src="${card.image}" alt="">
      <div class="obs-hl-info">
        <div class="obs-hl-tag">Highlight</div>
        <div class="obs-hl-name">${card.name}</div>
      </div>
    </div>`;
}

function cardHtml(card) {
  return `
    <div class="obs-hl-card-only">
      <img src="${card.image}" alt="">
    </div>`;
}

function detailHtml(card) {
  const metaItems = [card.faction, card.rarity].filter(Boolean);
  const metaHtml = metaItems.length
    ? `<div class="obs-hl-meta">${metaItems.map(m => `<span class="obs-hl-badge">${m}</span>`).join('')}</div>`
    : '';

  const s = card.stats;
  const statsHtml = s
    ? `<div class="obs-hl-stats">
        ${s.energy != null ? `<div class="obs-hl-stat"><div class="obs-hl-stat-val">${s.energy}</div><div class="obs-hl-stat-lbl">Energia</div></div>` : ''}
        ${s.might  != null ? `<div class="obs-hl-stat"><div class="obs-hl-stat-val">${s.might}</div><div class="obs-hl-stat-lbl">Might</div></div>` : ''}
        ${s.power  != null ? `<div class="obs-hl-stat"><div class="obs-hl-stat-val">${s.power}</div><div class="obs-hl-stat-lbl">Power</div></div>` : ''}
      </div>`
    : '';

  const keywordsHtml = card.keywords?.length
    ? `<div class="obs-hl-keywords">${card.keywords.map(k => `<span class="obs-hl-keyword">${k}</span>`).join('')}</div>`
    : '';

  const descHtml   = card.description ? `<div class="obs-hl-description">${card.description}</div>` : '';
  const flavorHtml = card.flavorText  ? `<div class="obs-hl-flavor">${card.flavorText}</div>`        : '';

  return `
    <div class="obs-hl-wrap">
      <img class="obs-hl-img" src="${card.image}" alt="">
      <div class="obs-hl-info detail">
        <div class="obs-hl-tag">Highlight</div>
        <div class="obs-hl-name">${card.name}</div>
        ${metaHtml}
        ${statsHtml}
        ${keywordsHtml}
        ${descHtml}
        ${flavorHtml}
      </div>
    </div>`;
}

connectWS(roomId, render);
