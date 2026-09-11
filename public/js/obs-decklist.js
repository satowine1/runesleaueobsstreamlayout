import { getRoomId, connectWS } from '/client.js';

const player = new URL(location.href).searchParams.get('player')?.toUpperCase() === 'B' ? 'B' : 'A';
const roomId = getRoomId();
let currentUserId = undefined;
const root = document.getElementById('dlRoot');

const DEFAULT_DECK_STYLE = {
  legend:      { size: 130, gap: 12 },
  champion:    { size: 130, gap: 12 },
  main:        { size: 72,  gap: 6 },
  battlefield: { size: 72,  gap: 6 },
  rune:        { size: 72,  gap: 6 },
};

function applyStyle(style) {
  const s = style || DEFAULT_DECK_STYLE;
  for (const zone of Object.keys(DEFAULT_DECK_STYLE)) {
    const { size, gap } = s[zone] ?? DEFAULT_DECK_STYLE[zone];
    root.style.setProperty(`--size-${zone}`, `${size}px`);
    root.style.setProperty(`--gap-${zone}`, `${gap}px`);
  }
}

function tile(card, zoneClass) {
  if (!card) return '';
  const qty = card.quantity > 1 ? `<span class="dl-qty">×${card.quantity}</span>` : '';
  const body = (card.resolved && card.image)
    ? `<img src="${card.image}" alt="">`
    : `<div class="dl-tile-placeholder"></div>`;
  return `<div class="dl-tile dl-tile-${zoneClass}">${body}${qty}</div>`;
}

function render(state) {
  applyStyle(state.deckStyle);

  const deck = state[`deck${player}`] ?? null;
  const userId = deck?.userId ?? null;
  if (userId === currentUserId) return;
  currentUserId = userId;

  if (!deck) { root.innerHTML = ''; return; }

  const leftHtml = (deck.legend || deck.champion)
    ? `<div class="dl-left-col">${tile(deck.legend, 'legend')}${tile(deck.champion, 'champion')}</div>`
    : '';

  const mainHtml = deck.main?.length
    ? `<div class="dl-main-grid">${deck.main.map(c => tile(c, 'main')).join('')}</div>`
    : '';

  const bfHtml = deck.battlefields?.length
    ? `<div class="dl-bf-group">${deck.battlefields.map(c => tile(c, 'battlefield')).join('')}</div>`
    : '';

  const runesHtml = deck.runes?.length
    ? `<div class="dl-rune-group">${deck.runes.map(c => tile(c, 'rune')).join('')}</div>`
    : '';

  const bottomHtml = (bfHtml || runesHtml)
    ? `<div class="dl-bottom-row">${bfHtml}${runesHtml}</div>`
    : '';

  const rightHtml = (mainHtml || bottomHtml)
    ? `<div class="dl-right-col">${mainHtml}${bottomHtml}</div>`
    : '';

  root.innerHTML = `<div class="dl-wrap">${leftHtml}${rightHtml}</div>`;
}

connectWS(roomId, render);
