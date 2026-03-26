// server.js
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  createRoomState,
  getElapsedMs,
  startTimer,
  pauseTimer,
  resetTimer,
  setTimer
} from './rooms.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

const rooms = new Map();

// Load cards once at startup
const cardsPath = path.join(__dirname, 'public', 'cards.json');
let CARDS = [];
try { CARDS = JSON.parse(fs.readFileSync(cardsPath, 'utf8')); } catch { CARDS = []; }

app.get('/api/cards', (_, res) => res.json(CARDS));

function ensureRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { state: createRoomState(), clients: new Set() });
  }
  return rooms.get(roomId);
}

function roomSnapshot(roomId) {
  const { state: s } = ensureRoom(roomId);
  return {
    type:            'state',
    roomId,
    scoreA:          s.scoreA,
    scoreB:          s.scoreB,
    nameA:           s.nameA,
    nameB:           s.nameB,
    highlightCardId: s.highlightCardId,
    timer: {
      running:   s.timer.running,
      elapsedMs: getElapsedMs(s.timer)
    }
  };
}

function broadcast(roomId) {
  const { clients } = ensureRoom(roomId);
  const msg = JSON.stringify(roomSnapshot(roomId));
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

function safeRoomId(raw) {
  const c = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  return c || 'DEFAULT';
}

wss.on('connection', (ws, req) => {
  const url    = new URL(req.url, `http://${req.headers.host}`);
  const roomId = safeRoomId(url.searchParams.get('room'));
  const room   = ensureRoom(roomId);
  room.clients.add(ws);

  ws.send(JSON.stringify(roomSnapshot(roomId)));

  ws.on('message', data => {
    let msg;
    try { msg = JSON.parse(String(data)); } catch { return; }

    const { state } = ensureRoom(roomId);

    switch (msg.type) {
      case 'score:add': {
        const who   = msg.who === 'B' ? 'B' : 'A';
        const delta = Number(msg.delta) || 0;
        if (who === 'A') state.scoreA += delta; else state.scoreB += delta;
        broadcast(roomId); break;
      }
      case 'score:reset': {
        state.scoreA = 0; state.scoreB = 0;
        broadcast(roomId); break;
      }
      case 'timer:start': { startTimer(state.timer); broadcast(roomId); break; }
      case 'timer:pause': { pauseTimer(state.timer); broadcast(roomId); break; }
      case 'timer:reset': { resetTimer(state.timer); broadcast(roomId); break; }
      case 'timer:set': {
        const ms = Number(msg.elapsedMs);
        if (!isNaN(ms)) { setTimer(state.timer, ms); broadcast(roomId); }
        break;
      }
      case 'player:names': {
        if (msg.nameA && typeof msg.nameA === 'string') state.nameA = msg.nameA.slice(0, 40);
        if (msg.nameB && typeof msg.nameB === 'string') state.nameB = msg.nameB.slice(0, 40);
        broadcast(roomId); break;
      }
      case 'highlight:set': {
        const id = msg.cardId ?? null;
        if (id === null) { state.highlightCardId = null; broadcast(roomId); break; }
        if (CARDS.some(c => c.id === id)) { state.highlightCardId = id; broadcast(roomId); }
        break;
      }
      default: break;
    }
  });

  ws.on('close', () => {
    room.clients.delete(ws);
    if (room.clients.size === 0 && roomId !== 'DEFAULT') rooms.delete(roomId);
  });
});

server.listen(PORT, () => {
  console.log(`\n  ✦ OBS Room Overlay running on http://localhost:${PORT}\n`);
  console.log(`  Admin:      http://localhost:${PORT}/admin.html?room=ABCD`);
  console.log(`  Tablet:     http://localhost:${PORT}/tablet.html?room=ABCD`);
  console.log(`  Timer src:  http://localhost:${PORT}/obs-timer.html?room=ABCD`);
  console.log(`  Score A:    http://localhost:${PORT}/obs-scoreA.html?room=ABCD`);
  console.log(`  Score B:    http://localhost:${PORT}/obs-scoreB.html?room=ABCD`);
  console.log(`  Highlight:  http://localhost:${PORT}/obs-highlight.html?room=ABCD\n`);
});
