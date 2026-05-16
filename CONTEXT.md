# OBS Room Overlay — Contesto progetto

## Cos'è
Tool di overlay per OBS Studio usato durante tornei privati di **Riftbound** (TCG di Riot Games).
Gira come server Node.js locale (o su VPS), le pagine vengono usate come **Browser Source** in OBS.

## Stack
- **Backend:** Node.js + Express + ws (WebSocket), ES Modules (`type: module`)
- **Frontend:** Vanilla JS puro, nessun framework
- **Font:** Barlow Condensed + Barlow (Google Fonts)
- **Design:** Dark theme, accento oro `#e8c84a`, stile broadcast/esport

---

## Struttura file attuale

```
project/
├── server.js           # Entry point, gestisce WebSocket e HTTP
├── rooms.js            # Logica timer e stato room
├── package.json
├── README.md
└── public/
    ├── client.js       # Modulo condiviso: getRoomId(), connectWS(), formatMs()
    ├── styles.css      # CSS globale (design system)
    ├── cards.json      # Lista carte [{id, name, image}]
    ├── assets/cards/   # PNG delle carte
    ├── admin.html      # Pannello regia (controllo tutto)
    ├── tablet.html     # Schermo diviso per i 2 giocatori + timer centrale
    ├── obs-timer.html      # Sorgente OBS: timer
    ├── obs-scoreA.html     # Sorgente OBS: punteggio A
    ├── obs-scoreB.html     # Sorgente OBS: punteggio B
    ├── obs-highlight.html  # Sorgente OBS: carta in evidenza (animata)
    └── js/
        ├── admin.js
        ├── tablet.js
        ├── obs-highlight.js
        ├── obs-scoreA.js
        ├── obs-scoreB.js
        └── obs-timer.js
```

**File rimossi rispetto alla versione originale:**
- `player.html` — sostituito da `tablet.html` unificato
- `overlay.html` — non più necessario

---

## URL di utilizzo (esempio room ABCD)

```
Admin:      http://localhost:3000/admin.html?room=ABCD
Tablet:     http://localhost:3000/tablet.html?room=ABCD

OBS Sources:
  Timer:      http://localhost:3000/obs-timer.html?room=ABCD
  Score A:    http://localhost:3000/obs-scoreA.html?room=ABCD
  Score B:    http://localhost:3000/obs-scoreB.html?room=ABCD
  Highlight:  http://localhost:3000/obs-highlight.html?room=ABCD
```

---

## Sistema Room

- Ogni sessione è identificata da un **room ID** (query string `?room=XXXX`)
- Lo stato è in memoria (si azzera al riavvio del server)
- Le room vengono distrutte automaticamente quando tutti i client si disconnettono
- Nessuna autenticazione (uso privato/tornei interni)

---

## Stato sincronizzato via WebSocket

```js
{
  type: "state",
  roomId: "ABCD",
  scoreA: 0,
  scoreB: 0,
  nameA: "Player A",       // nome impostabile dall'admin
  nameB: "Player B",       // nome impostabile dall'admin
  highlightCard: null,     // { id, name, image, riftboundId } oppure null
  timer: {
    running: false,
    elapsedMs: 0
  }
}
```

## Messaggi WebSocket (client → server)

| Tipo | Payload | Descrizione |
|------|---------|-------------|
| `score:add` | `{ who: "A"\|"B", delta: ±1 }` | Modifica punteggio |
| `score:reset` | — | Reset entrambi i punteggi a 0 |
| `timer:start` | — | Avvia il timer |
| `timer:pause` | — | Mette in pausa il timer |
| `timer:reset` | — | Reset timer a 0 |
| `timer:set` | `{ elapsedMs: number }` | Imposta il timer a un valore specifico |
| `player:names` | `{ nameA: string, nameB: string }` | Aggiorna i nomi giocatori |
| `highlight:set` | `{ cardId, cardName, cardImage, cardRiftboundId }` oppure `{ cardId: null }` | Imposta/rimuove carta in evidenza |

---

## Funzionalità per pagina

