import { getRoomId, connectWS, formatMs } from '/client.js';

const el = document.getElementById('timer');
let lastState = null, localMs = 0;

function tick() {
  if (lastState?.timer?.running) { localMs += 250; el.textContent = formatMs(localMs); }
}

connectWS(getRoomId(), s => {
  lastState = s; localMs = s.timer.elapsedMs; el.textContent = formatMs(localMs);
});

setInterval(tick, 250);
