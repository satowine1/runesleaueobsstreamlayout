import { getRoomId, connectWS, formatMs } from '/client.js';
import axios from '/vendor/esm/axios.min.js';

const roomId = getRoomId();
document.getElementById('roomBadge').textContent = roomId;

// ── Links ──
const links = [
  { label: 'Timer src',     path: 'obs-timer.html' },
  { label: 'Score A',       path: 'obs-scoreA.html' },
  { label: 'Score B',       path: 'obs-scoreB.html' },
  { label: 'Highlight src', path: 'obs-highlight.html' },
  { label: 'Battlefield A', path: 'obs-battlefield.html?player=A' },
  { label: 'Battlefield B', path: 'obs-battlefield.html?player=B' },
  { label: 'Legend A',      path: 'obs-legend.html?player=A' },
  { label: 'Legend B',      path: 'obs-legend.html?player=B' },
  { label: 'Tablet',        path: 'tablet.html' },
];
const linksRow = document.getElementById('linksRow');
for (const l of links) {
  const a = document.createElement('a');
  a.className = 'link-badge'; a.target = '_blank';
  const sep = l.path.includes('?') ? '&' : '?';
  a.href = `/${l.path}${sep}room=${encodeURIComponent(roomId)}`;
  a.textContent = l.label;
  linksRow.appendChild(a);
}

// ── State ──
let lastState = null, localDisplayMs = 0;

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
const searchInput     = document.getElementById('searchInput');
const searchBtn       = document.getElementById('searchBtn');
const searchStatusEl  = document.getElementById('searchStatus');
const filterSetEl     = document.getElementById('filterSet');
const filterFaction1El = document.getElementById('filterFaction1');
const filterFaction2El = document.getElementById('filterFaction2');

// ── RiftScribe filters ──
async function loadFilters() {
  try {
    const { data } = await axios.get('/api/proxy/cards/filters');
    for (const s of (data.sets || [])) {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      filterSetEl.appendChild(opt);
    }
    const factionOpts = (data.factions || []).map(f => {
      const o = document.createElement('option'); o.value = f; o.textContent = f; return o;
    });
    for (const o of factionOpts) {
      filterFaction1El.appendChild(o.cloneNode(true));
      filterFaction2El.appendChild(o.cloneNode(true));
    }
  } catch { /* silently fail */ }
}

// ── RiftScribe search ──
async function searchCards(query) {
  const q   = query.trim();
  const setId = filterSetEl.value;
  const f1  = filterFaction1El.value;
  const f2  = filterFaction2El.value;
  if (!q && !setId && !f1 && !f2) return;
  searchStatusEl.textContent = 'Ricerca in corso…';
  searchBtn.disabled = true;
  cardsGrid.innerHTML = '';
  try {
    const buildParams = (faction) => {
      const p = { limit: 20 };
      if (q)       p.q       = q;
      if (setId)   p.set_id  = setId;
      if (faction) p.faction = faction;
      return p;
    };
    let raw;
    if (f1 && f2) {
      const [r1, r2] = await Promise.all([
        axios.get('/api/proxy/cards', { params: buildParams(f1) }),
        axios.get('/api/proxy/cards', { params: buildParams(f2) }),
      ]);
      const seen = new Set();
      raw = [...(r1.data || []), ...(r2.data || [])].filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id); return true;
      });
    } else {
      const { data } = await axios.get('/api/proxy/cards', { params: buildParams(f1 || f2) });
      raw = data || [];
    }
    const items = raw.map(c => ({
      id:          c.id,
      name:        c.name,
      image:       c.image_thumb?.medium ?? c.image_thumb?.small ?? '',
      riftboundId: c.set_id && c.collector_number ? `${c.set_id}-${String(c.collector_number).padStart(3,'0')}` : (c.set_id ?? ''),
      type:        c.type ?? ''
    }));
    if (items.length === 0) {
      searchStatusEl.textContent = 'Nessuna carta trovata.';
    } else {
      const shown = items.length;
      searchStatusEl.textContent = `${shown} carta${shown !== 1 ? 'e' : ''} trovata${shown !== 1 ? '' : ''}`;
    }
    renderCards(items);
  } catch {
    searchStatusEl.textContent = 'Errore durante la ricerca.';
  } finally {
    searchBtn.disabled = false;
  }
}

