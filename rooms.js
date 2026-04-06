// rooms.js
export function createRoomState() {
  return {
    scoreA: 0,
    scoreB: 0,
    nameA: 'Player A',
    nameB: 'Player B',
    highlightCard: null,
    timer: {
      running: false,
      startEpochMs: null,
      elapsedMs: 0
    }
  };
}

export function getElapsedMs(timer) {
  if (!timer.running) return timer.elapsedMs;
  const now = Date.now();
  return timer.elapsedMs + (now - (timer.startEpochMs ?? now));
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

export function setTimer(timer, elapsedMs) {
  const wasRunning = timer.running;
  timer.running = false;
  timer.startEpochMs = null;
  timer.elapsedMs = Math.max(0, elapsedMs);
  if (wasRunning) startTimer(timer);
}
