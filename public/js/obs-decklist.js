import { getRoomId, connectWS } from '/client.js';

const player = new URL(location.href).searchParams.get('player')?.toUpperCase() === 'B' ? 'B' : 'A';
const roomId = getRoomId();
let currentUserId = undefined;
const root = document.getElementById('dlRoot');

function tile(card, sizeClass) {
  if (!card) return '';
  const qty = card.quantity > 1 ? `<span class="dl-qty">×${card.quantity}</span>` : '';
  const body = (card.resolved && card.image)
    ? `<img src="${card.image}" alt="">`
    : `<div class="dl-tile-placeholder"></div>`;
  return `<div class="dl-tile ${sizeClass}">${body}${qty}</div>`;
}

function render(state) {
  const deck = state[`deck${player}`] ?? null;
  const userId = deck?.userId ?? null;
  if (userId === currentUserId) return;
  currentUserId = userId;

  if (!deck) { root.innerHTML = ''; return; }

  const leftHtml = (deck.legend || deck.champion)
    ? `<div class="dl-left-col">${tile(deck.legend, 'dl-tile-lg')}${tile(deck.champion, 'dl-tile-lg')}</div>`
    : '';

  const mainHtml = deck.main?.length
    ? `<div class="dl-main-grid">${deck.main.map(c => tile(c, 'dl-tile-sm')).join('')}</div>`
    : '';

  const bfHtml = deck.battlefields?.length
    ? `<div class="dl-bf-group">${deck.battlefields.map(c => tile(c, 'dl-tile-sm')).join('')}</div>`
    : '';

  const runesHtml = deck.runes?.length
    ? `<div class="dl-rune-group">${deck.runes.map(c => tile(c, 'dl-tile-sm')).join('')}</div>`
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
