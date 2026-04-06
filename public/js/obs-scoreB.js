import { getRoomId, connectWS } from '/client.js';

const el = document.getElementById('scoreB');
connectWS(getRoomId(), s => { el.textContent = s.scoreB; });
