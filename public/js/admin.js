import { getRoomId, connectWS, formatMs } from '/client.js';

const roomId = getRoomId();
document.getElementById('roomBadge').textContent = roomId;

// ── Links ──
const links = [
  { id: 'linkTimer',   label: 'Timer src',    path: 'obs-timer.html' },
  { id: 'linkScoreA',  label: 'Score A',      path: 'obs-scoreA.html' },
  { id: 'linkScoreB',  label: 'Score B',      path: 'obs-scoreB.html' },
  { id: 'linkHL',      label: 'Highlight src',path: 'obs-highlight.html' },
  { id: 'linkTablet',  label: 'Tablet',       path: 'tablet.html' },
];
const linksRow = document.getElementById('linksRow');
for (const l of links) {
  const a = document.createElement('a');
  a.className = 'link-badge'; a.target = '_blank';
  a.href = `/${l.path}?room=${encodeURIComponent(roomId)}`;
  a.textContent = l.label;
  linksRow.appendChild(a);
}

// ── State ──
let cards = [], cardsById = new Map(), lastState = null, localElapsedMs = 0;

// ── Elements ──
const scoreAEl       = document.getElementById('scoreA');
const scoreBEl       = document.getElementById('scoreB');
const timerValEl     = document.getElementById('timerVal');
const timerStateEl   = document.getElementById('timerStateLabel');
const timerBadgeEl   = document.getElementById('timerStateBadge');
const timerDotEl     = document.getElementById('timerDot');
const hlActiveWrap   = document.getElementById('hlActiveWrap');
const hlNoneLabel    = document.getElementById('hlNoneLabel');
const hlActiveImg    = document.getElementById('hlActiveImg');
const hlActiveName   = document.getElementById('hlActiveName');
const hlActiveId     = document.getElementById('hlActiveId');
const cardsGrid      = document.getElementById('cardsGrid');
const nameAEl        = document.getElementById('nameA');
const nameBEl        = document.getElementById('nameB');

// ── Cards ──
async function loadCards() {
  const res = await fetch('/api/cards');
  cards = await res.json();
  cardsById = new Map(cards.map(c => [c.id, c]));
  renderCards(cards);
}

function renderCards(list) {
  cardsGrid.innerHTML = '';
  for (const c of list) {
    const div = document.createElement('div');
    div.className = 'card-item';
    div.dataset.id = c.id;
    div.innerHTML = `
      <img src="${c.image}" alt="">
      <div>
        <div class="card-name">${c.name}</div>
        <div class="card-id">${c.id}</div>
      </div>`;
    div.addEventListener('click', () => ws.send('highlight:set', { cardId: c.id }));
    cardsGrid.appendChild(div);
  }
}

function updateCardSelection(cardId) {
  document.querySelectorAll('.card-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === cardId);
  });
}

// ── Render state ──
function renderState(state) {
  scoreAEl.textContent = state.scoreA;
  scoreBEl.textContent = state.scoreB;

  localElapsedMs = state.timer.elapsedMs;
  timerValEl.textContent = formatMs(localElapsedMs);

  const live = state.timer.running;
  timerStateEl.textContent = live ? 'Live' : 'Pause';
  timerBadgeEl.classList.toggle('live', live);
  timerDotEl.classList.toggle('live', live);

  const card = state.highlightCardId ? cardsById.get(state.highlightCardId) : null;
  if (card) {
    hlActiveWrap.style.display = 'flex';
    hlNoneLabel.style.display = 'none';
    hlActiveImg.src = card.image;
    hlActiveName.textContent = card.name;
    hlActiveId.textContent = card.id;
  } else {
    hlActiveWrap.style.display = 'none';
    hlNoneLabel.style.display = 'block';
  }
  updateCardSelection(state.highlightCardId);

  // sync player names if server sends them
  if (state.nameA && !nameAEl.matches(':focus')) nameAEl.value = state.nameA;
  if (state.nameB && !nameBEl.matches(':focus')) nameBEl.value = state.nameB;
}

function tick() {
  if (!lastState?.timer?.running) return;
  localElapsedMs += 250;
  timerValEl.textContent = formatMs(localElapsedMs);
}

// ── WS ──
const ws = connectWS(roomId, state => { lastState = state; renderState(state); });

// ── Score buttons ──
document.getElementById('aPlus').onclick  = () => ws.send('score:add', { who: 'A', delta:  1 });
document.getElementById('aMinus').onclick = () => ws.send('score:add', { who: 'A', delta: -1 });
document.getElementById('bPlus').onclick  = () => ws.send('score:add', { who: 'B', delta:  1 });
document.getElementById('bMinus').onclick = () => ws.send('score:add', { who: 'B', delta: -1 });
document.getElementById('resetScore').onclick = () => ws.send('score:reset');

// ── Timer buttons ──
document.getElementById('tStart').onclick = () => ws.send('timer:start');
document.getElementById('tPause').onclick = () => ws.send('timer:pause');
document.getElementById('tReset').onclick = () => ws.send('timer:reset');

// Timer set (MM:SS)
document.getElementById('tSetBtn').onclick = () => {
  const raw = document.getElementById('timerSetInput').value.trim();
  const parts = raw.split(':');
  let ms = 0;
  if (parts.length === 2) {
    ms = (parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10)) * 1000;
  } else {
    ms = parseInt(raw, 10) * 1000;
  }
  if (!isNaN(ms) && ms >= 0) ws.send('timer:set', { elapsedMs: ms });
};

// ── Highlight ──
document.getElementById('clearHL').onclick = () => ws.send('highlight:set', { cardId: null });

// ── Player names — send on blur/enter ──
function sendNames() {
  ws.send('player:names', { nameA: nameAEl.value, nameB: nameBEl.value });
}
nameAEl.addEventListener('blur', sendNames);
nameAEl.addEventListener('keydown', e => { if (e.key === 'Enter') { sendNames(); nameAEl.blur(); }});
nameBEl.addEventListener('blur', sendNames);
nameBEl.addEventListener('keydown', e => { if (e.key === 'Enter') { sendNames(); nameBEl.blur(); }});

// ── Search ──
document.getElementById('search').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  renderCards(q ? cards.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) : cards);
});

// ── Keyboard shortcuts ──
window.addEventListener('keydown', e => {
  if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
  if (e.key === ' ') {
    e.preventDefault();
    if (lastState?.timer?.running) ws.send('timer:pause'); else ws.send('timer:start');
  }
  if (e.key === 'r' || e.key === 'R') ws.send('timer:reset');
});

await loadCards();
setInterval(tick, 250);
