// Depth & structure (⭐ Pro – free for now).
// Seabed depth from the NSW Government's combined bathymetry (2018 marine LiDAR + multibeam surveys) and
// the NSW seabed reef map. Depth grids around each built-in NSW spot are pre-sampled (js/data/depth-grids.js)
// so the deep holes and drop-offs show instantly; pins are sampled live. NOT for navigation.
window.FISH = window.FISH || {};
(function () {
  const F = window.FISH;
  const BATHY = 'https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Marine/NSW_Bathymetry/MapServer';
  const REEF = 'https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Marine/NSW_seabed_reef_extent/MapServer';
  const PRO_FREE = true;   // flip to false later to put this behind a subscription
  const $ = s => document.querySelector(s);

  // Covered by the NSW survey (state waters from Point Danger to Cape Howe).
  const covered = l => l && l.water === 'salt' && l.lat < -28.1 && l.lat > -37.6 && l.lon > 149.8 && l.lon < 153.7 && (l.state === 'NSW' || l.pin);

  // ---------- Grids & hole finding ----------
  const GRIDS = (F.DEPTH_GRIDS && F.DEPTH_GRIDS.spots) || {};
  const META = (F.DEPTH_GRIDS && F.DEPTH_GRIDS.meta) || { n: 9, step: 110 };
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

  function cellInfo(g, i, j) {
    const c = (g.n - 1) / 2, north = (i - c) * g.step, east = (j - c) * g.step;
    const dist = Math.round(Math.hypot(north, east));
    const brg = (Math.atan2(east, north) * 180 / Math.PI + 360) % 360;
    return { dist, dir: dist < 30 ? 'right here' : `${dist} m ${COMPASS[Math.round(brg / 22.5) % 16]}`,
      lat: g.lat + north / 111320, lon: g.lon + east / (111320 * Math.cos(g.lat * Math.PI / 180)) };
  }

  // depths: flat array (row i = south→north, col j = west→east), metres (negative below sea level) or null.
  function analyse(g) {
    const n = g.n, d = (i, j) => (i < 0 || j < 0 || i >= n || j >= n) ? null : g.d[i * n + j];
    const wet = g.d.filter(v => v != null && v < -0.3);
    if (wet.length < 6) return null;
    const deepest = Math.min(...wet);
    // Holes: cells deeper than all their neighbours, and clearly deeper than the average around them.
    const holes = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = d(i, j); if (v == null || v > -0.5) continue;
      if (i === 0 || j === 0 || i === n - 1 || j === n - 1) continue;   // edge of the search: can't tell it's really a hole
      const nb = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (a || b) { const w = d(i + a, j + b); if (w != null) nb.push(w); }
      if (nb.length < 3 || nb.some(w => w < v)) continue;
      const avg = nb.reduce((s, w) => s + w, 0) / nb.length;
      if (avg - v >= 0.4) holes.push({ i, j, depth: -v, rise: avg - v, ...cellInfo(g, i, j) });
    }
    holes.sort((a, b) => b.depth - a.depth);
    // Keep holes at least 2 cells apart so the list shows different places, not one hole twice.
    const picked = [];
    for (const h of holes) if (picked.every(p => Math.max(Math.abs(p.i - h.i), Math.abs(p.j - h.j)) >= 2)) picked.push(h);
    holes.length = 0; holes.push(...picked);
    // Drop-off: steepest change between neighbouring cells.
    let drop = null;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = d(i, j); if (v == null) continue;
      [[0, 1], [1, 0], [1, 1], [1, -1]].forEach(([a, b]) => {
        const w = d(i + a, j + b); if (w == null || Math.max(v, w) > -0.3) return;
        const ch = Math.abs(v - w);
        if (!drop || ch > drop.change) {
          // Mark the drop-off halfway between the shallow and deep readings (the edge itself).
          const mid = cellInfo(g, i + a / 2, j + b / 2);
          drop = { change: ch, from: -Math.max(v, w), to: -Math.min(v, w), ...mid };
        }
      });
    }
    if (drop && drop.change < 1.5) drop = null;  // not really a drop-off
    // Deepest point in the search area (always shown, even where the bottom just slopes away).
    const di = g.d.indexOf(deepest), deepestAt = cellInfo(g, Math.floor(di / n), di % n);
    const top = holes.slice(0, 3), isHole = top.some(h => h.i * n + h.j === di);
    return { deepest: -deepest, deepestAt: isHole ? null : deepestAt, holes: top, drop, wetShare: wet.length / g.d.length };
  }

  // Live sampling for pins (and any spot without a stored grid). Cached per spot – the seabed doesn't move.
  async function identify(lat, lon) {
    const e = 0.005, ext = [lon - e, lat - e, lon + e, lat + e].map(v => v.toFixed(5)).join(',');
    const r = await fetch(`${BATHY}/identify?geometry=${lon},${lat}&geometryType=esriGeometryPoint&sr=4326&layers=all:0&tolerance=0&mapExtent=${ext}&imageDisplay=400,400,96&returnGeometry=false&f=json`);
    // The server names the field "Pixel Value" or "Stretch.Pixel Value" depending on the area – accept either.
    const j = await r.json(), at = (j.results && j.results[0] && j.results[0].attributes) || {};
    const key = Object.keys(at).find(k => /Pixel Value$/.test(k)), v = key ? at[key] : null;
    const num = parseFloat(v);
    return isNaN(num) ? null : num;
  }
  async function sampleGrid(l, n = 7, step = 120) {
    const key = `castcall-depth2-${l.id}-${l.lat.toFixed(4)},${l.lon.toFixed(4)}`;
    try { const c = JSON.parse(localStorage.getItem(key) || 'null'); if (c) return c; } catch (e) { /* ignore */ }
    const pts = [], dLat = step / 111320, dLon = step / (111320 * Math.cos(l.lat * Math.PI / 180)), c = (n - 1) / 2;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) pts.push([l.lat + (i - c) * dLat, l.lon + (j - c) * dLon]);
    const out = new Array(pts.length).fill(null);
    let k = 0;
    await Promise.all(Array.from({ length: 5 }, async () => {
      while (k < pts.length) { const me = k++; try { out[me] = await identify(...pts[me]); } catch (e) { out[me] = null; } }
    }));
    const g = { lat: l.lat, lon: l.lon, n, step, d: out.map(v => v == null ? null : Math.round(v * 10) / 10) };
    try { localStorage.setItem(key, JSON.stringify(g)); } catch (e) { /* storage full */ }
    return g;
  }
  // A stored grid, 'none' if we already know the survey doesn't reach this spot, or null (sample it live).
  function storedGrid(l) {
    if (!(l.id in GRIDS)) return null;
    const arr = GRIDS[l.id];
    return arr ? { lat: l.lat, lon: l.lon, n: META.n, step: META.step, d: arr } : 'none';
  }

  // ---------- Map ----------
  if (typeof L === "undefined") { F.depth = { sectionHtml: () => "", mount: () => {}, analyse, covered }; return; }
  // One image for the whole visible area (not tiles): the server shades each request separately, so tiles
  // came out in mismatched colours. A single image per view keeps the depth colours consistent.
  function viewOverlay(map, base, layer, extra, opacity, attribution) {
    let ov = null, timer = null, last = '';
    const update = () => {
      const sz = map.getSize();
      if (sz.x < 50 || sz.y < 50) return;
      const b = map.getBounds(), dpr = Math.min(2, window.devicePixelRatio || 1);
      const sw = L.CRS.EPSG3857.project(b.getSouthWest()), ne = L.CRS.EPSG3857.project(b.getNorthEast());
      const url = `${base}/export?bbox=${sw.x.toFixed(1)},${sw.y.toFixed(1)},${ne.x.toFixed(1)},${ne.y.toFixed(1)}&bboxSR=3857&imageSR=3857` +
        `&size=${Math.round(sz.x * dpr)},${Math.round(sz.y * dpr)}&format=png32&transparent=true&layers=show:${layer}${extra || ''}&f=image`;
      if (url === last) return; last = url;
      const img = new Image();
      img.onload = () => { if (url !== last) return; if (ov) ov.setUrl(url).setBounds(b); else ov = L.imageOverlay(url, b, { opacity, attribution }).addTo(map); };
      img.src = url;
    };
    map.on('moveend zoomend resize', () => { clearTimeout(timer); timer = setTimeout(update, 200); });
    return update;
  }

  let mini = null, miniFor = null, miniEl = null, markersLayer = null, overlays = [];
  function buildMap(l) {
    miniEl = document.createElement('div');
    miniEl.className = 'depth-map';
    mini = L.map(miniEl, { zoomControl: true, attributionControl: true, scrollWheelZoom: false }).setView([l.lat, l.lon], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(mini);
    overlays = [
      viewOverlay(mini, BATHY, 0, '', 0.85, 'Depth: NSW Govt 2018 LiDAR + multibeam'),
      viewOverlay(mini, REEF, 1, '&layerDefs=' + encodeURIComponent(JSON.stringify({ 1: "REEF='Reef'" })), 0.55, 'Reefs: NSW seabed reef map 2023')
    ];
    markersLayer = L.layerGroup().addTo(mini);
    L.circleMarker([l.lat, l.lon], { radius: 6, color: '#fff', weight: 2, fillColor: '#0b0b0b', fillOpacity: 1 }).addTo(mini).bindTooltip(l.name);
    mini.on('click', async e => {
      const pop = L.popup().setLatLng(e.latlng).setContent('Checking depth…').openOn(mini);
      try {
        const v = await identify(e.latlng.lat, e.latlng.lng);
        pop.setContent(v == null ? 'No depth data here (land, or outside the survey)' : v > 0 ? `About ${v.toFixed(1)} m above sea level (land / dry at low tide)` : `<b>${(-v).toFixed(1)} m deep</b><br><small>below mean sea level</small>`);
      } catch (err) { pop.setContent('Could not get the depth – check your connection.'); }
    });
    miniFor = l.id;
  }

  function addMarkers(res) {
    markersLayer.clearLayers();
    if (!res) return;
    res.holes.forEach((h, k) => L.marker([h.lat, h.lon], { icon: L.divIcon({ className: '', html: `<div class="hole-pin">${k + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) })
      .addTo(markersLayer).bindTooltip(`Hole ${k + 1}: ${h.depth.toFixed(1)} m`));
    if (res.drop) L.marker([res.drop.lat, res.drop.lon], { icon: L.divIcon({ className: '', html: '<div class="hole-pin drop">↘</div>', iconSize: [26, 26], iconAnchor: [13, 13] }) })
      .addTo(markersLayer).bindTooltip(`Drop-off: ${res.drop.from.toFixed(1)} → ${res.drop.to.toFixed(1)} m`);
    if (res.deepestAt) L.marker([res.deepestAt.lat, res.deepestAt.lon], { icon: L.divIcon({ className: '', html: '<div class="hole-pin deep">▼</div>', iconSize: [26, 26], iconAnchor: [13, 13] }) })
      .addTo(markersLayer).bindTooltip(`Deepest nearby: ${res.deepest.toFixed(1)} m`);
  }

  function listHtml(l, res, g) {
    if (!res) return '<p class="muted small">No depth readings around this exact spot (it may be on land or just outside the survey). Pan the map and tap the water to check depths.</p>';
    const beach = l.type === 'beach' || l.type === 'rock';
    return `<ul class="holes">
        ${res.holes.map((h, k) => `<li><span class="hole-pin small">${k + 1}</span><b>Hole – ${h.depth.toFixed(1)} m</b> <span class="muted">${h.dir} · about ${h.rise.toFixed(1)} m deeper than around it</span></li>`).join('')}
        ${res.drop ? `<li><span class="hole-pin small drop">↘</span><b>Drop-off – ${res.drop.from.toFixed(1)} → ${res.drop.to.toFixed(1)} m</b> <span class="muted">${res.drop.dir} · fish the edge</span></li>` : ''}
        ${res.deepestAt ? `<li><span class="hole-pin small deep">▼</span><b>Deepest nearby – ${res.deepest.toFixed(1)} m</b> <span class="muted">${res.deepestAt.dir}${res.holes.length ? '' : ' · the bottom keeps sloping away, so it may get deeper further out'}</span></li>` : ''}
      </ul>
      <p class="muted small">Searched about ${Math.round(g.step * (g.n - 1) / 2)} m around the spot.
        ${beach ? '<br>⚠️ Beach gutters and sandbars move with every swell – this survey is from 2018, so use it as a guide and read the water on the day.' : ''}</p>`;
  }

  // Called after the spot details are drawn. Re-uses the same mini map while you stay on one spot.
  async function mount(l) {
    const slot = $('#depth-slot');
    if (!slot || !covered(l)) return;
    if (miniFor !== l.id) { if (mini) mini.remove(); buildMap(l); }
    slot.replaceWith(miniEl);
    setTimeout(() => { mini.invalidateSize(); overlays.forEach(u => u()); }, 0);
    const listEl = $('#depth-list');
    let g = storedGrid(l);
    if (g === 'none') {
      addMarkers(null);
      listEl.innerHTML = '<p class="muted small">The 2018 depth survey doesn\'t reach this exact spot (it mostly covers the open coast, bays and lower estuaries). Pan the map and tap the water to check depths nearby.</p>';
      return;
    }
    if (!g) {
      listEl.innerHTML = '<p class="muted small">🔍 Reading the seabed around this spot…</p>';
      try { g = await sampleGrid(l); } catch (e) { listEl.innerHTML = '<p class="muted small">Could not reach the depth survey – check your connection.</p>'; return; }
      if (F.ui.state.selected !== l.id || !$('#depth-list')) return;
    }
    const res = analyse(g);
    addMarkers(res);
    $('#depth-list').innerHTML = listHtml(l, res, g);
  }

  function sectionHtml(l) {
    if (!l || l.water !== 'salt') return '';
    const badge = `<span class="pro-badge" title="This will be part of CastCall Pro later">⭐ Pro${PRO_FREE ? ' – free for now' : ''}</span>`;
    if (!covered(l)) return `<section><h3>🗺️ Depth &amp; structure ${badge}</h3><p class="muted small">Detailed depth maps cover NSW for now. ${F.STATES[l.state] ? F.STATES[l.state].name : 'This state'} is coming later.</p></section>`;
    return `<section>
      <h3>🗺️ Depth &amp; structure ${badge}</h3>
      <div id="depth-slot" class="depth-map"></div>
      <div class="depth-legend"><span>Shallow</span><span class="ramp"></span><span>Deep</span><span class="reef-key"></span><span>Reef</span></div>
      <p class="caption">Tap anywhere on the water for the exact depth. Numbers mark deep holes, ↘ the steepest drop-off and ▼ the deepest point nearby.</p>
      <div id="depth-list"></div>
      <p class="muted small">Source: NSW Government marine LiDAR (2018) and multibeam surveys, plus the NSW seabed reef map. A fishing guide only – <b>not for navigation</b>.</p>
    </section>`;
  }

  F.depth = { sectionHtml, mount, analyse, covered };
})();