// ── Card grid ──
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
        <div class="card-id">${c.riftboundId || c.type}</div>
      </div>`;
    div.addEventListener('click', async () => {
      let detail = {};
      try {
        const { data: d } = await axios.get(`/api/proxy/cards/${c.id}`);
        detail = {
          description: d.description ?? '',
          flavorText:  d.flavor_text  ?? '',
          keywords:    d.keywords     ?? [],
          stats:       d.stats        ?? null,
          faction:     d.faction      ?? '',
          rarity:      d.rarity       ?? '',
        };
      } catch { /* invia senza dettagli */ }
      ws.send('highlight:set', {
        cardId:          c.id,
        cardName:        c.name,
        cardImage:       c.image,
        cardRiftboundId: c.riftboundId,
        ...detail
      });
    });
    cardsGrid.appendChild(div);
  }
  updateCardSelection(lastState?.highlightCard?.id ?? null);
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

  localDisplayMs = state.timer.displayMs;
  timerValEl.textContent = formatMs(localDisplayMs);

  const live = state.timer.running;
  timerStateEl.textContent = live ? 'Live' : 'Pause';
  timerBadgeEl.classList.toggle('live', live);
  timerDotEl.classList.toggle('live', live);

  const card = state.highlightCard ?? null;
  if (card) {
    hlActiveWrap.style.display = 'flex';
    hlNoneLabel.style.display = 'none';
    hlActiveImg.src = card.image;
    hlActiveName.textContent = card.name;
    hlActiveId.textContent = card.riftboundId || card.id;
  } else {
    hlActiveWrap.style.display = 'none';
    hlNoneLabel.style.display = 'block';
  }
  updateCardSelection(card?.id ?? null);

  if (state.nameA && !nameAEl.matches(':focus')) nameAEl.value = state.nameA;
  if (state.nameB && !nameBEl.matches(':focus')) nameBEl.value = state.nameB;

  const mode = state.highlightMode ?? 'card';
  document.querySelectorAll('.btn-mode').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const dir = state.timer.direction ?? 'up';
  document.querySelectorAll('.btn-dir').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.dir === dir);
  });

  updateBfSlot('A', state.battlefieldA ?? null);
  updateBfSlot('B', state.battlefieldB ?? null);

  updateLegSlot('A', state.legendA ?? null);
  updateLegSlot('B', state.legendB ?? null);
}

function tick() {
  if (!lastState?.timer?.running) return;
  localDisplayMs += lastState.timer.direction === 'down' ? -250 : 250;
  timerValEl.textContent = formatMs(localDisplayMs);
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

// ── Player names ──
function sendNames() {
  ws.send('player:names', { nameA: nameAEl.value, nameB: nameBEl.value });
}
nameAEl.addEventListener('blur', sendNames);
nameAEl.addEventListener('keydown', e => { if (e.key === 'Enter') { sendNames(); nameAEl.blur(); } });
nameBEl.addEventListener('blur', sendNames);
nameBEl.addEventListener('keydown', e => { if (e.key === 'Enter') { sendNames(); nameBEl.blur(); } });

// ── Battlefield ──
const bfSearchInput = document.getElementById('bfSearchInput');
const bfSearchBtn   = document.getElementById('bfSearchBtn');
const bfStatusEl    = document.getElementById('bfSearchStatus');
const bfResultsEl   = document.getElementById('bfResults');

async function searchBattlefields(query) {
  const q = query.trim();
  if (q.length < 2) { bfStatusEl.textContent = 'Inserisci almeno 2 caratteri.'; return; }
  bfStatusEl.textContent = 'Ricerca in corso…';
  bfSearchBtn.disabled = true;
  bfResultsEl.innerHTML = '';
  try {
    const { data } = await axios.get('/api/proxy/cards/search', {
      params: { q, types: 'Battlefield', limit: 20 }
    });
    const items = data || [];
    bfStatusEl.textContent = items.length ? `${items.length} risultati` : 'Nessun battlefield trovato.';
    renderBfResults(items);
  } catch {
    bfStatusEl.textContent = 'Errore durante la ricerca.';
  } finally {
    bfSearchBtn.disabled = false;
  }
}

function renderBfResults(items) {
  bfResultsEl.innerHTML = '';
  for (const c of items) {
    const div = document.createElement('div');
    div.className = 'bf-result-item';
    div.innerHTML = `
      <img src="${c.thumbnail_url || ''}" alt="">
      <div class="bf-result-name">${c.name}</div>
      <div class="bf-assign-btns">
        <button class="btn-accent" data-who="A">A</button>
        <button class="btn-accent" data-who="B">B</button>
      </div>`;
    div.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', async () => {
        const who = btn.dataset.who;
        let image = c.thumbnail_url || '';
        try {
          const { data: d } = await axios.get(`/api/proxy/cards/${c.card_id}`);
          image = d.image_thumb?.large ?? d.image_thumb?.medium ?? image;
        } catch { }
        ws.send('battlefield:set', { who, cardId: c.card_id, cardName: c.name, cardImage: image });
      });
    });
    bfResultsEl.appendChild(div);
  }
}

function updateBfSlot(who, card) {
  const el = document.getElementById(`bfCard${who}`);
  if (card) {
    el.innerHTML = `<img src="${card.image}" alt=""><div class="bf-slot-name">${card.name}</div>`;
  } else {
    el.innerHTML = `<span class="bf-empty">(nessuno)</span>`;
  }
}

bfSearchBtn.addEventListener('click', () => searchBattlefields(bfSearchInput.value));
bfSearchInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchBattlefields(bfSearchInput.value); });
document.getElementById('clearBfA').addEventListener('click', () => ws.send('battlefield:set', { who: 'A', cardId: null }));
document.getElementById('clearBfB').addEventListener('click', () => ws.send('battlefield:set', { who: 'B', cardId: null }));

// ── Legend ──
const legSearchInput = document.getElementById('legSearchInput');
const legSearchBtn   = document.getElementById('legSearchBtn');
const legStatusEl    = document.getElementById('legSearchStatus');
const legResultsEl   = document.getElementById('legResults');

async function searchLegends(query) {
  const q = query.trim();
  if (q.length < 2) { legStatusEl.textContent = 'Inserisci almeno 2 caratteri.'; return; }
  legStatusEl.textContent = 'Ricerca in corso…';
  legSearchBtn.disabled = true;
  legResultsEl.innerHTML = '';
  try {
    const { data } = await axios.get('/api/proxy/cards/search', {
      params: { q, types: 'Legend', limit: 20 }
    });
    const items = data || [];
    legStatusEl.textContent = items.length ? `${items.length} risultati` : 'Nessuna legend trovata.';
    renderLegResults(items);
  } catch {
    legStatusEl.textContent = 'Errore durante la ricerca.';
  } finally {
    legSearchBtn.disabled = false;
  }
}

function renderLegResults(items) {
  legResultsEl.innerHTML = '';
  for (const c of items) {
    const div = document.createElement('div');
    div.className = 'leg-result-item';
    div.innerHTML = `
      <img src="${c.thumbnail_url || ''}" alt="">
      <div class="leg-result-name">${c.name}</div>
      <div class="leg-assign-btns">
        <button class="btn-accent" data-who="A">A</button>
        <button class="btn-accent" data-who="B">B</button>
      </div>`;
    div.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', async () => {
        const who = btn.dataset.who;
        let image = c.thumbnail_url || '';
        try {
          const { data: d } = await axios.get(`/api/proxy/cards/${c.card_id}`);
          image = d.image_thumb?.large ?? d.image_thumb?.medium ?? image;
        } catch { }
        ws.send('legend:set', { who, cardId: c.card_id, cardName: c.name, cardImage: image });
      });
    });
    legResultsEl.appendChild(div);
  }
}

function updateLegSlot(who, card) {
  const el = document.getElementById(`legCard${who}`);
  if (card) {
    el.innerHTML = `<img src="${card.image}" alt=""><div class="leg-slot-name">${card.name}</div>`;
  } else {
    el.innerHTML = `<span class="leg-empty">(nessuno)</span>`;
  }
}

legSearchBtn.addEventListener('click', () => searchLegends(legSearchInput.value));
legSearchInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchLegends(legSearchInput.value); });
document.getElementById('clearLegA').addEventListener('click', () => ws.send('legend:set', { who: 'A', cardId: null }));
document.getElementById('clearLegB').addEventListener('click', () => ws.send('legend:set', { who: 'B', cardId: null }));

// ── Mode buttons ──
document.querySelectorAll('.btn-mode').forEach(btn => {
  btn.addEventListener('click', () => ws.send('highlight:mode', { mode: btn.dataset.mode }));
});

// ── Direction buttons ──
document.querySelectorAll('.btn-dir').forEach(btn => {
  btn.addEventListener('click', () => ws.send('timer:direction', { direction: btn.dataset.dir }));
});

// ── Search ──
loadFilters();
searchBtn.addEventListener('click', () => searchCards(searchInput.value));
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchCards(searchInput.value); });

// ── Keyboard shortcuts ──
window.addEventListener('keydown', e => {
  if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
  if (e.key === ' ') {
    e.preventDefault();
    if (lastState?.timer?.running) ws.send('timer:pause'); else ws.send('timer:start');
  }
  if (e.key === 'r' || e.key === 'R') ws.send('timer:reset');
});

setInterval(tick, 250);
