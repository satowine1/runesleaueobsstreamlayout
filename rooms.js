// rooms.js
export function createRoomState() {
  return {
    scoreA: 0,
    scoreB: 0,
    nameA: 'Player A',
    nameB: 'Player B',
    highlightCard: null,
    highlightMode: 'card',
    battlefieldA: null,
    battlefieldB: null,
    timer: {
      running: false,
      startEpochMs: null,
      elapsedMs: 0,
      direction: 'up',
      setMs: 3600000
    }
  };
}

export function getElapsedMs(timer) {
  if (!timer.running) return timer.elapsedMs;
  const now = Date.now();
  return timer.elapsedMs + (now - (timer.startEpochMs ?? now));
}

export function getDisplayMs(timer) {
  const elapsed = getElapsedMs(timer);
  return timer.direction === 'down' ? timer.setMs - elapsed : elapsed;
}

export function startTimer(timer) {
  if (timer.running) return;
  timer.running = true;
  timer.startEpochMs = Date.now();
}

export function pauseTimer(timer) {
  if (!timer.running) return;
  timer.elapsedMs = getElapsedMs(timer);
  timer.running = false;
  timer.startEpochMs = null;
}

export function resetTimer(timer) {
  timer.running = false;
  timer.startEpochMs = null;
  timer.elapsedMs = 0;
}

export function setTimer(timer, ms) {
  const wasRunning = timer.running;
  timer.running = false;
  timer.startEpochMs = null;
  const safeMs = Math.max(0, ms);
  if (timer.direction === 'down') {
    timer.setMs = safeMs;
    timer.elapsedMs = 0;
  } else {
    timer.elapsedMs = safeMs;
    timer.setMs = safeMs;
  }
  if (wasRunning) startTimer(timer);
}
