import { getRoomId, connectWS } from '/client.js';

const el = document.getElementById('scoreA');
connectWS(getRoomId(), s => { el.textContent = s.scoreA; });
