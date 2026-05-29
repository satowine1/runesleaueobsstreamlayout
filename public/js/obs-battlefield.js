import { getRoomId, connectWS } from '/client.js';

const player = new URL(location.href).searchParams.get('player')?.toUpperCase() === 'B' ? 'B' : 'A';
const roomId = getRoomId();
let currentId = null;
const root = document.getElementById('bfRoot');

function render(state) {
  const card = state[`battlefield${player}`] ?? null;
  const id   = card?.id ?? null;
  if (id === currentId) return;
  currentId = id;

  if (!card) { root.innerHTML = ''; return; }

  root.innerHTML = `
    <div class="bf-wrap">
      <div class="bf-img-clip">
        <img src="${card.image}" alt="">
        <div class="bf-overlay">
          <div class="bf-name">${card.name}</div>
        </div>
      </div>
    </div>`;
}

connectWS(roomId, render);
