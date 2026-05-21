import { getRoomId, connectWS, formatMs } from '/client.js';

const roomId = getRoomId();

const scoreAEl     = document.getElementById('scoreA');
const scoreBEl     = document.getElementById('scoreB');
const scoreMiniA   = document.getElementById('scoreMiniA');
const scoreMiniB   = document.getElementById('scoreMiniB');
const timerDispEl  = document.getElementById('timerDisplay');
const timerLiveRow = document.getElementById('timerLiveRow');
const timerDotEl   = document.getElementById('timerDot');
const timerLiveLabel = document.getElementById('timerLiveLabel');
const nameAEl      = document.getElementById('nameA');
const nameBEl      = document.getElementById('nameB');
const nameLabelA   = document.getElementById('nameLabelA');
const nameLabelB   = document.getElementById('nameLabelB');

let lastState = null;
let localElapsedMs = 0;
let prevScoreA = 0, prevScoreB = 0;

function bump(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function renderState(state) {
  if (state.scoreA !== prevScoreA) { bump(scoreAEl); prevScoreA = state.scoreA; }
  if (state.scoreB !== prevScoreB) { bump(scoreBEl); prevScoreB = state.scoreB; }

  scoreAEl.textContent  = state.scoreA;
  scoreBEl.textContent  = state.scoreB;
  scoreMiniA.textContent = state.scoreA;
  scoreMiniB.textContent = state.scoreB;

  localElapsedMs = state.timer.displayMs;
  timerDispEl.textContent = formatMs(localElapsedMs);

  const live = state.timer.running;
  timerLiveLabel.textContent = live ? 'LIVE' : 'PAUSE';
  timerLiveRow.classList.toggle('live', live);
  timerDotEl.classList.toggle('live', live);

  if (state.nameA) { nameAEl.textContent = state.nameA; nameLabelA.textContent = state.nameA; }
  if (state.nameB) { nameBEl.textContent = state.nameB; nameLabelB.textContent = state.nameB; }
}

function tick() {
  if (!lastState?.timer?.running) return;
  localElapsedMs += lastState.timer.direction === 'down' ? -250 : 250;
  timerDispEl.textContent = formatMs(localElapsedMs);
}

const ws = connectWS(roomId, state => { lastState = state; renderState(state); });

document.getElementById('aPlusBtn').addEventListener('click',  () => ws.send('score:add', { who: 'A', delta:  1 }));
document.getElementById('aMinusBtn').addEventListener('click', () => ws.send('score:add', { who: 'A', delta: -1 }));
document.getElementById('bPlusBtn').addEventListener('click',  () => ws.send('score:add', { who: 'B', delta:  1 }));
document.getElementById('bMinusBtn').addEventListener('click', () => ws.send('score:add', { who: 'B', delta: -1 }));

setInterval(tick, 250);
