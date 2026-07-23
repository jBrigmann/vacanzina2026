(function () {
  "use strict";

  const DATA = window.TRIP_DATA;
  const EUR = (n) => (n == null ? "—" : n.toLocaleString("it-IT", { style: "currency", currency: "EUR" }));
  const TODAY = new Date(); // uses the visitor's local clock

  const CATEGORY_COLORS = {
    "trasporti": "#3f6fa8",
    "trasporto": "#3f6fa8",
    "vitto": "#1f9e8f",
    "alloggio": "#e08e1d",
    "attrezzatura cicloturismo": "#8e6fbe",
    "farmacia": "#d9564f",
    "abbigliamento tecnico": "#55b1c9",
    "elettronica": "#96a2ab",
  };
  const MODE_COLORS = {
    "treno": "#3f6fa8",
    "bici": "#1f9e8f",
    "barca": "#e08e1d",
    "traghetto": "#e08e1d",
    "vaporetto": "#c9762a",
  };

  // Nome della struttura come link al sito di prenotazione.
  function linkWithPreview(nome, link) {
    if (!link) return nome;
    return `<a href="${link}" target="_blank" rel="noopener">${nome}</a>`;
  }

  function colorFor(map, key, fallback) {
    if (!key) return fallback;
    return map[key.toLowerCase()] || fallback;
  }

  // ---------- Tabs ----------
  const tabButtons = document.querySelectorAll("nav.tabs button");
  const panels = document.querySelectorAll("section.panel");
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
      if (btn.dataset.tab === "mappa" && window._map) {
        // La scheda Mappa è nascosta (display:none) quando la pagina si
        // carica, quindi Leaflet calcola lo zoom su un contenitore di
        // dimensione zero. Bisogna ridimensionare E ricalcolare la vista
        // ("fitBounds") solo ora che il contenitore ha le dimensioni vere,
        // altrimenti resta uno zoom sbagliato/enorme.
        setTimeout(() => {
          window._map.invalidateSize();
          if (window._mapBounds && window._mapBounds.length) {
            window._map.fitBounds(window._mapBounds, { padding: [30, 30] });
          }
        }, 50);
      }
    });
  });

  // ---------- Italian date parsing for "Addebito previsto il 19 lug 2026" ----------
  const MONTHS_IT = {
    gen: 0, feb: 1, mar: 2, apr: 3, mag: 4, giu: 5,
    lug: 6, ago: 7, set: 8, ott: 9, nov: 10, dic: 11,
  };
  function parseItalianNoteDate(note) {
    if (!note || typeof note !== "string") return null;
    const m = note.match(/(\d{1,2})\s+([a-zA-Z]{3,4})\.?\s+(\d{4})/i);
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const monKey = m[2].toLowerCase().slice(0, 3);
    const month = MONTHS_IT[monKey];
    const year = parseInt(m[3], 10);
    if (month === undefined) return null;
    return new Date(year, month, day);
  }
  function daysBetween(a, b) {
    const MS = 24 * 60 * 60 * 1000;
    const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((db - da) / MS);
  }

  // ---------- Aggregate data ----------
  const allExpenseRows = []; // {date, tappa, voce, categoria, importo, note}
  const allAccommodationRows = [];
  let totalKm = 0;
  const kmByMode = {};
  const kmByDay = [];
  const spendByDay = [];
  const categoryTotals = {};

  DATA.days.forEach((day) => {
    let dayTotal = 0;
    let dayKm = 0;

    day.legs.forEach((leg) => {
      if (leg.km) {
        totalKm += leg.km;
        dayKm += leg.km;
        const mode = (leg.mezzo || "altro").toLowerCase();
        kmByMode[mode] = (kmByMode[mode] || 0) + leg.km;
      }
    });

    day.expenses.forEach((exp) => {
      allExpenseRows.push({
        date: day.date, date_label: day.date_label, tappa: day.tappa,
        voce: exp.voce, categoria: exp.categoria, importo: exp.importo, note: exp.note,
      });
      if (exp.importo) {
        dayTotal += exp.importo;
        categoryTotals[exp.categoria] = (categoryTotals[exp.categoria] || 0) + exp.importo;
      }
    });

    day.accommodations.forEach((acc) => {
      allAccommodationRows.push({
        date: day.date, date_label: day.date_label, tappa: day.tappa, ...acc,
      });
      if (acc.importo) {
        dayTotal += acc.importo;
        const cat = (acc.categoria || "alloggio").toLowerCase();
        categoryTotals[cat] = (categoryTotals[cat] || 0) + acc.importo;
      }
      if (acc.importo != null) {
        allExpenseRows.push({
          date: day.date, date_label: day.date_label, tappa: day.tappa,
          voce: acc.nome, categoria: acc.categoria || "alloggio", importo: acc.importo, note: acc.note,
        });
      }
    });

    // "Km per giorno" si ferma al 9 agosto: da Venezia in poi (10-14 agosto)
    // non ci sono più tappe in bici, quindi quei giorni non compaiono nel grafico.
    if (day.date <= "2026-08-09") {
      kmByDay.push({ date: day.date_label, km: Math.round(dayKm * 10) / 10 });
    }
    spendByDay.push({ date: day.date_label, importo: Math.round(dayTotal * 100) / 100 });
  });

  DATA.costi_preparatori.forEach((c) => {
    if (c.importo) {
      categoryTotals[c.categoria] = (categoryTotals[c.categoria] || 0) + c.importo;
    }
  });

  // ---------- Summary cards ----------
  const totNights = DATA.days.length - 1;
  const summaryCards = [
    { label: "Costo totale", value: EUR(DATA.totali.totale) },
    { label: "Costi itinerario", value: EUR(DATA.totali.itinerario) },
    { label: "Costi preparatori", value: EUR(DATA.totali.costi_preparatori) },
    { label: "Costo medio/giorno", value: EUR(DATA.totali.itinerario / DATA.days.length) },
    { label: "Giorni di viaggio", value: DATA.days.length },
    { label: "Km totali", value: `${Math.round(totalKm * 10) / 10} km` },
  ];
  const cardsEl = document.getElementById("summary-cards");
  summaryCards.forEach((c) => {
    const div = document.createElement("div");
    div.className = "stat-card";
    div.innerHTML = `<div class="label">${c.label}</div><div class="value">${c.value}</div>`;
    cardsEl.appendChild(div);
  });

  // ---------- Charts ----------
  Chart.defaults.font.family = "Segoe UI, Arial, sans-serif";

  // Cumulative spend
  let running = 0;
  const cumLabels = spendByDay.map((d) => d.date);
  const cumData = spendByDay.map((d) => { running += d.importo; return Math.round(running * 100) / 100; });
  new Chart(document.getElementById("chart-cumulative"), {
    type: "line",
    data: {
      labels: cumLabels,
      datasets: [{
        label: "Spesa cumulativa (€)",
        data: cumData,
        borderColor: "#0d5c8a",
        backgroundColor: "rgba(13,92,138,0.12)",
        fill: true,
        tension: 0.25,
        pointRadius: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { autoSkip: true, maxRotation: 40 } }, y: { ticks: { callback: (v) => "€" + v } } },
    },
  });

  // Category doughnut
  const catLabels = Object.keys(categoryTotals);
  const catValues = catLabels.map((k) => Math.round(categoryTotals[k] * 100) / 100);
  new Chart(document.getElementById("chart-category"), {
    type: "doughnut",
    data: {
      labels: catLabels,
      datasets: [{
        data: catValues,
        backgroundColor: catLabels.map((k) => colorFor(CATEGORY_COLORS, k, "#999")),
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${EUR(ctx.parsed)}` } },
      },
    },
  });

  // Daily spend bar
  new Chart(document.getElementById("chart-daily"), {
    type: "bar",
    data: {
      labels: spendByDay.map((d) => d.date),
      datasets: [{
        label: "Spesa (€)",
        data: spendByDay.map((d) => d.importo),
        backgroundColor: "#1f9e8f",
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { autoSkip: true, maxRotation: 40 } }, y: { ticks: { callback: (v) => "€" + v } } },
    },
  });

  // Km by mode
  const modeLabels = Object.keys(kmByMode);
  new Chart(document.getElementById("chart-km-mode"), {
    type: "pie",
    data: {
      labels: modeLabels,
      datasets: [{
        data: modeLabels.map((m) => Math.round(kmByMode[m] * 10) / 10),
        backgroundColor: modeLabels.map((m) => colorFor(MODE_COLORS, m, "#999")),
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed} km` } },
      },
    },
  });

  // Km per day
  new Chart(document.getElementById("chart-km-day"), {
    type: "bar",
    data: {
      labels: kmByDay.map((d) => d.date),
      datasets: [{
        label: "Km",
        data: kmByDay.map((d) => d.km),
        backgroundColor: "#e08e1d",
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { autoSkip: true, maxRotation: 40 } } },
    },
  });

  // ---------- Itinerary days ----------
  const daysContainer = document.getElementById("days-container");
  // 11-13 agosto: soggiorno fisso a Venezia, niente di nuovo da mostrare
  // qui (i costi restano comunque conteggiati in Panoramica/Costi/Prenotazioni).
  const ITINERARY_SKIP_DATES = new Set(["2026-08-11", "2026-08-12", "2026-08-13"]);
  const roundKm = (km) => Math.round(km * 100) / 100;

  DATA.days.filter((day) => !ITINERARY_SKIP_DATES.has(day.date)).forEach((day) => {
    const card = document.createElement("div");
    card.className = "card day-card";

    let legsHtml = "";
    if (day.legs.length) {
      legsHtml = `<table class="itinerary-legs-table"><thead><tr><th>Percorso</th><th>Mezzo</th><th>Km</th><th>Partenza</th><th>Arrivo</th><th>Durata</th></tr></thead><tbody>`;
      day.legs.forEach((leg) => {
        const modeClass = "mode-" + (leg.mezzo || "").toLowerCase();
        legsHtml += `<tr>
          <td>${leg.percorso}</td>
          <td><span class="leg-mode ${modeClass}">${leg.mezzo || "-"}</span></td>
          <td>${leg.km != null ? roundKm(leg.km) + " km" : "-"}</td>
          <td>${leg.partenza || "-"}</td>
          <td>${leg.arrivo || "-"}</td>
          <td>${leg.durata || "-"}</td>
        </tr>`;
      });
      legsHtml += "</tbody></table>";
    }

    // Pagina Itinerario = solo logistica (percorsi, orari, alloggio,
    // servizi utili come lavatrice/cucina). I costi vivono nella pagina
    // "Costi" e le scadenze di pagamento in "Prenotazioni".
    let accHtml = "";
    day.accommodations.filter((acc) => acc.importo != null).forEach((acc) => {
      const nomeHtml = linkWithPreview(acc.nome, acc.link);
      const descrizione = acc.servizi || acc.tipo || "";
      accHtml += `<p class="mini">🏠 <strong>${nomeHtml}</strong>${descrizione ? " — " + descrizione : ""}</p>`;
    });

    card.innerHTML = `
      <div class="day-header">
        <span class="day-weekday">${day.weekday || ""}</span>
        <span class="day-date">${day.date_label}</span>
        <span class="day-tappa">${day.tappa}</span>
      </div>
      ${legsHtml}
      ${accHtml}
    `;
    daysContainer.appendChild(card);
  });

  // ---------- Map ----------
  const map = L.map("map", { scrollWheelZoom: false });
  window._map = map;
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 18,
  }).addTo(map);

  const bounds = [];
  const seenMarkers = new Set();
  const modeColor = (m) => colorFor(MODE_COLORS, m, "#555");

  // GPX routes: file 01..07 correspond 1:1 to trip day index 0..6
  // (day index = position in DATA.days). Each covers the bici/barca leg(s)
  // of that day with a real recorded track.
  const ROUTES = (window.TRIP_ROUTES && window.TRIP_ROUTES.routes) || [];
  const DAY_ROUTE_COLORS = [
    "#0d5c8a", "#1f9e8f", "#e08e1d", "#c9762a",
    "#8e6fbe", "#d9564f", "#3f9142",
  ];

  DATA.days.forEach((day, dayIndex) => {
    const route = ROUTES[dayIndex];

    if (route && route.track && route.track.length) {
      const color = DAY_ROUTE_COLORS[dayIndex % DAY_ROUTE_COLORS.length];
      const trackLatLng = route.track.map((p) => [p[0], p[1]]);
      L.polyline(trackLatLng, { color, weight: 4, opacity: 0.85 })
        .bindPopup(`<strong>${route.name}</strong><br>traccia GPX reale (${route.track.length} punti)`)
        .addTo(map);
      trackLatLng.forEach((c) => bounds.push(c));

      route.waypoints.forEach((wp) => {
        const c = [wp.lat, wp.lon];
        const key = wp.name || `${wp.lat},${wp.lon}`;
        if (!seenMarkers.has(key)) {
          seenMarkers.add(key);
          L.circleMarker(c, { radius: 5, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 })
            .bindPopup(`<strong>${wp.name || ""}</strong>`)
            .addTo(map);
          bounds.push(c);
        }
      });
    }

    day.legs.forEach((leg) => {
      const mode = (leg.mezzo || "").toLowerCase();
      // Skip straight-line fallback for bici/barca legs on days that already
      // have a real GPX track (avoids duplicating/cluttering the real path).
      if (route && mode !== "treno") return;

      const o = leg.origin_coords, d = leg.dest_coords;
      [{ c: o, n: leg.origin }, { c: d, n: leg.destination }].forEach(({ c, n }) => {
        if (c && n && !seenMarkers.has(n)) {
          seenMarkers.add(n);
          L.circleMarker(c, { radius: 5, color: "#0d5c8a", fillColor: "#0d5c8a", fillOpacity: 0.9 })
            .bindPopup(`<strong>${n}</strong>`)
            .addTo(map);
          bounds.push(c);
        }
      });
      if (o && d) {
        L.polyline([o, d], { color: modeColor(leg.mezzo), weight: 3, opacity: 0.75, dashArray: "6,4" }).addTo(map);
      }
    });
  });

  window._mapBounds = bounds;
  if (bounds.length) map.fitBounds(bounds, { padding: [30, 30] });
  else map.setView([45.5, 12.5], 8);

  // ---------- Costs panel ----------
  const costsSummaryEl = document.getElementById("costs-summary");
  costsSummaryEl.innerHTML = `
    <table>
      <thead><tr><th>Categoria</th><th>Totale</th></tr></thead>
      <tbody>
        ${catLabels.map((k, idx) => `<tr>
          <td><span class="legend-swatch" style="background:${colorFor(CATEGORY_COLORS, k, "#999")}"></span>${k}</td>
          <td>${EUR(catValues[idx])}</td>
        </tr>`).join("")}
        <tr><td><strong>Totale generale</strong></td><td><strong>${EUR(DATA.totali.totale)}</strong></td></tr>
      </tbody>
    </table>
  `;

  const prepBody = document.querySelector("#prep-table tbody");
  DATA.costi_preparatori.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${c.voce}</td><td>${c.categoria}</td><td>${EUR(c.importo)}</td>`;
    prepBody.appendChild(tr);
  });

  // Dettaglio spese: una card per giorno (stesso stile della pagina Itinerario)
  // invece di un'unica tabella lunga con data e tappa ripetute su ogni riga.
  const detailContainer = document.getElementById("cost-detail-container");
  DATA.days.forEach((day) => {
    const rows = allExpenseRows.filter((r) => r.date === day.date && r.importo != null);
    if (!rows.length) return;

    const dayTotal = rows.reduce((sum, r) => sum + r.importo, 0);
    const tableRows = rows.map((r) => `<tr>
      <td>${r.voce}</td>
      <td>${r.categoria || ""}</td>
      <td>${EUR(r.importo)}</td>
      <td class="mini">${r.note || ""}</td>
    </tr>`).join("");

    const card = document.createElement("div");
    card.className = "card day-card";
    card.innerHTML = `
      <div class="day-header">
        <span class="day-weekday">${day.weekday || ""}</span>
        <span class="day-date">${day.date_label}</span>
        <span class="day-tappa">${day.tappa}</span>
      </div>
      <table class="cost-detail-day-table">
        <thead><tr><th>Voce</th><th>Categoria</th><th>Importo</th><th>Note</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <p class="mini day-cost-total">Totale giorno: <strong>${EUR(dayTotal)}</strong></p>
    `;
    detailContainer.appendChild(card);
  });

  // ---------- Bookings panel ----------
  const bookingsBody = document.querySelector("#bookings-table tbody");
  const bookingRows = allAccommodationRows
    .filter((acc) => acc.importo != null) // solo prenotazioni effettive, non le alternative valutate
    .map((acc) => {
      const dueDate = parseItalianNoteDate(acc.note);
      return { ...acc, dueDate };
    });
  bookingRows.sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });
  bookingRows.forEach((acc) => {
    let statusHtml = `<span class="badge badge-future">n/d</span>`;
    if (acc.dueDate) {
      const d = daysBetween(TODAY, acc.dueDate);
      if (d < 0) statusHtml = `<span class="badge badge-late">scaduto (${Math.abs(d)}gg fa)</span>`;
      else if (d <= 7) statusHtml = `<span class="badge badge-soon">tra ${d} giorni</span>`;
      else statusHtml = `<span class="badge badge-future">tra ${d} giorni</span>`;
    } else if (!acc.importo) {
      statusHtml = `<span class="badge badge-future">alternativa</span>`;
    }
    const importoLabel = acc.importo != null ? EUR(acc.importo) : (typeof acc.note === "number" ? EUR(acc.note) + " (stimato)" : "—");
    const noteLabel = typeof acc.note === "string" ? acc.note : "";
    const nomeLabel = linkWithPreview(acc.nome, acc.link);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${statusHtml}</td>
      <td>${acc.date_label}</td>
      <td>${nomeLabel}</td>
      <td>${acc.tipo || ""}</td>
      <td>${importoLabel}</td>
      <td>${acc.dueDate ? acc.dueDate.toLocaleDateString("it-IT") : "-"}</td>
      <td class="mini">${acc.servizi || ""}</td>
      <td class="mini">${noteLabel}</td>
    `;
    bookingsBody.appendChild(tr);
  });

})();
