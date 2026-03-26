# OBS Room Overlay (vanilla JS)

## Run
```bash
npm install
npm start
```

## URLs (esempio room ABCD)
- **Admin:**      http://localhost:3000/admin.html?room=ABCD
- **Tablet:**     http://localhost:3000/tablet.html?room=ABCD  ← schermo diviso per i 2 giocatori

OBS (sorgenti separate):
- **Timer:**      http://localhost:3000/obs-timer.html?room=ABCD
- **Score A:**    http://localhost:3000/obs-scoreA.html?room=ABCD
- **Score B:**    http://localhost:3000/obs-scoreB.html?room=ABCD
- **Highlight:**  http://localhost:3000/obs-highlight.html?room=ABCD

## Carte
Modifica `public/cards.json` e metti i tuoi PNG in `public/assets/cards/`.

## Novità rispetto alla versione precedente
- **Tablet unificato**: schermo diviso, Player A in alto e Player B in basso (ruotato 180°). Timer al centro.
- **Nomi giocatori**: impostabili dall'admin, sincronizzati su tutti i client in tempo reale.
- **Timer impostabile**: nell'admin puoi scrivere un valore MM:SS e applicarlo (parte da quel punto).
- **Highlight OBS**: animazione di ingresso, stile broadcast con accento dorato.
- **Design**: font Barlow Condensed, palette dark con accento oro, micro-animazioni su punteggio.

## Shortcut tastiera (Admin)
- `Spazio` → Start / Pause timer
- `R` → Reset timer
