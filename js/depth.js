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
  const nswCovered = l => l && l.water === 'salt' && l.lat < -28.1 && l.lat > -37.6 && l.lon > 149.8 && l.lon < 153.7 && (l.state === 'NSW' || l.pin);
  function covered(l) { try { return nswCovered(l) || auCovered(l); } catch (e) { return nswCovered(l); } }

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
  // colour scale changes from image to image, so each one is calibrated against that spot's 81 exact depth
  // readings, then redrawn as chart-style depth bands with contour lines. Water shallower than 0.6 m is left clear
  // so it never paints over beaches. Tapping shows the image's reading at once, then the exact survey value.
  const RM = 20037508.34, HALF = 700;
  const merc = (la, lo) => [lo * RM / 180, Math.log(Math.tan((90 + la) * Math.PI / 360)) / (Math.PI / 180) * RM / 180];
  const unmerc = (x, y) => [Math.atan(Math.exp(y / RM * Math.PI)) * 360 / Math.PI - 90, x / RM * 180];
  const colourKey = (r, g, b) => g + Math.max(0, 230 - r) + 0.3 * b;   // rises steadily from shallow (red) to deep (yellow → blue)

  // Depth bands, like a fishing chart: each band has its own colour and a contour line where it changes.
  const BANDS = [
    { to: 1, c: [196, 240, 222], label: '0–1' },
    { to: 2, c: [150, 228, 214], label: '1–2' },
    { to: 3, c: [102, 211, 216], label: '2–3' },
    { to: 5, c: [64, 182, 220], label: '3–5' },
    { to: 10, c: [44, 146, 212], label: '5–10' },
    { to: 15, c: [36, 115, 196], label: '10–15' },
    { to: 20, c: [30, 92, 174], label: '15–20' },
    { to: 30, c: [24, 70, 147], label: '20–30' },
    { to: Infinity, c: [16, 48, 108], label: '30+' }];
  // Colours blend smoothly from band to band (no hard steps); contour lines only at the key depths.
  const STOPS = BANDS.map((b, k) => [k ? (BANDS[k - 1].to + (isFinite(b.to) ? b.to : 40)) / 2 : 0.6, b.c]);
  const CONTOURS = [2, 5, 10, 20, 30];
  const levelOf = d => { let k = 0; while (k < CONTOURS.length && d >= CONTOURS[k]) k++; return k; };
  function depthColour(d) {
    if (d <= STOPS[0][0]) return STOPS[0][1];
    for (let k = 1; k < STOPS.length; k++) if (d <= STOPS[k][0]) {
      const [d0, c0] = STOPS[k - 1], [d1, c1] = STOPS[k], t = (d - d0) / (d1 - d0);
      return c0.map((v, i) => Math.round(v + (c1[i] - v) * t));
    }
    return STOPS[STOPS.length - 1][1];
  }
  // Soften speckle in the survey image: average each pixel with its neighbours (display only – taps use the raw depths).
  function smooth(src, W, r) {
    const tmp = new Float32Array(W * W), out = new Float32Array(W * W);
    for (const [a, b, dx] of [[src, tmp, 1], [tmp, out, W]]) {
      for (let p = 0; p < W * W; p++) {
        if (isNaN(src[p])) { b[p] = NaN; continue; }
        const x = p % W, y = (p / W) | 0; let s = 0, n = 0;
        for (let k = -r; k <= r; k++) {
          const xx = dx === 1 ? x + k : x, yy = dx === 1 ? y : y + k;
          if (xx < 0 || yy < 0 || xx >= W || yy >= W) continue;
          const v = a[yy * W + xx]; if (!isNaN(v)) { s += v; n++; }
        }
        b[p] = n ? s / n : NaN;
      }
    }
    return out;
  }

  // Colour → depth calibration: isotonic (only-ever-deeper) fit through the exact readings, extended past the ends.
  function calibrate(pairs) {
    pairs.sort((a, b) => a[0] - b[0]);
    const blocks = [];
    for (const [k, d] of pairs) {
      blocks.push({ k, d, n: 1 });
      while (blocks.length > 1 && blocks[blocks.length - 2].d >= blocks[blocks.length - 1].d) {
        const b = blocks.pop(), a = blocks[blocks.length - 1], n = a.n + b.n;
        a.k = (a.k * a.n + b.k * b.n) / n; a.d = (a.d * a.n + b.d * b.n) / n; a.n = n;
      }
    }
    const pts = blocks.map(b => [b.k, b.d]), m = pts.length;
    const slope = (p, q) => Math.max(0, (q[1] - p[1]) / ((q[0] - p[0]) || 1));
    const sLo = m > 1 ? slope(pts[0], pts[1]) : 0, sHi = m > 1 ? slope(pts[m - 2], pts[m - 1]) : 0, maxD = pts[m - 1][1];
    return kk => {
      if (kk <= pts[0][0]) return Math.max(0, pts[0][1] - (pts[0][0] - kk) * sLo);
      for (let q = 1; q < m; q++) if (kk <= pts[q][0]) { const [k0, d0] = pts[q - 1], [k1, d1] = pts[q]; return d0 + (d1 - d0) * ((kk - k0) / ((k1 - k0) || 1)); }
      return Math.min(maxD * 1.6, maxD + (kk - pts[m - 1][0]) * sHi);   // deeper than any reading: keep the trend going (capped)
    };
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
    const keyAt = (x, y) => { const o = (y * W + x) * 4; return d[o + 3] < 200 ? null : colourKey(d[o], d[o + 1], d[o + 2]); };
    // calibration pairs: the median colour key around each exact reading -> its real depth
    const pairs = [], n = g.n, mid = (n - 1) / 2;
    g.d.forEach((v, k) => {
      if (v == null || v > 0) return;
      const i = Math.floor(k / n), j = k % n;
      const [x, y] = toPix(l.lat + (i - mid) * g.step / 111320, l.lon + (j - mid) * g.step / (111320 * Math.cos(l.lat * Math.PI / 180)));
      const ks = [];
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const xx = x + a, yy = y + b; if (xx >= 0 && yy >= 0 && xx < W && yy < W) { const kk = keyAt(xx, yy); if (kk != null) ks.push(kk); } }
      if (ks.length < 5) return;
      ks.sort((p, q) => p - q);
      pairs.push([ks[ks.length >> 1], -v]);
    });
    if (pairs.length < 8) return (staticCache[l.id] = null);
    const keyToDepth = calibrate(pairs);
    const depths = new Float32Array(W * W).fill(NaN), memo = new Map();
    for (let p = 0; p < W * W; p++) {
      const o = p * 4;
      if (d[o + 3] < 200) continue;
      const kk = Math.round(colourKey(d[o], d[o + 1], d[o + 2]));
      let dep = memo.get(kk); if (dep === undefined) { dep = keyToDepth(kk); memo.set(kk, dep); }
      depths[p] = dep;
    }
    paint(d, depths, W, 3);
    ctx.putImageData(px, 0, 0);
    const [la0, lo0] = unmerc(cx - h, cy - h), [la1, lo1] = unmerc(cx + h, cy + h);
    const out = {
      url: c.toDataURL('image/png'), bounds: [[la0, lo0], [la1, lo1]],
      depthAt(la, lo) { const [x, y] = toPix(la, lo); if (x < 0 || y < 0 || x >= W || y >= W) return undefined; const v = depths[y * W + x]; return isNaN(v) ? null : v; }
    };
    return (staticCache[l.id] = out);
  }

  // Paint smooth colours, with soft contour lines at 2, 5, 10, 20 and 30 m (same look for every state).
  function paint(d, depths, W, r) {
    const sm = r ? smooth(depths, W, r) : depths;
    for (let p = 0; p < W * W; p++) {
      const o = p * 4, dep = sm[p];
      if (isNaN(dep) || dep < 0.6) { d[o + 3] = 0; continue; }          // keep beaches and the waterline clean
      const x = p % W, y = (p / W) | 0, edge = Math.min(x, y, W - 1 - x, W - 1 - y);
      const fade = Math.min(1, edge / 110) * Math.min(1, (dep - 0.6) / 0.8);   // soft edges: at the image border and at the shoreline
      const lv = levelOf(dep), rr = x < W - 1 ? sm[p + 1] : NaN, dn = y < W - 1 ? sm[p + W] : NaN;
      const contour = (!isNaN(rr) && rr >= 0.6 && levelOf(rr) !== lv) || (!isNaN(dn) && dn >= 0.6 && levelOf(dn) !== lv);
      const col = depthColour(dep), mix = contour ? 0.55 : 0;
      d[o] = Math.round(col[0] + (255 - col[0]) * mix); d[o + 1] = Math.round(col[1] + (255 - col[1]) * mix); d[o + 2] = Math.round(col[2] + (255 - col[2]) * mix);
      d[o + 3] = Math.round(205 * fade);
    }
  }

  // ---------- Every other state: Geoscience Australia / AusSeabed survey grids ----------
  // The national seabed warehouse holds 30 m regional depth models (Great Barrier Reef, Northern Australia,
  // Bass Strait) and hundreds of finer multibeam surveys. For each spot we use the finest survey that covers it,
  // download the raw depths for 1.4 km around it (no colour guessing needed) and draw it exactly like NSW.
  const AUS = 'https://warehouse.ausseabed.gov.au/geoserver/ows';
  const AU_LAYERS = F.DEPTH_AU_LAYERS || [];      // [name, resolution m, west, south, east, north]
  const MAX_RES = 60;                              // coarser than this can't show holes and ledges near a spot
  const auCandidates = (lat, lon) => AU_LAYERS.filter(a => a[1] <= MAX_RES && lon >= a[2] && lon <= a[4] && lat >= a[3] && lat <= a[5]).sort((a, b) => a[1] - b[1]);
  const auCovered = l => l && l.water === 'salt' && !nswCovered(l) && auCandidates(l.lat, l.lon).length > 0;

  // Minimal GeoTIFF reader: the warehouse sends uncompressed 32-bit float grids (one strip or tiles).
  function readTiff(buf) {
    const dv = new DataView(buf), le = dv.getUint8(0) === 0x49, u16 = o => dv.getUint16(o, le), u32 = o => dv.getUint32(o, le);
    const ifd = u32(4), n = u16(ifd), T = {};
    for (let i = 0; i < n; i++) {
      const o = ifd + 2 + i * 12, tag = u16(o), type = u16(o + 2), cnt = u32(o + 4);
      const val = k => type === 3 ? (cnt <= 2 ? u16(o + 8 + 2 * k) : u16(u32(o + 8) + 2 * k)) : (cnt === 1 ? u32(o + 8) : u32(u32(o + 8) + 4 * k));
      T[tag] = { cnt, type, val, raw: o };
    }
    if (T[259] && T[259].val(0) !== 1) throw new Error('compressed');
    const W = T[256].val(0), H = T[257].val(0), out = new Float32Array(W * H).fill(NaN);
    let nodata = null;
    if (T[42113]) { const t = T[42113], off = t.cnt <= 4 ? t.raw + 8 : u32(t.raw + 8); let s = ''; for (let k = 0; k < t.cnt; k++) { const ch = dv.getUint8(off + k); if (ch) s += String.fromCharCode(ch); } nodata = parseFloat(s); }
    const put = (x, y, v) => { if (x < W && y < H) out[y * W + x] = (nodata != null && Math.abs(v - nodata) < 1e-3) || !isFinite(v) || v < -12000 ? NaN : v; };
    if (T[322]) {            // tiled
      const tw = T[322].val(0), th = T[323].val(0), across = Math.ceil(W / tw), tiles = T[324].cnt;
      for (let t = 0; t < tiles; t++) {
        const off = T[324].val(t), tx = (t % across) * tw, ty = Math.floor(t / across) * th;
        for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) put(tx + x, ty + y, dv.getFloat32(off + (y * tw + x) * 4, le));
      }
    } else {                  // strips
      const rps = T[278] ? T[278].val(0) : H, strips = T[273].cnt;
      for (let s = 0; s < strips; s++) {
        const off = T[273].val(s);
        for (let y = 0; y < rps; y++) for (let x = 0; x < W; x++) { const yy = s * rps + y; if (yy < H) put(x, yy, dv.getFloat32(off + (y * W + x) * 4, le)); }
      }
    }
    return { W, H, v: out };
  }

  const auCache = {};
  async function auFetch(layer, lat, lon) {
    const res = layer[1], dLat = HALF / 111320, dLon = HALF / (111320 * Math.cos(lat * Math.PI / 180));
    const N = Math.max(24, Math.min(140, Math.round(2 * HALF / Math.max(res, 10))));
    const bbox = [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
    const url = `${AUS}?service=WCS&version=1.0.0&request=GetCoverage&coverage=${encodeURIComponent('ausseabed:' + layer[0])}&crs=EPSG:4326&bbox=${bbox.map(v => v.toFixed(6)).join(',')}&width=${N}&height=${N}&format=GeoTIFF`;
    const r = await fetch(url);
    if (!r.ok || !/tiff/.test(r.headers.get('content-type') || '')) throw new Error('no coverage');
    const t = readTiff(await r.arrayBuffer());
    return { layer, bbox, ...t };
  }
  // Elevation (negative = under water) anywhere in the downloaded grid, smoothly between cells.
  function auElev(c, la, lo) {
    const fx = (lo - c.bbox[0]) / (c.bbox[2] - c.bbox[0]) * c.W - 0.5, fy = (c.bbox[3] - la) / (c.bbox[3] - c.bbox[1]) * c.H - 0.5;
    if (fx < -0.5 || fy < -0.5 || fx > c.W - 0.5 || fy > c.H - 0.5) return undefined;
    const x0 = Math.max(0, Math.floor(fx)), y0 = Math.max(0, Math.floor(fy));
    let s = 0, w = 0;
    for (const [x, y] of [[x0, y0], [x0 + 1, y0], [x0, y0 + 1], [x0 + 1, y0 + 1]]) {
      if (x >= c.W || y >= c.H) continue;
      const v = c.v[y * c.W + x]; if (isNaN(v)) continue;
      const k = (1 - Math.min(1, Math.abs(fx - x))) * (1 - Math.min(1, Math.abs(fy - y))); if (k <= 0) continue;
      s += v * k; w += k;
    }
    return w > 0.2 ? s / w : null;
  }
  // Pick the finest survey with real water data around the spot, then build the same pieces NSW spots have.
  async function auDepth(l) {
    const key = `${l.id}@${l.lat.toFixed(4)},${l.lon.toFixed(4)}`;
    if (auCache[key]) return auCache[key];
    const memoKey = 'castcall-audepth-' + key;
    let pick = null; try { pick = localStorage.getItem(memoKey); } catch (e) { /* ignore */ }
    const cands = auCandidates(l.lat, l.lon), order = pick ? [cands.find(c => c[0] === pick), ...cands.filter(c => c[0] !== pick)].filter(Boolean) : cands;
    let cov = null;
    for (const layer of order.slice(0, 6)) {
      try {
        const c = await auFetch(layer, l.lat, l.lon);
        const vals = c.v.filter(v => !isNaN(v)), wet = vals.filter(v => v < -0.3).length / c.v.length;
        const distinct = new Set(vals.map(v => Math.round(v * 2))).size;   // a real survey has many different depths, not a flat fill
        if (wet >= 0.12 && distinct >= 12) { cov = c; break; }
      } catch (e) { /* try the next survey */ }
    }
    if (!cov) return (auCache[key] = null);
    try { localStorage.setItem(memoKey, cov.layer[0]); } catch (e) { /* ignore */ }
    // 9 x 9 grid (110 m apart) for the hole / drop-off finder, same as NSW
    const n = META.n, step = META.step, mid = (n - 1) / 2, kLon = 111320 * Math.cos(l.lat * Math.PI / 180), gd = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = auElev(cov, l.lat + (i - mid) * step / 111320, l.lon + (j - mid) * step / kLon); gd.push(v == null || v === undefined ? null : Math.round(v * 10) / 10); }
    const g = { lat: l.lat, lon: l.lon, n, step, d: gd };
    // depth image, same size, colours and contours as NSW
    const W = 640, h = HALF / Math.cos(l.lat * Math.PI / 180), [cx, cy] = merc(l.lat, l.lon);
    const depths = new Float32Array(W * W).fill(NaN);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const [la, lo] = unmerc(cx - h + (x + 0.5) / W * 2 * h, cy + h - (y + 0.5) / W * 2 * h), v = auElev(cov, la, lo);
      if (v != null && v !== undefined && v < 0) depths[y * W + x] = -v;   // land stays clear
    }
    const c = document.createElement('canvas'); c.width = W; c.height = W;
    const ctx = c.getContext('2d'), px = ctx.createImageData(W, W);
    paint(px.data, depths, W, cov.layer[1] >= 20 ? 0 : 2);
    ctx.putImageData(px, 0, 0);
    const [la0, lo0] = unmerc(cx - h, cy - h), [la1, lo1] = unmerc(cx + h, cy + h);
    const s = { url: c.toDataURL('image/png'), bounds: [[la0, lo0], [la1, lo1]],
      depthAt(la, lo) { const v = auElev(cov, la, lo); return v === undefined ? undefined : v == null || v >= 0 ? null : -v; } };
    return (auCache[key] = { g, s, layer: cov.layer });
  }
  // Exact reading from the survey at one point (used when you tap the map).
  async function auIdentify(layer, lat, lon) {
    const e = 0.0005, name = encodeURIComponent('ausseabed:' + layer[0]);
    const r = await fetch(`${AUS}?service=WMS&version=1.1.1&request=GetFeatureInfo&layers=${name}&query_layers=${name}&srs=EPSG:4326&bbox=${lon - e},${lat - e},${lon + e},${lat + e}&width=11&height=11&x=5&y=5&info_format=application/json`);
    const j = await r.json(), p = j.features && j.features[0] && j.features[0].properties;
    const v = p ? Object.values(p).find(x => typeof x === 'number') : null;
    return v == null || !isFinite(v) || v < -12000 ? null : v;
  }
  const surveyName = layer => layer[0].replace(/_(HS|OV)$/, '').replace(/__/g, ' – ').replace(/_/g, ' ').replace(/(\d) (\d)m/, '$1.$2m').replace(/\s+/g, ' ').trim();

  // Depth anywhere near the spot: from the image when there is one, otherwise smoothed between the grid readings.
  function depthFn(l, g, s) {
    if (s) return (la, lo) => { const v = s.depthAt(la, lo); return v == null || v === undefined ? null : v; };
    const n = g.n, mid = (n - 1) / 2, kLon = 111320 * Math.cos(l.lat * Math.PI / 180);
    return (la, lo) => {
      const fi = (la - g.lat) * 111320 / g.step + mid, fj = (lo - g.lon) * kLon / g.step + mid;
      const i0 = Math.floor(fi), j0 = Math.floor(fj);
      let sum = 0, wsum = 0;
      for (const [i, j] of [[i0, j0], [i0 + 1, j0], [i0, j0 + 1], [i0 + 1, j0 + 1]]) {
        if (i < 0 || j < 0 || i >= n || j >= n) continue;
        const v = g.d[i * n + j]; if (v == null) continue;
        const w = (1 - Math.abs(fi - i)) * (1 - Math.abs(fj - j)); if (w <= 0) continue;
        sum += Math.max(0, -v) * w; wsum += w;
      }
      return wsum > 0.25 ? sum / wsum : null;
    };
  }
  const offset = (l, dist, brg) => {
    const r = brg * Math.PI / 180;
    return [l.lat + Math.cos(r) * dist / 111320, l.lon + Math.sin(r) * dist / (111320 * Math.cos(l.lat * Math.PI / 180))];
  };
  // Side-on seabed profile from the spot out towards the deepest water.
  // The nearest water to the spot (spot markers often sit on the shore, a wharf or a rock platform).
  function nearestWater(l, dAt) {
    const v0 = dAt(l.lat, l.lon); if (v0 != null && v0 >= 0.3) return { dist: 0, d: v0, lat: l.lat, lon: l.lon };
    for (let r = 10; r <= 400; r += 10) {
      let best = null;
      for (let b = 0; b < 360; b += 10) { const [la, lo] = offset(l, r, b), v = dAt(la, lo); if (v != null && v >= 0.3 && (!best || v > best.d)) best = { dist: r, d: v, lat: la, lon: lo }; }
      if (best) return best;
    }
    return null;
  }
  // Side-on profile: from the nearest water, out along the direction that stays in open water and gets deepest.
  function profile(l, g, dAt) {
    const start = nearestWater(l, dAt); if (!start) return null;
    const s0 = { lat: start.lat, lon: start.lon }, LEN = 500, N = 50;
    let best = null;
    for (let b = 0; b < 360; b += 10) {
      let score = 0, wet = 0;
      for (let s = 1; s <= 20; s++) { const v = dAt(...offset(s0, s * 20, b)); if (v != null && v >= 0.3) { score += v; wet++; } else score -= 6; }
      if (wet >= 5 && (!best || score > best.score)) best = { b, score };
    }
    if (!best) return null;
    const pts = [];
    for (let s = 0; s <= N; s++) { const dist = LEN * s / N, [la, lo] = offset(s0, dist, best.b); pts.push({ dist, d: dAt(la, lo) }); }
    return { brg: best.b, dir: COMPASS[Math.round(best.b / 22.5) % 16], pts, start };
  }
  // How deep it is right at the spot, within a long cast, and the deepest water nearby.
  function stats(l, dAt, res, prof) {
    let at = null, out = null;
    const nw = prof ? prof.start : nearestWater(l, dAt);
    if (nw) { at = nw.d; out = nw.dist; }
    let cast = null;
    for (let r = 10; r <= 100; r += 15) for (let b = 0; b < 360; b += 20) { const v = dAt(...offset(l, r, b)); if (v != null && (cast == null || v > cast)) cast = v; }
    return { at, out, cast, deepest: res ? res.deepest : null };
  }

  // Side view: everything is "water depth at the chosen time" = survey depth + tide, measured down from the surface.
  function profileSvg(prof, tide) {
    const W = 640, H = 220, L0 = 44, R0 = 14, B0 = 26, surf = 40, tw = tide == null ? 0 : tide;
    const wd = p => p.d == null || p.d < 0.3 ? null : Math.max(0, p.d + tw);   // null = dry land / beach
    const maxD = Math.max(3, ...prof.pts.map(p => wd(p) || 0));
    const step = maxD > 25 ? 10 : maxD > 10 ? 5 : maxD > 5 ? 2 : 1, yMax = Math.ceil((maxD * 1.12) / step) * step;
    const x = dist => L0 + dist / 500 * (W - L0 - R0), y = dep => surf + dep / yMax * (H - B0 - surf);
    const bed = prof.pts.map(p => { const v = wd(p); return `${x(p.dist).toFixed(1)},${(v == null ? surf - 8 : y(v)).toFixed(1)}`; });
    const grid = []; for (let v = step; v <= yMax; v += step) grid.push(`<line class="pg" x1="${L0}" x2="${W - R0}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="pa" x="${L0 - 6}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${v} m</text>`);
    const xs = []; for (let m = 100; m <= 500; m += 100) xs.push(`<text class="pa" x="${x(m).toFixed(1)}" y="${H - 8}" text-anchor="middle">${m} m</text>`);
    let deep = null; prof.pts.forEach(p => { const v = wd(p); if (v != null && (!deep || v > deep.v)) deep = { dist: p.dist, v }; });
    const lab = [];
    [100, 200, 300, 400].forEach(m => { const p = prof.pts.find(q => Math.round(q.dist) === m), v = p && wd(p);
      if (v != null && v >= 0.6 && (!deep || Math.abs(m - deep.dist) > 60)) lab.push(`<text class="pd" x="${x(m).toFixed(1)}" y="${(y(v) - 7).toFixed(1)}" text-anchor="middle">${v.toFixed(1)} m</text>`); });
    const shore = prof.pts.find(p => wd(p) != null) || prof.pts[0];
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Side view of the seabed from the spot out ${prof.dir}">
      <defs>
        <linearGradient id="pw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fd0ea"/><stop offset=".5" stop-color="#2a7fca"/><stop offset="1" stop-color="#123a78"/></linearGradient>
        <linearGradient id="ps" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6c992"/><stop offset="1" stop-color="#8a6a3d"/></linearGradient>
      </defs>
      <rect x="${L0}" y="${surf}" width="${W - L0 - R0}" height="${H - B0 - surf}" fill="url(#pw)"/>
      ${grid.join('')}
      <polygon points="${L0},${H - B0} ${bed.join(' ')} ${W - R0},${H - B0}" fill="url(#ps)"/>
      <polyline points="${bed.join(' ')}" fill="none" stroke="#5b4426" stroke-width="1.5" stroke-linejoin="round"/>
      <line class="psurf" x1="${L0}" x2="${W - R0}" y1="${surf}" y2="${surf}"/>
      <text class="pt" x="${W - R0 - 4}" y="${surf - 7}" text-anchor="end">${tide == null ? 'Water surface (mean sea level)' : `Water surface · tide ${tw >= 0 ? '+' : '−'}${Math.abs(tw).toFixed(1)} m`}</text>
      <text x="${Math.max(L0 + 10, x(shore.dist)).toFixed(1)}" y="${surf - 6}" font-size="20" text-anchor="middle">🎣</text>
      ${lab.join('')}
      ${deep && deep.v >= 0.6 ? `<circle cx="${x(deep.dist).toFixed(1)}" cy="${y(deep.v).toFixed(1)}" r="4.5" fill="#fff" stroke="#123a78" stroke-width="2.5"/>
        <text class="pdeep" x="${(x(deep.dist) > W - 130 ? W - R0 - 6 : x(deep.dist) < L0 + 90 ? L0 + 6 : x(deep.dist)).toFixed(1)}" y="${(y(deep.v) + 18 > H - B0 - 2 ? y(deep.v) - 10 : y(deep.v) + 18).toFixed(1)}" text-anchor="${x(deep.dist) > W - 130 ? 'end' : x(deep.dist) < L0 + 90 ? 'start' : 'middle'}">${deep.v.toFixed(1)} m deep</text>` : ''}
      ${xs.join('')}
    </svg>`;
  }

  let curAu = null;
  let mini = null, miniFor = null, miniEl = null, markersLayer = null, overlays = [], depthLayer = null, staticInfo = null, cur = { tide: null, when: '' };
  const waterTxt = (v) => {
    if (v == null) return 'No depth here (land, or outside the survey)';
    if (v < 0.6 && (cur.tide == null || v + cur.tide < 0.6)) return '<b>Very shallow</b><br><small>may dry out at low tide</small>';
    if (cur.tide == null) return `<b class="pop-big">${v.toFixed(1)} m</b><br><small>deep at mean sea level</small>`;
    const now = Math.max(0, v + cur.tide);
    return `<b class="pop-big">${now.toFixed(1)} m</b> <small>of water</small><br><small>${cur.when}: survey ${v.toFixed(1)} m ${cur.tide >= 0 ? '+' : '−'} tide ${Math.abs(cur.tide).toFixed(1)} m</small>`;
  };
  function buildMap(l) {
    miniEl = document.createElement('div');
    miniEl.className = 'depth-map';
    mini = L.map(miniEl, { zoomControl: false, attributionControl: true, scrollWheelZoom: true, wheelPxPerZoomLevel: 90, zoomSnap: 0.25, zoomDelta: 0.5, minZoom: 12, maxZoom: 18 }).setView([l.lat, l.lon], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(mini);
    // Reef drawn as a soft dark shade with a faint outline (the server's own style is a loud red).
    const reefStyle = [{ id: 1, source: { type: 'mapLayer', mapLayerId: 1 }, definitionExpression: "REEF='Reef'",
      drawingInfo: { renderer: { type: 'simple', symbol: { type: 'esriSFS', style: 'esriSFSSolid', color: [8, 36, 58, 255],
        outline: { type: 'esriSLS', style: 'esriSLSSolid', color: [230, 245, 255, 255], width: 0.7 } } } } }];
    overlays = !nswCovered(l) ? [] : [viewOverlay(mini, REEF, 1, '&dynamicLayers=' + encodeURIComponent(JSON.stringify(reefStyle)), 0.3, 'Reefs: NSW seabed reef map')];
    markersLayer = L.layerGroup().addTo(mini);
    L.circleMarker([l.lat, l.lon], { radius: 7, color: '#fff', weight: 3, fillColor: '#0b0b0b', fillOpacity: 1 }).addTo(mini).bindTooltip(l.name);
    depthLayer = null; staticInfo = null;
    mini.on('click', async e => {
      const pop = L.popup({ className: 'depth-pop' }).setLatLng(e.latlng).openOn(mini);
      const quick = staticInfo ? staticInfo.depthAt(e.latlng.lat, e.latlng.lng) : undefined;
      pop.setContent(quick !== undefined ? waterTxt(quick) + '<br><small class="pop-note">checking the exact survey…</small>' : 'Checking depth…');
      try {
        const v = curAu ? await auIdentify(curAu, e.latlng.lat, e.latlng.lng) : await identify(e.latlng.lat, e.latlng.lng);
        if (v == null && quick != null) { pop.setContent(waterTxt(quick)); return; }
        pop.setContent(waterTxt(v == null ? null : Math.max(0, -v)) + (v == null ? '' : '<br><small class="pop-note">✓ exact survey reading</small>'));
      } catch (err) { pop.setContent(quick !== undefined ? waterTxt(quick) : 'Could not get the depth – check your connection.'); }
    });
    miniFor = l.id;
  }

  // Depth layer: the clean pre-saved image when we have one, otherwise the live server image (pins).
  async function addDepthLayer(l, g) {
    if (depthLayer) return staticInfo;
    const s = g && g !== 'none' ? await staticDepth(l, g) : null;
    if (miniFor !== l.id) return null;
    if (depthLayer) return staticInfo;
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
    return staticInfo;
  }

  function addMarkers(res) {
    markersLayer.clearLayers();
    if (!res) return;
    const t = cur.tide || 0, w = v => (v + t).toFixed(1);
    res.holes.forEach((h, k) => L.marker([h.lat, h.lon], { icon: L.divIcon({ className: '', html: `<div class="hole-pin">${k + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) })
      .addTo(markersLayer).bindTooltip(`Hole ${k + 1}: ${w(h.depth)} m`));
    if (res.drop) L.marker([res.drop.lat, res.drop.lon], { icon: L.divIcon({ className: '', html: '<div class="hole-pin drop">↘</div>', iconSize: [26, 26], iconAnchor: [13, 13] }) })
      .addTo(markersLayer).bindTooltip(`Drop-off: ${w(res.drop.from)} → ${w(res.drop.to)} m`);
    if (res.deepestAt) L.marker([res.deepestAt.lat, res.deepestAt.lon], { icon: L.divIcon({ className: '', html: '<div class="hole-pin deep">▼</div>', iconSize: [26, 26], iconAnchor: [13, 13] }) })
      .addTo(markersLayer).bindTooltip(`Deepest nearby: ${w(res.deepest)} m`);
  }

  function listHtml(l, res, g) {
    if (!res) return '<p class="muted small">No depth readings around this exact spot (it may be on land or just outside the survey). Pan the map and tap the water to check depths.</p>';
    const beach = l.type === 'beach' || l.type === 'rock', t = cur.tide || 0, w = v => (v + t).toFixed(1);
    return `<h4 class="depth-h">Where the fish hold</h4><ul class="holes">
        ${res.holes.map((h, k) => `<li><span class="hole-pin small">${k + 1}</span><span><b>Hole – ${w(h.depth)} m</b> <span class="muted">${h.dir} · about ${h.rise.toFixed(1)} m deeper than around it</span></span></li>`).join('')}
        ${res.drop ? `<li><span class="hole-pin small drop">↘</span><span><b>Drop-off – ${w(res.drop.from)} → ${w(res.drop.to)} m</b> <span class="muted">${res.drop.dir} · fish the edge</span></span></li>` : ''}
        ${res.deepestAt ? `<li><span class="hole-pin small deep">▼</span><span><b>Deepest nearby – ${w(res.deepest)} m</b> <span class="muted">${res.deepestAt.dir}${res.holes.length ? '' : ' · the bottom keeps sloping away, so it may get deeper further out'}</span></span></li>` : ''}
      </ul>
      <p class="muted small">Searched about ${Math.round(g.step * (g.n - 1) / 2)} m around the spot.${cur.tide != null ? ` Depths include the tide at ${cur.when}.` : ''}
        ${beach ? '<br>⚠️ Beach gutters and sandbars move with every swell – surveys are a few years old, so use them as a guide and read the water on the day.' : ''}</p>`;
  }

  function statsHtml(st) {
    const t = cur.tide, w = v => v == null ? '–' : `${Math.max(0, v + (t || 0)).toFixed(1)}<small> m</small>`;
    const sub = v => v == null ? '' : t == null ? 'at mean sea level' : `survey ${v.toFixed(1)} ${t >= 0 ? '+' : '−'} tide ${Math.abs(t).toFixed(1)}`;
    const tile = (k, v, note) => `<div class="dstat"><span class="dk">${k}</span><span class="dv">${w(v)}</span><span class="ds">${note || sub(v)}</span></div>`;
    return `${tile(st.out && st.out > 15 ? `Water starts ~${st.out} m out` : 'Right at the spot', st.at)}${tile('Within a long cast (100 m)', st.cast)}${tile('Deepest nearby', st.deepest)}`;
  }

  // Called after the spot details are drawn. Re-uses the same mini map while you stay on one spot.
  async function mount(l, opts) {
    cur = { tide: opts && opts.tide != null ? opts.tide : null, when: (opts && opts.when) || '' };
    const slot = $('#depth-slot');
    if (!slot || !covered(l)) return;
    if (miniFor !== l.id) { if (mini) mini.remove(); buildMap(l); }
    slot.replaceWith(miniEl);
    setTimeout(() => { mini.invalidateSize(); overlays.forEach(u => u()); }, 0);
    const tideEl = $('#depth-tide');
    if (tideEl) tideEl.innerHTML = cur.tide == null ? 'Depths at mean sea level' : `🌊 Tide ${cur.tide >= 0 ? '+' : '−'}${Math.abs(cur.tide).toFixed(1)} m at ${cur.when} – depths below include it`;
    if (!nswCovered(l)) return mountAU(l);
    curAu = null;
    let g = storedGrid(l);
    const sP = addDepthLayer(l, g && g !== 'none' && GRIDS[l.id] ? g : null);
    if (g === 'none') {
      addMarkers(null);
      $('#depth-list').innerHTML = '<p class="muted small">The 2018 depth survey doesn\'t reach this exact spot (it mostly covers the open coast, bays and lower estuaries). Pan the map and tap the water to check depths nearby.</p>';
      $('#depth-stats').hidden = true; $('#depth-profile').hidden = true;
      return;
    }
    if (!g) {
      $('#depth-list').innerHTML = '<p class="muted small">🔍 Reading the seabed around this spot…</p>';
      try { g = await sampleGrid(l); } catch (e) { $('#depth-list').innerHTML = '<p class="muted small">Could not reach the depth survey – check your connection.</p>'; return; }
      if (F.ui.state.selected !== l.id || !$('#depth-list')) return;
    }
    const res = analyse(g);
    addMarkers(res);
    $('#depth-list').innerHTML = listHtml(l, res, g);
    const s = await sP;
    if (F.ui.state.selected !== l.id || !$('#depth-stats')) return;
    finish(l, g, s, res);
  }
  function finish(l, g, s, res) {
    const dAt = depthFn(l, g, s), prof = profile(l, g, dAt), st = stats(l, dAt, res, prof);
    $('#depth-stats').innerHTML = statsHtml(st);
    const pe = $('#depth-profile');
    if (prof) pe.innerHTML = `<h4 class="depth-h">Side view – from the water's edge looking out ${prof.dir}</h4>${profileSvg(prof, cur.tide)}`;
    else pe.hidden = true;
  }
  // Every other state: the finest national survey that covers the spot, drawn exactly like NSW.
  async function mountAU(l) {
    const listEl = $('#depth-list');
    listEl.innerHTML = '<p class="muted small">🔍 Reading the seabed survey around this spot…</p>';
    let au;
    try { au = await auDepth(l); } catch (e) { au = undefined; }
    if (F.ui.state.selected !== l.id || !$('#depth-list')) return;
    if (au === undefined) { $('#depth-list').innerHTML = '<p class="muted small">Could not reach the depth survey – check your connection.</p>'; return; }
    if (!au) {
      $('#depth-list').innerHTML = '<p class="muted small">The detailed seabed surveys don\'t reach this exact spot yet (they mostly cover reefs, shipping channels and the open coast). Pan the map and tap the water to check depths nearby.</p>';
      $('#depth-stats').hidden = true; $('#depth-profile').hidden = true;
      return;
    }
    curAu = au.layer;
    if (!depthLayer) {
      staticInfo = au.s;
      depthLayer = L.imageOverlay(au.s.url, au.s.bounds, { opacity: 1, attribution: 'Depth: Geoscience Australia / AusSeabed' }).addTo(mini);
      mini.fitBounds(L.latLngBounds(au.s.bounds).pad(-0.12));
      mini.setMaxBounds(L.latLngBounds(au.s.bounds).pad(0.15));
    }
    const src = $('#depth-src');
    if (src) src.innerHTML = `Source: ${surveyName(au.layer)} (${au.layer[1]} m grid) from Geoscience Australia's AusSeabed warehouse. Survey depths are measured from about mean sea level or the lowest tide, depending on the survey. Tide heights are a forecast. A fishing guide only – <b>not for navigation</b>.`;
    const intro = $('#depth-intro');
    if (intro) intro.textContent = `How deep it really is around this spot – from the national seabed survey (${au.layer[1]} m detail).`;
    const res = analyse(au.g);
    addMarkers(res);
    $('#depth-list').innerHTML = listHtml(l, res, au.g);
    finish(l, au.g, au.s, res);
  }

  function sectionHtml(l) {
    if (!l || l.water !== 'salt') return '';
    const badge = `<span class="pro-badge" title="This will be part of CastCall Pro later">⭐ Pro${PRO_FREE ? ' – free for now' : ''}</span>`;
    if (!covered(l)) return `<section class="depth-card"><div class="depth-top"><h3>🌊 Depth &amp; structure ${badge}</h3></div><p class="muted small" style="padding:12px 16px 14px;margin:0">No detailed seabed survey covers this spot yet – the national surveys mostly cover reefs, shipping channels and the open coast. We'll add it as new surveys are released.</p></section>`;
    const nsw = nswCovered(l);
    const legend = `<span class="grad" style="background:linear-gradient(90deg,${BANDS.map(b => `rgb(${b.c.join(',')})`).join(',')})"></span><span class="glabels">${BANDS.map(b => `<i>${b.label}</i>`).join('')}</span>`;
    return `<section class="depth-card">
      <div class="depth-top">
        <h3>🌊 Depth &amp; structure ${badge}</h3>
        <p id="depth-intro">How deep it really is around this spot – from ${nsw ? "the NSW Government's laser and sonar seabed survey" : 'the national seabed survey'}.</p>
        <div class="depth-tide" id="depth-tide"></div>
      </div>
      <div class="depth-body">
        <div class="depth-stats" id="depth-stats"><div class="dstat skel"></div><div class="dstat skel"></div><div class="dstat skel"></div></div>
        <div id="depth-slot" class="depth-map"></div>
        <div class="depth-legend"><span class="gwrap">${legend}</span><span class="gm">m</span>${nsw ? '<span class="reef-key"></span><span>Reef</span>' : ''}<span class="you-key"></span><span>The spot</span></div>
        <p class="caption">👆 Tap anywhere on the water for the exact depth. Scroll (or pinch on a phone) to zoom. Faint white lines mark 2, 5, 10, 20 and 30 m. Numbers mark deep holes, ↘ the steepest drop-off and ▼ the deepest point.</p>
        <div class="depth-profile" id="depth-profile"></div>
        <div id="depth-list"></div>
        <p class="muted small" id="depth-src">${nsw ? 'Source: NSW Government marine LiDAR (2018) and multibeam surveys, plus the NSW seabed reef map. Tide heights are a forecast. A fishing guide only – <b>not for navigation</b>.' : 'Source: Geoscience Australia / AusSeabed national seabed surveys.'}</p>
      </div>
    </section>`;
  }

  F.depth = { sectionHtml, mount, analyse, covered };
})();
