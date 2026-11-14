// CastCall – UI
(function () {
  const F = window.FISH, S = F.scoring, SP = F.SPECIES;
  const DEVICE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Australia/Sydney', H = 3600;
  // Times are always shown in the spot's own local time (Perth, Adelaide, Darwin...).
  // curTZ is set to the spot being drawn; pass a tz explicitly from other modules.
  let curTZ = DEVICE_TZ;
  const fmts = {};
  const fmt = (tz, o) => { const k = tz + JSON.stringify(o); return fmts[k] || (fmts[k] = new Intl.DateTimeFormat('en-AU', Object.assign({ timeZone: tz }, o))); };
  const tm = (t, tz = curTZ) => fmt(tz, { hour: 'numeric', minute: '2-digit' }).format(new Date(t * 1000)).replace(/\s/g, '').toLowerCase();
  const hr = (t, tz = curTZ) => fmt(tz, { hour: 'numeric' }).format(new Date(t * 1000)).replace(/\s/g, '').toLowerCase();
  const day = (t, tz = curTZ) => fmt(tz, { weekday: 'short' }).format(new Date(t * 1000));
  const h23 = (t, tz = curTZ) => Number(fmt(tz, { hour: 'numeric', hourCycle: 'h23' }).format(new Date(t * 1000))) % 24;
  const tzName = tz => (fmt(tz, { timeZoneName: 'short' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName') || {}).value || tz;
  const rulesLink = l => { const st = F.STATES[l.state]; return `<a href="${st.rules}" target="_blank" rel="noopener">${st.agency} rules ↗</a>`; };
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const state = {
    data: null, analyses: {}, offset: 0, region: 'all', access: 'all', water: 'all', target: '', sort: 'score', search: '',
    userPos: null, selected: null, view: 'spots', fetchedAt: null,
    favs: new Set(JSON.parse(localStorage.getItem('fish-favs') || '[]'))
  };
  let map = null; const markers = {};

  const bucket = s => s >= 75 ? 3 : s >= 60 ? 2 : s >= 45 ? 1 : 0;
  const LABEL = ['Poor', 'Fair', 'Good', 'Excellent'];
  const actLabel = a => a >= 0.6 ? 'Firing' : a >= 0.4 ? 'Worth a shot' : a >= 0.2 ? 'Slow' : 'Off season';
  const TYPE = { rock: 'Rock platform', beach: 'Surf beach', estuary: 'Estuary', harbour: 'Harbour / bay', breakwall: 'Breakwall', offshore: 'Offshore', dam: 'Dam / lake', river: 'River' };

  function wx(code) {
    if (code == null) return ['', '–'];
    if (code === 0) return ['☀️', 'Clear'];
    if (code <= 2) return ['🌤️', 'Partly cloudy'];
    if (code === 3) return ['☁️', 'Overcast'];
    if (code <= 48) return ['🌫️', 'Fog'];
    if (code <= 57) return ['🌦️', 'Drizzle'];
    if (code <= 67) return ['🌧️', 'Rain'];
    if (code <= 77) return ['🌨️', 'Snow'];
    if (code <= 82) return ['🌧️', 'Showers'];
    return ['⛈️', 'Thunderstorm'];
  }
  const arrow = deg => `<span class="arrow" style="transform:rotate(${(deg + 180) % 360}deg)" aria-hidden="true">↑</span>`;
  const n1 = v => v == null ? '–' : v.toFixed(1);

  function distKm(a, b) {
    const R = 6371, dLat = (b[0] - a[0]) * Math.PI / 180, dLon = (b[1] - a[1]) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  // ---------------- Data ----------------
  async function load(force) {
    $('#status').textContent = 'Loading live forecast…';
    $('#error').hidden = true;
    try {
      const [res, pinRes] = await Promise.all([
        F.api.load(F.LOCATIONS.filter(l => !l.pin), force),
        F.api.load(F.LOCATIONS.filter(l => l.pin), force, 'fish-pins-cache').catch(() => ({ data: {} }))
      ]);
      state.data = Object.assign(res.data, pinRes.data); state.fetchedAt = res.at;
      if (res.marineOk === false) showError('Swell / tide data is unavailable right now – scores use weather only.');
      compute(); render();
    } catch (e) {
      console.error(e);
      showError(`Couldn't load the forecast (${e.message}). Check your internet connection and try again.`);
      $('#status').textContent = 'Offline';
    }
  }
  function showError(msg) { $('#error').hidden = false; $('#error-msg').textContent = msg; }

  // Fetch just the pinned spots (after adding/editing a pin) without reloading everything.
  async function loadPins() {
    if (!state.data) return;
    const pins = F.LOCATIONS.filter(l => l.pin);
    const res = await F.api.load(pins, true, 'fish-pins-cache');
    Object.assign(state.data, res.data);
    compute(); render();
  }

  function compute() {
    const now = Date.now() / 1000;
    for (const loc of F.LOCATIONS) {
      if (!state.data[loc.id]) continue;
      state.analyses[loc.id] = S.analyse(loc, state.data[loc.id], now, { target: state.target, boat: state.access === 'boat' });
    }
    const len = Math.min(...Object.values(state.analyses).map(a => a.hours.length));
    const slider = $('#time');
    slider.max = Math.max(0, len - 1);
    if (state.offset > len - 1) state.offset = 0;
    slider.value = state.offset;
    const mins = Math.round((Date.now() - state.fetchedAt) / 60000);
    $('#status').textContent = `Forecast updated ${mins < 1 ? 'just now' : mins + ' min ago'}`;
  }

  function hourOf(id) { const a = state.analyses[id]; return a && a.hours[Math.min(state.offset, a.hours.length - 1)]; }

  // Everything a spot can be found by: name, area, state, type, fish, and words in its notes (e.g. "baths", "jetty").
  // Match from the start of a word, so "cod" finds "Murray Cod" but not "crocodile".
  const wordMatch = (text, w) => new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(text);
  const searchCache = {};
  function searchText(l) {
    return searchCache[l.id + l.name] || (searchCache[l.id + l.name] = [l.name, l.region, l.state, F.STATES[l.state].name, TYPE[l.type], l.water === 'fresh' ? 'freshwater fresh' : 'saltwater salt',
      l.species.map(s => SP[s].name).join(' '), l.notes, l.access_info, l.pin ? 'pin my pins' : '', l.local ? 'local' : ''].join(' ').toLowerCase());
  }

  function visibleLocations() {
    const q = state.search.trim().toLowerCase();
    const r = state.region;
    let list = F.LOCATIONS.filter(l => state.analyses[l.id]
      && (r === 'all' || (r === 'favs' ? state.favs.has(l.id) : r === 'pins' ? l.pin : r.startsWith('state:') ? l.state === r.slice(6) : l.region === r))
      && (state.access === 'all' || l.access.includes(state.access))
      && (state.water === 'all' || l.water === state.water)
      && (!state.target || l.species.includes(state.target))
      && (!q || q.split(/\s+/).every(w => wordMatch(searchText(l), w))));
    if (state.sort === 'distance' && state.userPos) list.sort((a, b) => distKm(state.userPos, [a.lat, a.lon]) - distKm(state.userPos, [b.lat, b.lon]));
    else if (state.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else list.sort((a, b) => hourOf(b.id).score - hourOf(a.id).score);
    return list;
  }

  // ---------------- Render ----------------
  function render() {
    if (!state.data) return;
    renderTimeLabel();
    if (state.view === 'spots') { renderList(); renderMap(); if (state.selected) renderDetail(); }
    else if (state.view === 'species') renderSpecies();
    else if (state.view === 'alerts' && F.alerts) F.alerts.render();
    else if (state.view === 'log' && F.catchlog) F.catchlog.render();
    if (F.alerts) F.alerts.check();
  }

  function renderTimeLabel() {
    const any = Object.values(state.analyses)[0];
    if (!any) return;
    const h = any.hours[state.offset];
    $('#time-label').innerHTML = state.offset === 0 ? `<b>Now</b> · ${day(h.t, DEVICE_TZ)} ${hr(h.t, DEVICE_TZ)}` : `<b>${day(h.t, DEVICE_TZ)} ${hr(h.t, DEVICE_TZ)}</b> · in ${state.offset} h <span class="muted small">(your time)</span>`;
  }

  function nextWindow(a, t) { return a.windows.find(w => w.end > t); }

  function renderList() {
    const list = visibleLocations();
    $('#count').textContent = `${list.length} spot${list.length === 1 ? '' : 's'}`;
    if (!list.length) {
      $('#list').innerHTML = state.search.trim()
        ? `<p class="empty">No spots match "${esc(state.search.trim())}".<br>Try another word, change the filters, or <button class="link" id="empty-pin">📌 pin the spot yourself</button>.</p>`
        : '<p class="empty">No spots match these filters.</p>';
      const b = $('#empty-pin'); if (b) b.onclick = () => $('#pin-start').click();
      return;
    }
    $('#list').innerHTML = list.map((l, rank) => {
      curTZ = l.tz;
      const a = state.analyses[l.id], h = hourOf(l.id), b = bucket(h.score);
      const top = rank === 0 && state.sort === 'score' && list.length > 1;
      const fish = h.species.filter(s => s.act >= 0.25).slice(0, 3).map(s => SP[s.id].name.replace(/ \(.+\)/, ''));
      const w = nextWindow(a, h.t);
      const tide = h.fresh ? `🌧️ ${h.rain48.toFixed(0)} mm / 48 h`
        : h.tide ? `${h.tide.state}${h.tide.next ? ` · ${h.tide.next.type === 'high' ? 'H' : 'L'} ${tm(h.tide.next.t)}` : ''}` : 'Tide n/a';
      const dist = state.userPos ? ` · ${Math.round(distKm(state.userPos, [l.lat, l.lon]))} km` : '';
      return `<button class="card${state.selected === l.id ? ' active' : ''}${top ? ' top-pick' : ''}" data-id="${l.id}">
        <div class="score s${b}" aria-label="Score ${h.score} out of 100, ${LABEL[b]}"><span>${h.score}</span><small>${LABEL[b]}</small></div>
        <div class="card-body">
          <div class="card-title">${l.pin ? '📌 ' : ''}${state.favs.has(l.id) ? '★ ' : ''}${esc(l.name)}${l.local ? ' <span class="tag">Local spot</span>' : ''}</div>
          <div class="card-sub">${esc(l.region)}, ${l.state} · ${TYPE[l.type]} · ${l.access.map(x => x === 'land' ? 'Land' : 'Boat').join(' / ')}${dist}</div>
          <div class="card-cond">
            <span title="Wind">${arrow(h.windDir)} ${Math.round(h.wind)} km/h</span>
            ${h.fresh ? '<span title="Freshwater">💧 Fresh</span>' : `<span title="Swell">🌊 ${n1(h.wave)} m</span>`}
            <span title="${h.fresh ? 'Estimated water temperature' : 'Sea temperature'}">🌡️ ${h.sst == null ? '–' : h.sst.toFixed(0) + '°'}</span>
            <span title="Tide">${tide}</span>
          </div>
          <div class="card-fish">${fish.length ? '🎣 ' + fish.join(', ') : '<span class="muted">Quiet – nothing much in season</span>'}</div>
          ${w ? `<div class="card-win">Best: ${day(w.start)} ${hr(w.start)}–${hr(w.end)} (${w.peak})</div>` : ''}
          ${h.warnings.length ? `<div class="card-warn">⚠️ ${esc(h.warnings[0])}</div>` : ''}
          ${h.closures.length ? `<div class="card-closed">⛔ Closed season for ${h.species.filter(s => s.closed).map(s => SP[s.id].name.split(' (')[0]).join(', ')}</div>` : ''}
        </div></button>`;
    }).join('');
  }

  function initMap() {
    if (typeof L === 'undefined') { $('#map').innerHTML = '<p class="empty">Map unavailable offline.</p>'; return; }
    map = L.map('map', { zoomControl: true }).setView([-32.6, 151.9], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
    // The map can start hidden (phone list view), where it has no size and can't zoom properly.
    // So zoom out to the whole of Australia the first time it actually has a size on screen.
    new ResizeObserver(ensureMapFit).observe($('#map'));
    ensureMapFit();
    const Home = L.Control.extend({
      onAdd() {
        const b = L.DomUtil.create('button', 'map-home-btn');
        b.type = 'button'; b.textContent = '🌏'; b.title = 'Zoom out to all of Australia'; b.setAttribute('aria-label', 'Zoom out to all of Australia');
        L.DomEvent.disableClickPropagation(b);
        b.onclick = fitAustralia;
        return b;
      }
    });
    new Home({ position: 'topleft' }).addTo(map);
    // Long-press (phone) or right-click (computer) anywhere on the map drops a pin.
    map.on('contextmenu', e => F.pins && F.pins.start(e.latlng.lat, e.latlng.lng));
    map.on('click', e => { if (F.pins && F.pins.picking) F.pins.start(e.latlng.lat, e.latlng.lng); });
    if (F.pins) F.pins.attachMap(map);
  }
  const AUSTRALIA = [[-43.8, 112.9], [-10.5, 153.8]];
  function fitAustralia() { if (map) map.fitBounds(AUSTRALIA, { padding: [10, 10], animate: false }); }
  let mapFitted = false;
  function ensureMapFit() {
    const el = $('#map');
    if (!map || el.clientWidth < 50 || el.clientHeight < 50) return;
    map.invalidateSize();
    if (!mapFitted) { mapFitted = true; fitAustralia(); }
  }

  function renderMap() {
    if (!map) return;
    const vis = new Set(visibleLocations().map(l => l.id));
    for (const id of Object.keys(markers)) if (!F.LOCATIONS.some(l => l.id === id)) { map.removeLayer(markers[id]); delete markers[id]; }
    for (const l of F.LOCATIONS) {
      if (!markers[l.id]) markers[l.id] = L.marker([l.lat, l.lon], { title: l.name }).on('click', () => select(l.id));
      const m = markers[l.id], h = hourOf(l.id);
      if (!vis.has(l.id) || !h) { if (map.hasLayer(m)) map.removeLayer(m); continue; }
      if (!map.hasLayer(m)) m.addTo(map);
      m.setIcon(L.divIcon({ className: '', html: `<div class="pin s${bucket(h.score)}${state.selected === l.id ? ' sel' : ''}${l.pin ? ' mine' : ''}">${h.score}</div>`, iconSize: [32, 32], iconAnchor: [16, 16] }));
      m.setZIndexOffset(h.score * 10);
    }
  }

  function select(id) {
    const wasOpen = !!state.selected;
    state.selected = id;
    renderList(); renderMap(); renderDetail();
    $('#detail').hidden = false;
    $('#detail').scrollTop = 0;
    // Phone/browser back button closes the details instead of leaving the app.
    if (!wasOpen) history.pushState({ detail: id }, '');
    const card = document.querySelector(`.card[data-id="${id}"]`);
    if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const l = F.LOCATIONS.find(x => x.id === id);
    if (map) map.panTo([l.lat, l.lon]);
  }

  function closeDetail(fromHistory) {
    if (!state.selected) return;
    state.selected = null; $('#detail').hidden = true; renderList(); renderMap();
    if (!fromHistory && history.state && history.state.detail) history.back();
  }

  // ---------------- Detail ----------------
  function renderDetail() {
    const l = F.LOCATIONS.find(x => x.id === state.selected), a = l && state.analyses[l.id];
    if (!a) return;
    curTZ = l.tz;
    const h = hourOf(l.id), b = bucket(h.score), [icon, wdesc] = wx(h.code);
    const near = l.pin && F.pins ? F.pins.nearest(l) : null;
    const pos = h.reasons.filter(r => r.g > 0), neg = h.reasons.filter(r => r.g < 0), neu = h.reasons.filter(r => r.g === 0);
    const pressure = state.data[l.id].pressure[h.i];
    $('#detail').hidden = false;
    CW = Math.round(Math.max(330, Math.min(680, $('#detail').clientWidth - 36)));

    $('#detail').innerHTML = `
      <div class="d-head">
        <div>
          <h2>${l.pin ? '📌 ' : ''}${esc(l.name)}</h2>
          <div class="muted">${esc(l.region)}, ${F.STATES[l.state].name} · ${TYPE[l.type]} · ${l.access.map(x => x === 'land' ? 'Land-based' : 'Boat / kayak').join(', ')}</div>
          ${l.tz !== DEVICE_TZ ? `<div class="muted small">🕒 Times shown in local time here (${tzName(l.tz)})</div>` : ''}
        </div>
        <div class="d-actions">
          <button class="icon-btn" id="fav" aria-pressed="${state.favs.has(l.id)}" title="Save spot">${state.favs.has(l.id) ? '★' : '☆'}</button>
          <button class="icon-btn" id="close" title="Close">✕</button>
        </div>
      </div>

      <div class="d-score">
        <div class="score big s${b}"><span>${h.score}</span><small>${LABEL[b]}</small></div>
        <div>
          <div class="d-when">${state.offset === 0 ? 'Right now' : `${day(h.t)} ${hr(h.t)}`}</div>
          <ul class="reasons">
            ${pos.map(r => `<li class="pos">✓ ${esc(r.txt)}</li>`).join('')}
            ${neu.map(r => `<li class="neu">• ${esc(r.txt)}</li>`).join('')}
            ${neg.map(r => `<li class="neg">✗ ${esc(r.txt)}</li>`).join('')}
          </ul>
        </div>
      </div>
      ${h.warnings.length ? `<div class="warn-box" role="alert">${h.warnings.map(w => `<div>⚠️ ${esc(w)}</div>`).join('')}</div>` : ''}
      ${h.closures.length ? `<div class="closed-box">${h.closures.map(c => `<div>⛔ ${esc(c)}</div>`).join('')}</div>` : ''}
      <div class="d-buttons">
        <button class="btn" id="d-alert">🔔 Alert me for this spot</button>
        <button class="btn" id="d-log">📓 Log a catch here</button>
        ${l.pin ? '<button class="btn" id="d-pin-edit">✏️ Edit pin</button><button class="btn" id="d-pin-del">🗑 Remove pin</button>' : ''}
      </div>
      ${l.pin ? `<div class="pin-brief">
        <b>Your exact spot rundown</b> – live weather, swell, tide and water temperature for the point you pinned
        (${l.lat.toFixed(4)}, ${l.lon.toFixed(4)}), with fish picked from the nearby spots below.
        ${near ? `<div class="muted small">Nearest CastCall spot: <button class="link" data-goto="${near.l.id}">${esc(near.l.name)}</button> (${near.km < 1 ? '<1' : Math.round(near.km)} km away)</div>` : ''}
      </div>` : ''}

      <section>
        <h3>Best times – next 3 days</h3>
        <div class="windows">${a.windows.length ? a.windows.map(w => `<button class="win" data-t="${w.peakT}"><b>${day(w.start)} ${hr(w.start)} – ${hr(w.end)}</b><span>Peak ${w.peak} at ${hr(w.peakT)}</span></button>`).join('') : '<span class="muted">No standout windows – conditions are fairly even.</span>'}</div>
        <div class="chart" id="score-chart">${scoreChart(a)}</div>
        <div class="caption"><span class="key win-key"></span> Best windows <span class="key night-key"></span> Night · click a bar to jump to that hour</div>
      </section>

      <section>
        <h3>Conditions ${state.offset === 0 ? 'now' : 'at ' + day(h.t) + ' ' + hr(h.t)}</h3>
        <div class="cond-grid">
          <div><span class="c-k">Weather</span><span class="c-v">${icon} ${Math.round(h.temp)}°C</span><span class="c-s">${wdesc}${h.rainProb != null ? ` · ${h.rainProb}% rain` : ''}</span></div>
          <div><span class="c-k">Wind</span><span class="c-v">${arrow(h.windDir)} ${Math.round(h.wind)} km/h</span><span class="c-s">${S.compass(h.windDir)} · gusts ${Math.round(h.gust)}</span></div>
          ${h.fresh ? `
          <div><span class="c-k">Rain (48 h)</span><span class="c-v">${h.rain48.toFixed(0)} mm</span><span class="c-s">${l.type === 'river' ? (h.rain48 > 60 ? 'river likely flooding' : h.rain48 >= 3 ? 'river freshening' : 'normal flow') : 'inflow to the dam'}</span></div>
          <div><span class="c-k">Water temp</span><span class="c-v">${h.sst == null ? '–' : h.sst.toFixed(0) + '°C'}</span><span class="c-s">estimate from air temp</span></div>
          <div><span class="c-k">Water</span><span class="c-v">Fresh</span><span class="c-s">${TYPE[l.type]} · no tide</span></div>` : `
          <div><span class="c-k">Swell</span><span class="c-v">${n1(h.wave)} m</span><span class="c-s">${h.period != null ? h.period.toFixed(0) + ' s period' : 'no data'}</span></div>
          <div><span class="c-k">Sea temp</span><span class="c-v">${h.sst == null ? '–' : h.sst.toFixed(1) + '°C'}</span><span class="c-s">surface</span></div>
          <div><span class="c-k">Tide</span><span class="c-v">${h.tide ? h.tide.state : '–'}</span><span class="c-s">${h.tide && h.tide.next ? `${h.tide.next.type === 'high' ? 'High' : 'Low'} at ${tm(h.tide.next.t)}` : 'no data'}</span></div>`}
          <div><span class="c-k">Pressure</span><span class="c-v">${pressure == null ? '–' : Math.round(pressure)} hPa</span><span class="c-s">${pressureTrend(l.id, h.i)}</span></div>
          <div><span class="c-k">Moon</span><span class="c-v">${h.moon.icon} ${Math.round(h.moon.illum * 100)}%</span><span class="c-s">${h.moon.name}</span></div>
          <div><span class="c-k">Sun</span><span class="c-v">↑ ${tm(h.light.rise)}</span><span class="c-s">↓ ${tm(h.light.set)}</span></div>
        </div>
      </section>

      ${h.fresh ? '' : `<section>
        <h3>Tides</h3>
        <div class="chart" id="tide-chart">${tideChart(l, a)}</div>
        <div class="caption">Modelled tide (height vs mean sea level), adjusted for ${l.tideLag ? `a ~${l.tideLag} min lag inside the estuary` : 'the open coast'}. Check BOM tide tables for exact times.</div>
      </section>`}

      <section>
        <h3>Target species ${state.offset === 0 ? 'right now' : 'at this time'}</h3>
        <div class="species">${h.species.map((s, k) => speciesCard(s, h, k < 2, l)).join('')}</div>
      </section>

      <section>
        <h3>About this spot</h3>
        <p>${esc(l.notes)}</p>
        <p class="muted">📍 ${esc(l.access_info)}</p>
        <p><a href="https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lon}" target="_blank" rel="noopener">Directions in Google Maps ↗</a> · ${rulesLink(l)}</p>
      </section>

      <section>
        <h3>Next 24 hours</h3>
        <div class="table-wrap">${hourlyTable(a)}</div>
      </section>`;

    $('#close').onclick = () => closeDetail(false);
    $('#fav').onclick = () => {
      state.favs.has(l.id) ? state.favs.delete(l.id) : state.favs.add(l.id);
      localStorage.setItem('fish-favs', JSON.stringify([...state.favs]));
      render();
    };
    $('#detail').querySelectorAll('.win').forEach(btn => btn.onclick = () => jumpTo(Number(btn.dataset.t)));
    $('#d-alert').onclick = () => { setView('alerts'); F.alerts && F.alerts.prefill(l.id); };
    $('#d-log').onclick = () => { setView('log'); F.catchlog && F.catchlog.prefill(l.id); };
    if (l.pin) {
      $('#d-pin-edit').onclick = () => F.pins.edit(l.id);
      $('#d-pin-del').onclick = () => F.pins.remove(l.id);
      $('#detail').querySelectorAll('[data-goto]').forEach(b => b.onclick = () => select(b.dataset.goto));
    }
    bindChart('#score-chart', k => {
      curTZ = l.tz;
      const x = a.hours[k];
      return `<b>${day(x.t)} ${hr(x.t)}</b><br>Score ${x.score} · ${LABEL[bucket(x.score)]}<br>${arrow(x.windDir)} ${Math.round(x.wind)} km/h · 🌊 ${n1(x.wave)} m<br>${x.tide ? x.tide.state + ' tide' : ''}`;
    }, k => { state.offset = k; $('#time').value = k; render(); });
    bindChart('#tide-chart', k => {
      curTZ = l.tz;
      const x = a.hours[k], v = state.data[l.id].sea[x.i];
      return `<b>${day(x.t)} ${hr(x.t)}</b><br>${v == null ? 'no data' : v.toFixed(2) + ' m'}${x.tide ? ' · ' + x.tide.state : ''}`;
    }, k => { state.offset = k; $('#time').value = k; render(); });
  }

  function pressureTrend(id, i) {
    const p = state.data[id].pressure;
    if (i < 3 || p[i] == null || p[i - 3] == null) return '';
    const d = p[i] - p[i - 3];
    return Math.abs(d) < 0.5 ? 'steady' : d < 0 ? `falling ${d.toFixed(1)}/3h` : `rising +${d.toFixed(1)}/3h`;
  }

  function jumpTo(t) {
    const a = Object.values(state.analyses)[0];
    const k = a.hours.findIndex(h => h.t >= t);
    if (k >= 0) { state.offset = k; $('#time').value = k; render(); }
  }

  function speciesCard(s, h, open, l) {
    const sp = SP[s.id];
    const chips = [];
    if (s.closed) chips.push(`<span class="chip bad">⛔ ${s.closed.release ? 'Catch & release only' : 'Closed season'}</span>`);
    if (sp.pest) chips.push('<span class="chip bad">Pest – don\'t release alive</span>');
    if (s.season >= 1) chips.push('<span class="chip good">Peak season</span>');
    else if (s.season >= 0.6) chips.push('<span class="chip">In season</span>');
    else chips.push('<span class="chip bad">Out of season</span>');
    if (h.sst != null) chips.push(`<span class="chip ${s.tempFit === 1 ? 'good' : 'bad'}">Water ${h.sst.toFixed(0)}° ${s.tempFit === 1 ? 'in range' : `(likes ${sp.temp[0]}–${sp.temp[1]}°)`}</span>`);
    if (!h.fresh) {
      const tideTxt = { rising: 'Prefers rising tide', falling: 'Prefers run-out tide', change: 'Bites on the tide change', any: 'Any tide' }[sp.tide];
      chips.push(`<span class="chip ${s.tidePref === 1 ? 'good' : ''}">${tideTxt}</span>`);
    } else if (sp.rain) chips.push('<span class="chip">Likes a rise after rain</span>');
    if (s.tod >= 0.9) chips.push(`<span class="chip good">Good ${h.light.cat} bite</span>`);
    return `<details class="sp" ${open ? 'open' : ''}>
      <summary>
        <span class="sp-name">${esc(sp.name)}</span>
        <span class="meter" aria-hidden="true"><i style="width:${Math.round(s.act * 100)}%"></i></span>
        <span class="sp-act">${actLabel(s.act)}</span>
      </summary>
      <div class="chips">${chips.join('')}</div>
      <dl>
        <dt>Best baits</dt><dd>${sp.baits.map(esc).join(' · ')}</dd>
        <dt>Lures</dt><dd>${sp.lures.map(esc).join(' · ')}</dd>
        <dt>Rig</dt><dd>${esc(sp.rig)}</dd>
        <dt>Where</dt><dd>${esc(sp.habitat)}</dd>
        <dt>Size / bag</dt><dd>${sizeTxt(sp, l.state)} <span class="muted">(guide only – ${rulesLink(l)})</span></dd>
      </dl>
      <p class="tip">💡 ${esc(sp.tips)}</p>
    </details>`;
  }

  // Stored sizes/bags are NSW figures; other states have their own rules.
  function sizeTxt(sp, st) {
    if (sp.pest) return 'Pest – no size or bag limit, don\'t release alive';
    if (st && st !== 'NSW') return `Check ${F.STATES[st].agency} rules – limits differ between states`;
    if (!sp.size) return 'Check current rules';
    if (sp.size === 'No limit') return 'No size or bag limit';
    return `${st ? '' : 'NSW: '}${/^\d+ cm$/.test(sp.size) ? 'Min ' : ''}${sp.size}, bag ${sp.bag}`;
  }

  function hourlyTable(a) {
    const rows = a.hours.slice(state.offset, state.offset + 24).map(x => `<tr${x.light.cat === 'night' ? ' class="night"' : ''}>
      <td>${day(x.t)} ${hr(x.t)}</td><td class="num"><b>${x.score}</b></td>
      <td>${arrow(x.windDir)} ${Math.round(x.wind)} <span class="muted">(${Math.round(x.gust)})</span></td>
      <td class="num">${n1(x.wave)}</td><td>${x.tide ? x.tide.state : '–'}</td>
      <td>${wx(x.code)[0]} ${Math.round(x.temp)}°</td><td class="num">${x.rainProb ?? '–'}%</td></tr>`).join('');
    return `<table><thead><tr><th>Time</th><th>Score</th><th>Wind km/h</th><th>Swell m</th><th>Tide</th><th>Weather</th><th>Rain</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  // ---------------- Charts ----------------
  let CW = 680; const PL = 30, PR = 10; // CW is re-measured to the drawer width so text stays readable on phones
  function xScale(n) { const iw = (CW - PL - PR) / n; return { iw, x: k => PL + k * iw }; }

  function dayMarks(hours, x, top, bottom) {
    let out = '';
    hours.forEach((h, k) => {
      if (k === 0 || h23(h.t) === 0) {
        if (k > 0) out += `<line class="dayline" x1="${x(k)}" x2="${x(k)}" y1="${top}" y2="${bottom}"/>`;
        out += `<text class="axis" x="${x(k) + 3}" y="${bottom + 14}">${day(h.t)}</text>`;
      } else if (h23(h.t) === 12) out += `<text class="axis faint" x="${x(k)}" y="${bottom + 14}" text-anchor="middle">12pm</text>`;
    });
    return out;
  }

  function hitRects(n, x, iw, top, h) {
    let out = '';
    for (let k = 0; k < n; k++) out += `<rect class="hit" data-k="${k}" x="${x(k)}" y="${top}" width="${iw}" height="${h}"/>`;
    return out;
  }

  function scoreChart(a) {
    const hours = a.hours, n = hours.length, HH = 170, PT = 8, PB = 24, ch = HH - PT - PB;
    const { iw, x } = xScale(n), y = v => PT + ch * (1 - v / 100), base = y(0);
    let s = '';
    hours.forEach((h, k) => { if (h.light.cat === 'night') s += `<rect class="night" x="${x(k)}" y="${PT}" width="${iw + 0.5}" height="${ch}"/>`; });
    a.windows.forEach(w => {
      const k0 = hours.findIndex(h => h.t >= w.start), k1 = hours.findIndex(h => h.t >= w.end);
      s += `<rect class="winband" x="${x(k0)}" y="${PT}" width="${x(k1 < 0 ? n : k1) - x(k0)}" height="${ch}"/>`;
    });
    [25, 50, 75, 100].forEach(v => { s += `<line class="grid" x1="${PL}" x2="${CW - PR}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${PL - 6}" y="${y(v) + 3}" text-anchor="end">${v}</text>`; });
    hours.forEach((h, k) => {
      const bx = x(k) + 1, bw = Math.max(1, iw - 2), top = y(h.score), r = Math.min(2, bw / 2, base - top);
      s += `<path class="bar${k === state.offset ? ' sel' : ''}" d="M${bx},${base}V${top + r}Q${bx},${top} ${bx + r},${top}H${bx + bw - r}Q${bx + bw},${top} ${bx + bw},${top + r}V${base}Z"/>`;
    });
    s += `<line class="baseline" x1="${PL}" x2="${CW - PR}" y1="${base}" y2="${base}"/>`;
    s += dayMarks(hours, x, PT, base);
    s += `<line class="cross" x1="0" x2="0" y1="${PT}" y2="${base}" visibility="hidden"/>`;
    s += hitRects(n, x, iw, PT, ch);
    return `<svg viewBox="0 0 ${CW} ${HH}" role="img" aria-label="Fishing score for each hour over the next 3 days">${s}</svg>`;
  }

  function tideChart(l, a) {
    const d = state.data[l.id], hours = a.hours, n = hours.length;
    const vals = hours.map(h => d.sea[h.i]);
    if (vals.every(v => v == null)) return '<p class="empty">No tide data for this spot.</p>';
    const HH = 170, PT = 26, PB = 40, ch = HH - PT - PB;
    const { iw, x } = xScale(n), cx = k => x(k) + iw / 2;
    const lo = Math.min(...vals.filter(v => v != null)), hi = Math.max(...vals.filter(v => v != null));
    const y = v => PT + ch * (1 - (v - lo) / ((hi - lo) || 1)), base = PT + ch;
    const lagK = (l.tideLag || 0) / 60; // shift the curve by the estuary lag
    let s = '';
    hours.forEach((h, k) => { if (h.light.cat === 'night') s += `<rect class="night" x="${x(k)}" y="${PT}" width="${iw + 0.5}" height="${ch}"/>`; });
    s += `<line class="grid" x1="${PL}" x2="${CW - PR}" y1="${y(0)}" y2="${y(0)}"/><text class="axis" x="${PL - 6}" y="${y(0) + 3}" text-anchor="end">0 m</text>`;
    let path = '', pen = false;
    vals.forEach((v, k) => { if (v == null) { pen = false; return; } path += `${pen ? 'L' : 'M'}${(cx(k) + lagK * iw).toFixed(1)},${y(v).toFixed(1)}`; pen = true; });
    s += `<path class="line" d="${path}"/>`;
    const t0 = hours[0].t, kOf = t => (t - t0) / H;
    a.extremes.filter(e => e.t >= t0 && e.t <= hours[n - 1].t + H).forEach(e => {
      const ex = cx(0) + kOf(e.t) * iw, ey = y(e.h), up = e.type === 'high';
      if (ex < PL || ex > CW - PR) return;
      s += `<circle class="dot" cx="${ex}" cy="${ey}" r="4"/>`;
      s += `<text class="lbl" x="${ex}" y="${up ? ey - 10 : ey + 18}" text-anchor="middle">${up ? 'H' : 'L'} ${tm(e.t)}</text>`;
    });
    const sx = cx(state.offset);
    s += `<line class="now" x1="${sx}" x2="${sx}" y1="${PT - 6}" y2="${base}"/>`;
    s += dayMarks(hours, x, PT, base + 12);
    s += `<line class="cross" x1="0" x2="0" y1="${PT}" y2="${base}" visibility="hidden"/>`;
    s += hitRects(n, x, iw, PT, ch);
    return `<svg viewBox="0 0 ${CW} ${HH}" role="img" aria-label="Tide height over the next 3 days with high and low times">${s}</svg>`;
  }

  function bindChart(sel, tipHtml, onClick) {
    const wrap = $(sel), svg = wrap && wrap.querySelector('svg');
    if (!svg) return;
    const tip = $('#tooltip'), cross = svg.querySelector('.cross');
    svg.querySelectorAll('.hit').forEach(r => {
      const k = Number(r.dataset.k);
      r.addEventListener('pointerenter', () => {
        tip.innerHTML = tipHtml(k); tip.hidden = false;
        const mid = Number(r.getAttribute('x')) + Number(r.getAttribute('width')) / 2;
        cross.setAttribute('x1', mid); cross.setAttribute('x2', mid); cross.setAttribute('visibility', 'visible');
      });
      r.addEventListener('pointermove', e => {
        const w = tip.offsetWidth, left = e.clientX + 14 + w > window.innerWidth ? e.clientX - w - 14 : e.clientX + 14;
        tip.style.left = left + 'px'; tip.style.top = (e.clientY + 14) + 'px';
      });
      r.addEventListener('click', () => { tip.hidden = true; onClick(k); });
    });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
  }

  // ---------------- Species guide ----------------
  function renderSpecies() {
    const M = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const SEASON = ['Rare', 'Some around', 'Good', 'Peak'];
    const cur = new Date().getMonth();
    const card = ([id, sp]) => {
      const spots = F.LOCATIONS.filter(l => l.species.includes(id) && state.analyses[l.id]).map(l => {
        const h = hourOf(l.id), s = h.species.find(x => x.id === id);
        return { l, act: s ? s.act : 0, score: h.score };
      }).filter(x => x.act > 0).sort((a, b) => (b.act * b.score) - (a.act * a.score)).slice(0, 3);
      return `<article class="sp-card">
        <header><h3>${esc(sp.name)}</h3><span class="muted"><i>${esc(sp.sci)}</i></span></header>
        <div class="season" role="img" aria-label="Season by month: ${sp.season.map((v, m) => MONTHS[m] + ' ' + SEASON[v]).join(', ')}">
          ${sp.season.map((v, m) => `<div class="m${m === cur ? ' cur' : ''}" title="${MONTHS[m]}: ${SEASON[v]}"><span class="q q${v}"></span><small>${M[m]}</small></div>`).join('')}
        </div>
        <p class="muted small">Likes ${sp.temp[0]}–${sp.temp[1]}°C water · ${esc(sp.habitat)}</p>
        <dl>
          <dt>Baits</dt><dd>${sp.baits.map(esc).join(' · ')}</dd>
          <dt>Lures</dt><dd>${sp.lures.map(esc).join(' · ')}</dd>
          <dt>Rig</dt><dd>${esc(sp.rig)}</dd>
          <dt>Size / bag</dt><dd>${sizeTxt(sp)}</dd>
        </dl>
        ${(sp.closures || []).map(c => `<p class="closed-box small">⛔ ${esc(c.note)}</p>`).join('')}
        <p class="tip">💡 ${esc(sp.tips)}</p>
        ${spots.length ? `<div class="sp-spots"><b>Best spots ${state.offset === 0 ? 'now' : 'at selected time'}:</b> ${spots.map(x => `<button class="link" data-goto="${x.l.id}">${esc(x.l.name.split(' – ')[0])} (${x.score})</button>`).join(', ')}</div>` : ''}
      </article>`;
    };
    // Search matches the fish name, scientific name, other names, baits, lures, rig, habitat and tips.
    const words = (state.speciesQ || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    const text = sp => [sp.name, sp.sci, sp.habitat, sp.tips, sp.rig, ...sp.baits, ...sp.lures, sp.water === 'fresh' ? 'freshwater fresh' : 'saltwater salt'].join(' ').toLowerCase();
    const inName = sp => words.every(w => wordMatch(sp.name.toLowerCase(), w));
    const all = Object.entries(SP).filter(([, sp]) => words.every(w => wordMatch(text(sp), w)))
      .sort((a, b) => inName(b[1]) - inName(a[1]));   // fish whose name matches come first
    const salt = all.filter(([, s]) => s.water !== 'fresh'), fresh = all.filter(([, s]) => s.water === 'fresh');
    $('#species-count').textContent = words.length ? `${all.length} of ${Object.keys(SP).length} fish` : `${all.length} fish`;
    $('#species-grid').innerHTML = !all.length
      ? `<p class="empty">No fish match "${esc(state.speciesQ.trim())}". Try a fish name, a bait like "prawn", or a place like "reef".</p>`
      : (salt.length ? `<h2 class="grp">🌊 Saltwater</h2><div class="species-grid">${salt.map(card).join('')}</div>` : '') +
        (fresh.length ? `<h2 class="grp">💧 Freshwater</h2><div class="species-grid">${fresh.map(card).join('')}</div>` : '');
    document.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => { setView('spots'); select(b.dataset.goto); });
  }

  function setView(v) {
    if (v !== 'spots') closeDetail(false);
    state.view = v;
    document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.view === v));
    for (const k of ['spots', 'species', 'alerts', 'log']) $('#view-' + k).hidden = v !== k;
    document.querySelector('.controls').hidden = v === 'alerts' || v === 'log';
    render();
    if (v === 'spots') setTimeout(ensureMapFit, 0);
  }

  // ---------------- Init ----------------
  function init() {
    $('#region').innerHTML = regionOptions('All Australia', true);
    $('#region').value = state.region;
    $('#target').innerHTML = `<option value="">Any species</option>` + Object.entries(SP).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([id, s]) => `<option value="${id}">${s.name}</option>`).join('');

    $('#time').oninput = e => { state.offset = Number(e.target.value); render(); };
    $('#now-btn').onclick = () => { state.offset = 0; $('#time').value = 0; render(); };
    $('#region').onchange = e => { state.region = e.target.value; render(); };
    $('#target').onchange = e => setTarget(e.target.value);
    initFishPicker();
    $('#sort').onchange = e => {
      state.sort = e.target.value;
      if (state.sort === 'distance' && !state.userPos) locate(); else render();
    };
    $('#search').oninput = e => { state.search = e.target.value; render(); };
    $('#species-search').oninput = e => { state.speciesQ = e.target.value; renderSpecies(); };
    document.querySelectorAll('[name=access]').forEach(r => r.onchange = e => { state.access = e.target.value; compute(); render(); });
    document.querySelectorAll('[name=water]').forEach(r => r.onchange = e => { state.water = e.target.value; render(); });
    $('#locate').onclick = locate;
    $('#refresh').onclick = () => load(true);
    $('#retry').onclick = () => load(true);
    $('#list').addEventListener('click', e => { const c = e.target.closest('.card'); if (c) select(c.dataset.id); });
    document.querySelectorAll('.tab').forEach(t => t.onclick = () => setView(t.dataset.view));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.selected) closeDetail(false); });
    window.addEventListener('popstate', () => closeDetail(true));
    $('#filters-toggle').onclick = () => {
      const open = document.querySelector('.controls').classList.toggle('open');
      $('#filters-toggle').setAttribute('aria-expanded', open);
    };
    $('#map-toggle').onclick = () => {
      const on = $('#view-spots').classList.toggle('show-map');
      $('#map-toggle').textContent = on ? '☰ List' : '🗺️ Map';
      if (on) { ensureMapFit(); setTimeout(ensureMapFit, 50); }
    };

    initMap();
    load(false);
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      // updateViaCache 'none' = always check for a new version of the app; when one takes over, reload once.
      const hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(e => console.warn('Service worker not registered', e));
    }
    setInterval(() => { if (state.data) { compute(); render(); } }, 10 * 60 * 1000);
  }

  function locate() {
    if (!navigator.geolocation) return showError('Location is not available in this browser.');
    $('#locate').textContent = 'Locating…';
    navigator.geolocation.getCurrentPosition(p => {
      state.userPos = [p.coords.latitude, p.coords.longitude];
      state.sort = 'distance'; $('#sort').value = 'distance';
      $('#locate').textContent = '📍 Near me';
      if (map) map.setView(state.userPos, 9);
      render();
    }, () => {
      $('#locate').textContent = '📍 Near me';
      state.sort = 'score'; $('#sort').value = 'score';
      showError('Could not get your location – allow location access to sort by distance.');
      render();
    }, { timeout: 10000 });
  }

  // Shared helpers for alerts.js and catchlog.js
  // ---------------- Fish picker (type-ahead) ----------------
  // Common names anglers actually type.
  const NICKNAMES = {
    bream: 'yellowfin bream silver bream', flathead: 'flatty flatties lizard dusky', whiting: 'sandy whiting summer whiting',
    tailor: 'chopper choppers', salmon: 'sambo aussie salmon', mulloway: 'jew jewie jewfish soapy', luderick: 'blackfish blackie',
    kingfish: 'kingy kingie kingies yellowtail kingfish', snapper: 'red reds squire pinkie pink snapper', squid: 'calamari squid', trevally: 'trev trevs blurter',
    drummer: 'pig rock blackfish', mahi: 'dolphin dolphinfish dollies', mackerel: 'spanish spotty spotties macks', bonito: 'bonnie bonnies bonito',
    tigerflathead: 'tiger flatty', bass: 'aussie bass bassy', goldenperch: 'yellowbelly yellas callop', murraycod: 'cod goodoo greenfish',
    trout: 'rainbow brown brownie rainbows', redfin: 'english perch reddie', carp: 'european carp',
    barramundi: 'barra barras', mangrovejack: 'jack jacks red bream', coraltrout: 'trout coral reef', threadfin: 'threadies blue salmon king salmon',
    queenfish: 'queenie queenies', kgwhiting: 'kg kgs king george spotted whiting', herring: 'tommy tommies tommy ruff ruffie',
    blackbream: 'black bream southern bream', dhufish: 'dhuie dhuies jewie wa', sandflathead: 'sandy flatty southern flathead', garfish: 'gar gardies garfish'
  };
  let fishPicks = [], fishActive = -1;
  const spotCount = id => F.LOCATIONS.filter(l => l.species.includes(id)).length;

  function fishMatches(q) {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return Object.keys(SP).sort((a, b) => spotCount(b) - spotCount(a)).slice(0, 8);
    const score = id => {
      const name = SP[id].name.toLowerCase(), text = `${name} ${SP[id].sci.toLowerCase()} ${NICKNAMES[id] || ''}`;
      if (!words.every(w => wordMatch(text, w))) return -1;
      return (name.startsWith(words[0]) ? 3 : 0) + (words.every(w => wordMatch(name, w)) ? 2 : 0) + spotCount(id) / 100;
    };
    return Object.keys(SP).map(id => [id, score(id)]).filter(x => x[1] >= 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
  }

  function showFishSuggest() {
    const box = $('#fish-suggest'), input = $('#fish-search');
    fishPicks = fishMatches(input.value === (SP[state.target] || {}).name ? '' : input.value);
    fishActive = fishPicks.length ? 0 : -1;
    box.innerHTML = fishPicks.length ? fishPicks.map((id, k) => `<li role="option" id="fs-${id}" data-id="${id}" aria-selected="${k === fishActive}">
        <span>${esc(SP[id].name)}</span><small>${SP[id].water === 'fresh' ? '💧' : '🌊'} ${spotCount(id)} spot${spotCount(id) === 1 ? '' : 's'}</small></li>`).join('')
      : '<li class="none">No fish by that name – try the Species tab</li>';
    box.hidden = false; input.setAttribute('aria-expanded', 'true');
  }
  function hideFishSuggest() { $('#fish-suggest').hidden = true; $('#fish-search').setAttribute('aria-expanded', 'false'); }
  function moveFishActive(d) {
    if (!fishPicks.length) return;
    fishActive = (fishActive + d + fishPicks.length) % fishPicks.length;
    document.querySelectorAll('#fish-suggest [role=option]').forEach((li, k) => li.setAttribute('aria-selected', k === fishActive));
    $('#fish-search').setAttribute('aria-activedescendant', 'fs-' + fishPicks[fishActive]);
  }
  function setTarget(id) {
    state.target = id || '';
    $('#target').value = state.target;
    $('#fish-search').value = id ? SP[id].name : '';
    $('#fish-clear').hidden = !id;
    $('.fish-pick').classList.toggle('on', !!id);
    hideFishSuggest();
    compute(); render();
  }
  function initFishPicker() {
    const input = $('#fish-search');
    input.addEventListener('focus', () => { input.select(); showFishSuggest(); });
    input.addEventListener('input', showFishSuggest);
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if ($('#fish-suggest').hidden) showFishSuggest(); else moveFishActive(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveFishActive(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (fishActive >= 0) { setTarget(fishPicks[fishActive]); input.blur(); } }
      else if (e.key === 'Escape') { hideFishSuggest(); input.value = state.target ? SP[state.target].name : ''; input.blur(); }
    });
    // pointerdown (not click) so it fires before the input loses focus
    $('#fish-suggest').addEventListener('pointerdown', e => {
      const li = e.target.closest('[data-id]');
      if (li) { e.preventDefault(); setTarget(li.dataset.id); input.blur(); }
    });
    input.addEventListener('blur', () => setTimeout(() => {
      hideFishSuggest();
      if (!input.value.trim() && state.target) setTarget('');
      else input.value = state.target ? SP[state.target].name : '';
    }, 120));
    $('#fish-clear').onclick = () => setTarget('');
  }

  // State → region dropdown (shared with alerts). Values: 'all', 'favs', 'pins', 'state:XX' or a region name.
  function regionOptions(allLabel, extras) {
    return `<option value="all">${allLabel}</option>` +
      (extras ? `<option value="favs">★ Saved spots</option><option value="pins">📌 My pins</option>` : '') +
      Object.entries(F.STATES).map(([st, s]) => {
        const regions = F.REGIONS_BY_STATE[st] || [];
        return `<optgroup label="${s.name}"><option value="state:${st}">All ${st}</option>${regions.length > 1 ? regions.map(r => `<option>${esc(r)}</option>`).join('') : ''}</optgroup>`;
      }).join('');
  }

  F.ui = { state, tm, hr, day, esc, select, setView, render, bucket, LABEL, TYPE, wx, arrow, n1, sizeTxt, regionOptions,
    jumpTo, showError, loadPins, closeDetail, findLoc: id => F.LOCATIONS.find(l => l.id === id), get map() { return map; } };

  document.addEventListener('DOMContentLoaded', init);
})();
