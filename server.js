// server.js
import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

import {
  createRoomState,
  getElapsedMs,
  getDisplayMs,
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
app.use('/vendor', express.static(path.join(__dirname, 'node_modules/axios/dist')));

// ── RiftScribe proxy (evita CORS dal browser) ──
const RIFTSCRIBE = 'https://riftscribe.gg';

app.get('/api/proxy/cards/filters', async (_req, res) => {
  try {
    const { data } = await axios.get(`${RIFTSCRIBE}/api/cards/filters`);
    res.json(data);
  } catch (err) {
    res.status(err.response?.status ?? 502).json({ error: 'proxy error' });
  }
});

app.get('/api/proxy/cards', async (req, res) => {
  try {
    const { data } = await axios.get(`${RIFTSCRIBE}/api/cards`, { params: req.query });
    res.json(data);
  } catch (err) {
    res.status(err.response?.status ?? 502).json({ error: 'proxy error' });
  }
});

app.get('/api/proxy/cards/:cardId', async (req, res) => {
  try {
    const { data } = await axios.get(`${RIFTSCRIBE}/api/cards/${encodeURIComponent(req.params.cardId)}`);
    res.json(data);
  } catch (err) {
    res.status(err.response?.status ?? 502).json({ error: 'proxy error' });
  }
});

const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

const rooms = new Map();

function ensureRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { state: createRoomState(), clients: new Set() });
  }
  return rooms.get(roomId);
}

function roomSnapshot(roomId) {
  const { state: s } = ensureRoom(roomId);
  return {
    type:          'state',
    roomId,
    scoreA:        s.scoreA,
    scoreB:        s.scoreB,
    nameA:         s.nameA,
    nameB:         s.nameB,
    highlightCard: s.highlightCard,
    highlightMode: s.highlightMode,
    timer: {
      running:   s.timer.running,
      direction: s.timer.direction,
      displayMs: getDisplayMs(s.timer)
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
        const cardId = msg.cardId ?? null;
        if (cardId === null) {
          state.highlightCard = null;
          broadcast(roomId);
          break;
        }
        state.highlightCard = {
          id:          String(cardId).slice(0, 100),
          name:        typeof msg.cardName === 'string'        ? msg.cardName.slice(0, 100)        : '',
          image:       typeof msg.cardImage === 'string'       ? msg.cardImage.slice(0, 500)       : '',
          riftboundId: typeof msg.cardRiftboundId === 'string' ? msg.cardRiftboundId.slice(0, 50)  : '',
          description: typeof msg.description === 'string'     ? msg.description.slice(0, 2000)    : '',
          flavorText:  typeof msg.flavorText === 'string'      ? msg.flavorText.slice(0, 500)      : '',
          keywords:    Array.isArray(msg.keywords)             ? msg.keywords.slice(0, 20).map(k => String(k).slice(0, 50)) : [],
          stats:       msg.stats && typeof msg.stats === 'object' ? {
            energy: typeof msg.stats.energy === 'number' ? msg.stats.energy : null,
            might:  typeof msg.stats.might  === 'number' ? msg.stats.might  : null,
            power:  typeof msg.stats.power  === 'number' ? msg.stats.power  : null,
          } : null,
          faction:     typeof msg.faction === 'string'         ? msg.faction.slice(0, 50)          : '',
          rarity:      typeof msg.rarity  === 'string'         ? msg.rarity.slice(0, 50)           : '',
        };
        broadcast(roomId);
        break;
      }
      case 'timer:direction': {
        if (msg.direction === 'up' || msg.direction === 'down') {
          state.timer.direction = msg.direction;
          broadcast(roomId);
        }
        break;
      }
      case 'highlight:mode': {
        const allowed = ['tooltip', 'card', 'detail'];
        if (allowed.includes(msg.mode)) {
          state.highlightMode = msg.mode;
          broadcast(roomId);
        }
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
