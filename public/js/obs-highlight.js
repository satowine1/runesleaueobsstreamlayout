import { getRoomId, connectWS } from '/client.js';

const roomId = getRoomId();
let currentId = null;
const root = document.getElementById('hlRoot');

function render(state) {
  const card = state.highlightCard;
  const id = card?.id ?? null;
  if (id === currentId) return;
  currentId = id;

  if (!card) {
    root.innerHTML = '';
    return;
  }

  root.innerHTML = `
    <div class="obs-hl-wrap">
      <img class="obs-hl-img" src="${card.image}" alt="">
      <div class="obs-hl-info">
        <div class="obs-hl-tag">Highlight</div>
        <div class="obs-hl-name">${card.name}</div>
      </div>
    </div>`;
}

connectWS(roomId, render);
