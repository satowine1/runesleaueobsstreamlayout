import { getRoomId, connectWS } from '/client.js';

const roomId = getRoomId();

let cardsById = new Map();
let currentId = null;
const root = document.getElementById('hlRoot');

async function loadCards() {
  const res = await fetch('/api/cards');
  const cards = await res.json();
  cardsById = new Map(cards.map(c => [c.id, c]));
}

function render(state) {
  const id = state.highlightCardId;
  if (id === currentId) return;
  currentId = id;

  if (!id) {
    root.innerHTML = '';
    return;
  }

  const card = cardsById.get(id);
  if (!card) return;

  root.innerHTML = `
    <div class="obs-hl-wrap">
      <img class="obs-hl-img" src="${card.image}" alt="">
      <div class="obs-hl-info">
        <div class="obs-hl-tag">Highlight</div>
        <div class="obs-hl-name">${card.name}</div>
      </div>
    </div>`;
}

await loadCards();
connectWS(roomId, render);
