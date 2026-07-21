# Vacanza in bici 2026 — minisito

Sito statico (HTML/CSS/JS, nessuna build necessaria) generato dal foglio
`Vacanza 2026.xlsx`, foglio "Itinerario 2026" + "Costi preparatori 2026" + "Totali 2026".

## Contenuto

- `index.html` — pagina unica con 5 sezioni: Panoramica, Itinerario, Mappa, Costi, Prenotazioni
- `css/style.css` — stile
- `js/data.js` — dati del viaggio (generati da `build_data.py`), esposti come `window.TRIP_DATA`
- `js/app.js` — logica: grafici (Chart.js), mappa (Leaflet), tabelle, stato scadenze pagamenti
- `data/trip.json` — stessa struttura dati in JSON puro (comodo per riusare i dati altrove)
- `build_data.py` — script Python che rigenera `data/trip.json` e `js/data.js` a partire dal file Excel
- `js/routes.js` / `data/routes.json` — tracciati GPX reali delle tappe in bici/barca
- `build_routes.py` — script Python che rigenera i tracciati a partire dai file `.gpx`

Librerie caricate da CDN (cdnjs): Leaflet 1.9.4, Chart.js 4.4.0. Nessuna build, nessuna dipendenza da installare per usare il sito.

## Anteprima in locale

Basta aprire `index.html` col doppio click: funziona anche offline (i dati sono incorporati
in `js/data.js`, non serve un server). Serve connessione solo per caricare le librerie CDN
e le mappe (tile OpenStreetMap).

## Aggiornare i dati

Se modifichi `Vacanza 2026.xlsx`, rigenera i dati con:

```bash
python3 build_data.py
```

(richiede `openpyxl`: `pip install openpyxl --break-system-packages` se non è già installato)

## Pubblicare su GitHub Pages

Repository: **jBrigmann/vacanzina2026**

1. Apri il Terminale e vai in questa cartella (già dentro iCloud/Vacanze):

   ```bash
   cd "~/Library/Mobile Documents/com~apple~CloudDocs/famiglia/Vacanze/vacanzina2026"
   ```

2. Inizializza git e collega il repository già creato su GitHub:

   ```bash
   git init
   git add .
   git commit -m "Minisito vacanza 2026"
   git branch -M main
   git remote add origin https://github.com/jBrigmann/vacanzina2026.git
   git push -u origin main
   ```

3. Nel repository su GitHub: Settings → Pages → Source → seleziona il branch `main`
   e la cartella `/ (root)` → Save.
4. Dopo circa un minuto il sito sarà raggiungibile su `https://jbrigmann.github.io/vacanzina2026/`.

## Percorsi sulla mappa

Le 7 tappe in bici/barca (4–10 agosto) mostrano ora il tracciato GPX reale (da Komoot),
caricato da `data/routes.json` / `js/routes.js` e generato da `build_routes.py` a partire
dai file `.gpx` nella cartella `Vacanze`. Le linee tratteggiate restano solo per le tratte
in treno (giorno 1 e giorno 11) e per i giorni senza traccia GPX. Se aggiungi altri GPX,
rilancia:

```bash
python3 build_routes.py
```

I file GPX vanno numerati `01_...gpx`..`07_...gpx` nello stesso ordine delle tappe: la
corrispondenza con i giorni del viaggio è per posizione (1° file → 1° giorno con tappa in
bici, ecc.), non per nome file.

## Note sui dati

- I totali (trasporti, vitto, alloggio, costi preparatori) sono ricalcolati dai dati
  originali e coincidono con il foglio "Totali 2026" (totale viaggio: € 3.074,58).
- La riga "Appartamento vista parco" (7 agosto) è un'alternativa considerata ma non
  prenotata (prezzo indicato in nota, non conteggiato nel totale) — nel sito compare
  con etichetta "alternativa".
- Le scadenze di pagamento ("Addebito previsto il ...") vengono confrontate con la
  data odierna del visitatore per mostrare lo stato (scaduto / in scadenza entro 7
  giorni / futuro).