### admin.html
- Topbar con room ID e link rapidi a tutte le pagine
- Gestione punteggi A/B con +/−
- Nomi giocatori editabili inline (si inviano su blur o Enter)
- Timer con start/pause/reset + campo per impostare valore MM:SS
- Indicatore stato timer (pallino rosso pulsante quando live)
- Griglia carte con ricerca (nome o ID)
- Selezione carta highlight con bordo dorato sulla carta attiva
- Preview highlight corrente con immagine e nome

### tablet.html
- Schermo diviso verticalmente: Player A in alto, Player B in basso
- Player B è ruotato 180° (ogni giocatore legge dal suo lato del tablet)
- Barra centrale fissa con: score mini di entrambi + timer + stato LIVE/PAUSE
- Pulsanti + e − grandi, touch-friendly
- Animazione "bump" sul numero quando il punteggio cambia
- Nomi giocatori aggiornati in real-time dall'admin

### obs-highlight.html
- Overlay trasparente per OBS
- Animazione ingresso (slide up + fade) ad ogni cambio carta
- Layout: immagine carta + tag "HIGHLIGHT" + nome carta
- Stile broadcast con accento oro

### obs-scoreA/B.html
- Semplice numero su sfondo semitrasparente con blur
- Background trasparente per OBS

### obs-timer.html
- Timer MM:SS con tick locale a 250ms
- Background trasparente per OBS

---

## Carte

Attualmente le carte sono gestite staticamente:
- `public/cards.json` — array `[{ id, name, image }]`
- Immagini PNG in `public/assets/cards/`

### API esterna disponibile: Riftcodex
- **URL:** `https://api.riftcodex.com`
- **Auth:** nessuna (open API)
- **Endpoint principale:** `GET /cards?set_id=ogn&size=100`
- **Ogni carta restituisce** tra le altre cose:
  - `media.image_url` — URL diretto all'immagine ✅
  - `name`, `riftbound_id`, `collector_number`
  - `classification` (tipo, rarità, domain)
  - `attributes` (energy, might, power)
  - `text.plain` / `text.rich` (testo regole)
  - `tags` (es. Freljord, Noxus...)
- **Ricerca:** per nome (exact/fuzzy), full-text sul testo, per set, per ID Riftbound
- **Idea di integrazione:** sync all'avvio del server, costruire l'array carte in memoria con dati da API invece che da `cards.json`

---

## Decisioni architetturali prese

- Nessun framework frontend (vanilla JS)
- Nessun bundler (ES Modules nativi)
- Le carte si caricano una volta all'avvio del server (`fs.readFileSync`)
- Le room non persistono (in memory only) — intenzionale per uso tornei
- `player.html` rimosso — tutto su `tablet.html` unico con schermo diviso
- Nessuna autenticazione — uso privato

---

## Prossimi passi pianificati

1. ~~**Separazione HTML/JS**~~ ✅ — JS estratto in `public/js/`, HTML puliti con `<script type="module" src="/js/...js">`
2. ~~**Integrazione Riftcodex API**~~ ✅ — Ricerca live su Riftcodex dall'admin. State WS ora contiene `highlightCard: { id, name, image, riftboundId }`. Axios servito da `/vendor/esm/axios.min.js`.
3. **Deploy su VPS** — Hetzner + nginx (reverse proxy con header Upgrade per WebSocket) + PM2

---

## Hosting consigliato

- **Provider:** Hetzner CAX11 (~4€/mese, ARM, datacenter EU)
- **Stack:** nginx (reverse proxy) + PM2 (process manager)
- **Nota critica nginx:** aggiungere header `Upgrade` per far passare i WebSocket:
  ```nginx
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  ```
- **HTTPS:** Let's Encrypt (gratuito)
- **Alternativa per eventi occasionali:** ngrok (tunnel temporaneo, no VPS necessario)

---

## Come riprendere il lavoro

Quando riapri questo progetto in Claude Code (VS Code), inizia con:

> "Leggi CONTEXT.md e continua da dove eravamo. Il prossimo passo è separare l'HTML dal JS nei file della cartella public/."
