// public/client.js
export function getRoomId() {
  const url = new URL(window.location.href);
  return (url.searchParams.get("room") || "DEFAULT").toUpperCase();
}

export function connectWS(roomId, onState) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}/?room=${encodeURIComponent(roomId)}`;
  const ws = new WebSocket(wsUrl);

  ws.addEventListener("message", (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === "state") onState(msg);
    } catch {}
  });

  return {
    send(type, payload = {}) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, ...payload }));
      }
    },
    raw: ws
  };
}

export function formatMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
