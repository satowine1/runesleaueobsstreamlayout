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
- **Timer:**       http://localhost:3000/obs-timer.html?room=ABCD
- **Score A:**     http://localhost:3000/obs-scoreA.html?room=ABCD
- **Score B:**     http://localhost:3000/obs-scoreB.html?room=ABCD
- **Highlight:**   http://localhost:3000/obs-highlight.html?room=ABCD
- **Battlefield A/B:** http://localhost:3000/obs-battlefield.html?player=A&room=ABCD (o `player=B`)
- **Legend A/B:**      http://localhost:3000/obs-legend.html?player=A&room=ABCD (o `player=B`)
- **Decklist A/B:**    http://localhost:3000/obs-decklist.html?player=A&room=ABCD (o `player=B`)

## Carte
La ricerca carte (highlight, battlefield, legend) è live su [RiftScribe](https://riftscribe.gg), proxata dal server.
`public/cards.json` è legacy e non più usato dal flusso principale.

## Liste mazzo (decklist)
Dall'admin, sezione "Liste Mazzi": carica il CSV bulk esportato da Carde.io (dashboard organizzatore, tab Players).
Il server risolve automaticamente ogni carta contro RiftScribe (nome + set + tipo) per recuperare le immagini,
poi puoi assegnare il mazzo di un utente importato al Player A e/o B tramite il dialog di ricerca.
La sorgente OBS `obs-decklist.html` mostra la composizione visuale del mazzo assegnato (Legend, Champion, Main Deck,
Battlefields, Rune) — layout orizzontale, sfondo trasparente, nessun testo aggiunto, carte non tagliate.

⚠️ Sia il CSV (`decks.csv`) sia i mazzi risolti sono **non tracciati da git / in-memory**: vanno ricaricati ad ogni
riavvio del server, e il CSV contiene dati personali dei partecipanti (non va committato).

## Novità rispetto alla versione precedente
- **Tablet unificato**: schermo diviso, Player A in alto e Player B in basso (ruotato 180°). Timer al centro.
- **Nomi giocatori**: impostabili dall'admin, sincronizzati su tutti i client in tempo reale.
- **Timer impostabile e bidirezionale**: valore MM:SS applicabile, direzione su/giù.
- **Highlight OBS**: 3 modalità (tooltip/card/detail), transizione **wipe diagonale** ad ogni cambio carta.
- **Battlefield / Legend**: overlay dedicati per player A/B, assegnabili dall'admin con ricerca live su RiftScribe.
- **Decklist**: import CSV torneo + overlay OBS con la composizione visuale del mazzo per player A/B.
- **Design**: font Barlow Condensed, palette dark con accento oro, micro-animazioni su punteggio.

## Shortcut tastiera (Admin)
- `Spazio` → Start / Pause timer
- `R` → Reset timer
