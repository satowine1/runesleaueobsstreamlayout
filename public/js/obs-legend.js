import { getRoomId, connectWS } from '/client.js';

const player = new URL(location.href).searchParams.get('player')?.toUpperCase() === 'B' ? 'B' : 'A';
const roomId = getRoomId();
let currentId = null;
const root = document.getElementById('legRoot');

function render(state) {
  const card = state[`legend${player}`] ?? null;
  const id   = card?.id ?? null;
  if (id === currentId) return;
  currentId = id;

  if (!card) { root.innerHTML = ''; return; }

  root.innerHTML = `
    <div class="leg-wrap">
      <div class="leg-img-clip">
        <img src="${card.image}" alt="">
        <div class="leg-overlay">
          <div class="leg-name">${card.name}</div>
        </div>
      </div>
    </div>`;
}

connectWS(roomId, render);
