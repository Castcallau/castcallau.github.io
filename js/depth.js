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

  // ---------- Clean, pre-saved depth images ----------
  // Each NSW spot ships with a 1.4 km depth image (depthmaps/<id>.png) saved from the survey server. The server's
  // colour scale changes from image to image, so each one is calibrated against that spot's 81 saved depth
  // readings, then redrawn in nautical blues. Water shallower than 0.6 m is left clear so it never paints over
  // beaches or the shoreline, and tapping reads the depth straight from the image – no waiting on the server.
  const RM = 20037508.34, HALF = 700;
  const merc = (la, lo) => [lo * RM / 180, Math.log(Math.tan((90 + la) * Math.PI / 360)) / (Math.PI / 180) * RM / 180];
  const unmerc = (x, y) => [Math.atan(Math.exp(y / RM * Math.PI)) * 360 / Math.PI - 90, x / RM * 180];
  const colourKey = (r, g, b) => g + Math.max(0, 230 - r) + 0.3 * b;   // rises steadily from shallow (red) to deep (yellow → blue)
  const STOPS = [[0.6, [205, 226, 251]], [2, [158, 197, 244]], [4, [109, 167, 236]], [7, [57, 135, 229]], [10, [42, 120, 214]],
    [15, [37, 106, 191]], [20, [33, 98, 180]], [30, [30, 88, 166]], [45, [24, 79, 149]]];
  function depthColour(d) {
    if (d <= STOPS[0][0]) return STOPS[0][1];
    for (let k = 1; k < STOPS.length; k++) if (d <= STOPS[k][0]) {
      const [d0, c0] = STOPS[k - 1], [d1, c1] = STOPS[k], t = (d - d0) / (d1 - d0);
      return c0.map((v, i) => Math.round(v + (c1[i] - v) * t));
    }
    return STOPS[STOPS.length - 1][1];
  }
  const staticCache = {};
  async function staticDepth(l, g) {
    if (staticCache[l.id] !== undefined) return staticCache[l.id];
    const h = HALF / Math.cos(l.lat * Math.PI / 180), [cx, cy] = merc(l.lat, l.lon), W = 640;
    const img = new Image(); img.src = `depthmaps/${l.id}.png`;
    try { await new Promise((res, rej) => { img.onload = res; img.onerror = rej; }); } catch (e) { return (staticCache[l.id] = null); }
    const c = document.createElement('canvas'); c.width = W; c.height = W;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, W, W);
    const px = ctx.getImageData(0, 0, W, W), d = px.data;
    const toPix = (la, lo) => { const [x, y] = merc(la, lo); return [Math.floor((x - (cx - h)) / (2 * h) * W), Math.floor(((cy + h) - y) / (2 * h) * W)]; };
    // calibration pairs: colour key at each saved reading -> its real depth
    const pairs = [], n = g.n, mid = (n - 1) / 2;
    g.d.forEach((v, k) => {
      if (v == null || v > 0) return;
      const i = Math.floor(k / n), j = k % n;
      const [x, y] = toPix(l.lat + (i - mid) * g.step / 111320, l.lon + (j - mid) * g.step / (111320 * Math.cos(l.lat * Math.PI / 180)));
      const o = (y * W + x) * 4; if (d[o + 3] < 200) return;
      pairs.push([colourKey(d[o], d[o + 1], d[o + 2]), -v]);
    });
    if (pairs.length < 8) return (staticCache[l.id] = null);
    pairs.sort((a, b) => a[0] - b[0]);
    // smooth into ~12 bins, then make depth only ever increase with the colour key
    const bins = [], per = Math.max(2, Math.floor(pairs.length / 12));
    for (let s = 0; s < pairs.length; s += per) { const part = pairs.slice(s, s + per); bins.push([part.reduce((a, p) => a + p[0], 0) / part.length, part.reduce((a, p) => a + p[1], 0) / part.length]); }
    for (let k = 1; k < bins.length; k++) bins[k][1] = Math.max(bins[k][1], bins[k - 1][1]);
    const keyToDepth = kk => {
      if (kk <= bins[0][0]) return Math.max(0, bins[0][1] - (bins[0][0] - kk) * 0.05);
      for (let q = 1; q < bins.length; q++) if (kk <= bins[q][0]) { const [k0, d0] = bins[q - 1], [k1, d1] = bins[q]; return d0 + (d1 - d0) * ((kk - k0) / ((k1 - k0) || 1)); }
      return bins[bins.length - 1][1];
    };
    const depths = new Float32Array(W * W).fill(NaN), memo = new Map();
    for (let p = 0; p < W * W; p++) {
      const o = p * 4;
      if (d[o + 3] < 200) { d[o + 3] = 0; continue; }
      const kk = Math.round(colourKey(d[o], d[o + 1], d[o + 2]));
      let dep = memo.get(kk); if (dep === undefined) { dep = keyToDepth(kk); memo.set(kk, dep); }
      depths[p] = dep;
      if (dep < 0.6) { d[o + 3] = 0; continue; }          // keep beaches and the waterline clean
      const col = depthColour(dep), x = p % W, y = (p / W) | 0, edge = Math.min(x, y, W - 1 - x, W - 1 - y);
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = Math.round(195 * Math.min(1, edge / 60));   // fade out at the edges
    }
    ctx.putImageData(px, 0, 0);
    const [la0, lo0] = unmerc(cx - h, cy - h), [la1, lo1] = unmerc(cx + h, cy + h);
    const out = {
      url: c.toDataURL('image/png'), bounds: [[la0, lo0], [la1, lo1]],
      depthAt(la, lo) { const [x, y] = toPix(la, lo); if (x < 0 || y < 0 || x >= W || y >= W) return undefined; const v = depths[y * W + x]; return isNaN(v) ? null : v; }
    };
    return (staticCache[l.id] = out);
  }

  let mini = null, miniFor = null, miniEl = null, markersLayer = null, overlays = [], depthLayer = null, staticInfo = null;
  function buildMap(l) {
    miniEl = document.createElement('div');
    miniEl.className = 'depth-map';
    mini = L.map(miniEl, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, minZoom: 12, maxZoom: 18 }).setView([l.lat, l.lon], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(mini);
    overlays = [viewOverlay(mini, REEF, 1, '&layerDefs=' + encodeURIComponent(JSON.stringify({ 1: "REEF='Reef'" })), 0.45, 'Reefs: NSW seabed reef map')];
    markersLayer = L.layerGroup().addTo(mini);
    L.circleMarker([l.lat, l.lon], { radius: 6, color: '#fff', weight: 2, fillColor: '#0b0b0b', fillOpacity: 1 }).addTo(mini).bindTooltip(l.name);
    depthLayer = null; staticInfo = null;
    mini.on('click', async e => {
      const pop = L.popup().setLatLng(e.latlng).openOn(mini);
      const fmt = v => v == null ? 'No depth here (land, or outside the survey)' : v < 0.6 ? 'Very shallow / dry at low tide' : `<b>About ${v.toFixed(1)} m deep</b><br><small>below mean sea level</small>`;
      const quick = staticInfo && staticInfo.depthAt(e.latlng.lat, e.latlng.lng);
      if (quick !== undefined && staticInfo) { pop.setContent(fmt(quick)); return; }
      pop.setContent('Checking depth…');
      try { const v = await identify(e.latlng.lat, e.latlng.lng); pop.setContent(fmt(v == null ? null : -v)); }
      catch (err) { pop.setContent('Could not get the depth – check your connection.'); }
    });
    miniFor = l.id;
  }

  // Depth layer: the clean pre-saved image when we have one, otherwise the live server image (pins).
  async function addDepthLayer(l, g) {
    if (depthLayer) return;
    const s = g && g !== 'none' ? await staticDepth(l, g) : null;
    if (miniFor !== l.id) return;
    if (s) {
      staticInfo = s;
      depthLayer = L.imageOverlay(s.url, s.bounds, { opacity: 1, attribution: 'Depth: NSW Govt 2018 LiDAR + multibeam' }).addTo(mini);
      mini.fitBounds(L.latLngBounds(s.bounds).pad(-0.12));   // start zoomed to the depth image
      mini.setMaxBounds(L.latLngBounds(s.bounds).pad(0.15));
    } else {
      depthLayer = true;
      const upd = viewOverlay(mini, BATHY, 0, '', 0.7, 'Depth: NSW Govt 2018 LiDAR + multibeam');
      overlays.push(upd); upd();
    }
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
    addDepthLayer(l, g && g !== 'none' && GRIDS[l.id] ? g : null);
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
      <div class="depth-legend"><span class="ramp-wrap"><span class="ramp"></span><span class="ticks"><i>1 m</i><i>5</i><i>10</i><i>20</i><i>30 m+</i></span></span><span class="reef-key"></span><span>Reef</span></div>
      <p class="caption">Tap anywhere on the water for the exact depth. Numbers mark deep holes, ↘ the steepest drop-off and ▼ the deepest point nearby.</p>
      <div id="depth-list"></div>
      <p class="muted small">Source: NSW Government marine LiDAR (2018) and multibeam surveys, plus the NSW seabed reef map. A fishing guide only – <b>not for navigation</b>.</p>
    </section>`;
  }

  F.depth = { sectionHtml, mount, analyse, covered };
})();
