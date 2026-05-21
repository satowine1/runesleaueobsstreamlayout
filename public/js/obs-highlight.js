import { getRoomId, connectWS } from '/client.js';

const roomId = getRoomId();
let currentId   = null;
let currentMode = null;
const root = document.getElementById('hlRoot');

function render(state) {
  const card = state.highlightCard;
  const mode = state.highlightMode ?? 'card';
  const id   = card?.id ?? null;

  if (id === currentId && mode === currentMode) return;
  currentId   = id;
  currentMode = mode;

  if (!card) { root.innerHTML = ''; return; }

  switch (mode) {
    case 'tooltip': renderTooltip(card); break;
    case 'detail':  renderDetail(card);  break;
    default:        renderCard(card);    break;
  }
}

function renderTooltip(card) {
  root.innerHTML = `
    <div class="obs-hl-wrap">
      <img class="obs-hl-img" src="${card.image}" alt="">
      <div class="obs-hl-info">
        <div class="obs-hl-tag">Highlight</div>
        <div class="obs-hl-name">${card.name}</div>
      </div>
    </div>`;
}

function renderCard(card) {
  root.innerHTML = `
    <div class="obs-hl-card-only">
      <img src="${card.image}" alt="">
    </div>`;
}

function renderDetail(card) {
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

  root.innerHTML = `
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
