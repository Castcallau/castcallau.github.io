// Fishing score engine: turns weather, swell, tide, light and moon into a 0–100 score per hour,
// and ranks the target species at each spot.
window.FISH = window.FISH || {};
(function () {
  const SYNODIC = 29.530588853;
  const NEW_MOON_REF = 947182440; // 2000-01-06 18:14 UTC (unix seconds)
  const H = 3600;

  const monthFmts = {};
  const monthOf = (t, tz = 'Australia/Sydney') => {
    const f = monthFmts[tz] || (monthFmts[tz] = new Intl.DateTimeFormat('en-AU', { timeZone: tz, month: 'numeric' }));
    return Number(f.format(new Date(t * 1000))) - 1;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (v, x0, x1, y0, y1) => y0 + (y1 - y0) * clamp((v - x0) / (x1 - x0), 0, 1);

  // ---------- Moon ----------
  function moon(t) {
    const age = (((t - NEW_MOON_REF) / 86400) % SYNODIC + SYNODIC) % SYNODIC;
    const illum = (1 - Math.cos(2 * Math.PI * age / SYNODIC)) / 2;
    const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
    const name = names[Math.floor(((age / SYNODIC) * 8) + 0.5) % 8];
    const icons = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'];
    const icon = icons[Math.floor(((age / SYNODIC) * 8) + 0.5) % 8];
    const nearNewFull = Math.min(age, Math.abs(age - SYNODIC / 2), SYNODIC - age) <= 3;
    return { age, illum, name, icon, nearNewFull };
  }

  // ---------- Tides from modelled sea level ----------
  function tideExtremes(d, lagMin) {
    const v = d.sea, t = d.times, out = [];
    for (let i = 1; i < v.length - 1; i++) {
      if (v[i] == null || v[i - 1] == null || v[i + 1] == null) continue;
      const hi = v[i] > v[i - 1] && v[i] >= v[i + 1];
      const lo = v[i] < v[i - 1] && v[i] <= v[i + 1];
      if (!hi && !lo) continue;
      const denom = v[i - 1] - 2 * v[i] + v[i + 1];
      const off = denom ? clamp((v[i - 1] - v[i + 1]) / (2 * denom), -0.5, 0.5) : 0;
      const height = v[i] - 0.25 * (v[i - 1] - v[i + 1]) * off;
      out.push({ t: t[i] + off * H + (lagMin || 0) * 60, type: hi ? 'high' : 'low', h: height });
    }
    return out;
  }

  // ---------- Extending marine data past the ~8-9 day marine forecast ----------
  // Tides follow the moon and sun, so fit the main tidal constituents to the modelled sea level we have
  // (least squares) and predict the rest – the same idea tide tables use. Sea temp barely changes in a week,
  // so carry the last value forward. Swell can't be predicted that far out, so it stays unknown.
  const CONSTITUENTS = [12.4206012, 12.0, 12.65834751, 23.93447213, 25.81933871]; // M2, S2, N2, K1, O1 periods (h)
  function fitTide(times, vals) {
    const rows = [], ys = [], t0 = times[0];
    times.forEach((t, i) => {
      if (vals[i] == null) return;
      const h = (t - t0) / H, r = [1];
      for (const P of CONSTITUENTS) { const w = 2 * Math.PI / P; r.push(Math.cos(w * h), Math.sin(w * h)); }
      rows.push(r); ys.push(vals[i]);
    });
    const n = 1 + CONSTITUENTS.length * 2;
    if (rows.length < 72) return null;
    // Normal equations with a little ridge so close constituents (M2/S2/N2 over < 2 weeks) stay stable.
    const A = Array.from({ length: n }, () => new Array(n + 1).fill(0));
    rows.forEach((r, k) => { for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) A[i][j] += r[i] * r[j]; A[i][n] += r[i] * ys[k]; } });
    for (let i = 1; i < n; i++) A[i][i] += rows.length * 0.02;
    for (let c = 0; c < n; c++) {                       // Gaussian elimination
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]];
      if (Math.abs(A[c][c]) < 1e-12) return null;
      for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; }
    }
    const coef = A.map((row, i) => row[n] / row[i]);
    return t => { const h = (t - t0) / H; let v = coef[0]; CONSTITUENTS.forEach((P, k) => { const w = 2 * Math.PI / P; v += coef[1 + 2 * k] * Math.cos(w * h) + coef[2 + 2 * k] * Math.sin(w * h); }); return v; };
  }
  function lastIndex(arr) { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return i; return -1; }

  function extendMarine(d) {
    if (d._extended) return;
    d._extended = true;
    const n = d.times.length;
    const lw = lastIndex(d.wave);
    d.marineEnd = lw >= 0 ? d.times[lw] : null;
    const ls = lastIndex(d.sea);
    if (ls >= 72 && ls < n - 1) {
      const f = fitTide(d.times.slice(0, ls + 1), d.sea.slice(0, ls + 1));
      if (f) {
        const shift = d.sea[ls] - f(d.times[ls]);       // join smoothly onto the last modelled value
        for (let i = ls + 1; i < n; i++) d.sea[i] = f(d.times[i]) + shift * Math.exp(-(i - ls) / 6);
        d.tidePredictedFrom = d.times[ls + 1];
      }
    }
    const lt = lastIndex(d.sst);
    if (lt >= 0) for (let i = lt + 1; i < n; i++) d.sst[i] = d.sst[lt];
  }
  FISH.scoring_fitTide = fitTide; // exposed for checking accuracy

  function tideAt(ext, t) {
    if (!ext.length) return null;
    let prev = null, next = null;
    for (const e of ext) { if (e.t <= t) prev = e; else { next = e; break; } }
    if (!next && !prev) return null;
    const dPrev = prev ? (t - prev.t) / H : Infinity, dNext = next ? (next.t - t) / H : Infinity;
    const rising = next ? next.type === 'high' : prev.type === 'low';
    const range = prev && next ? Math.abs(next.h - prev.h) : null;
    return { rising, state: rising ? 'Rising' : 'Falling', dChange: Math.min(dPrev, dNext), prev, next, range };
  }

  // ---------- Light ----------
  function light(d, t) {
    let k = 0, best = Infinity;
    for (let i = 0; i < d.sunrise.length; i++) {
      const mid = (d.sunrise[i] + d.sunset[i]) / 2, dist = Math.abs(t - mid);
      if (dist < best) { best = dist; k = i; }
    }
    const rise = d.sunrise[k], set = d.sunset[k];
    let cat;
    if (t >= rise - 75 * 60 && t <= rise + 90 * 60) cat = 'dawn';
    else if (t >= set - 90 * 60 && t <= set + 75 * 60) cat = 'dusk';
    else if (t < rise || t > set) cat = 'night';
    else cat = 'day';
    return { cat, rise, set, solarNoon: (rise + set) / 2 };
  }

  // Approximate solunar periods: moon overhead ≈ solar noon + (age / synodic) × 24h
  function solunar(t, solarNoon, m) {
    const transit = solarNoon + (m.age / SYNODIC) * 24 * H;
    let dMajor = Infinity, dMinor = Infinity;
    for (let k = -2; k <= 2; k++) {
      const base = transit + k * 24.84 * H;
      dMajor = Math.min(dMajor, Math.abs(t - base), Math.abs(t - (base + 12.42 * H)));
      dMinor = Math.min(dMinor, Math.abs(t - (base + 6.21 * H)), Math.abs(t - (base - 6.21 * H)));
    }
    if (dMajor <= H) return { score: 1, label: 'Solunar major period' };
    if (dMinor <= 0.75 * H) return { score: 0.8, label: 'Solunar minor period' };
    return { score: 0.55, label: null };
  }

  function angleDiff(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

  const SWELL = {
    rock: hs => hs < 0.6 ? 0.75 : hs <= 1.8 ? 1 : hs <= 2.5 ? 0.35 : 0.05,
    breakwall: hs => hs < 0.5 ? 0.85 : hs <= 2 ? 1 : hs <= 3 ? 0.5 : 0.2,
    beach: hs => hs < 0.4 ? 0.6 : hs <= 1.6 ? 1 : hs <= 2.5 ? 0.6 : 0.3,
    offshore: hs => hs < 1.2 ? 1 : hs <= 2 ? 0.75 : hs <= 3 ? 0.35 : 0.1,
    harbour: () => 1, estuary: () => 1, dam: () => 1, river: () => 1
  };

  // Closed seasons are per state: [{ states, months, where: 'all' | 'river' | 'notdam', release }]
  function closedFor(sp, month, type, state) {
    for (const c of sp.closures || []) {
      if (!c.months.includes(month) || (c.states && !c.states.includes(state))) continue;
      if (c.where === 'river' && type !== 'river' && type !== 'estuary') continue;
      if (c.where === 'notdam' && type === 'dam') continue;
      return c;
    }
    return null;
  }

  // Freshwater: estimate water temp from the last 3 days of air temperature.
  function estWaterTemp(d, i) {
    let s = 0, n = 0;
    for (let k = Math.max(0, i - 72); k <= i; k++) if (d.temp[k] != null) { s += d.temp[k]; n++; }
    return n ? s / n : null;
  }
  function rainLast(d, i, hours) {
    let s = 0;
    for (let k = Math.max(0, i - hours); k <= i; k++) s += d.rain[k] || 0;
    return s;
  }

  function speciesActivity(sp, ctx) {
    const season = sp.season[ctx.month] / 3;
    if (sp.northOf && ctx.lat < sp.northOf) return { act: 0, season: 0 };
    const closed = closedFor(sp, ctx.month, ctx.type, ctx.state);
    if (closed && !closed.release) return { act: 0, season, tempFit: 0, tod: 0, tidePref: 0, closed };
    let tempFit = 0.8;
    if (ctx.sst != null) {
      const [lo, hi] = sp.temp;
      tempFit = ctx.sst >= lo && ctx.sst <= hi ? 1 : Math.max(0.2, 1 - (ctx.sst < lo ? lo - ctx.sst : ctx.sst - hi) / 4);
    }
    const tod = sp.tod[ctx.light.cat];
    let tidePref = 0.85;
    if (ctx.tide) {
      if (sp.tide === 'rising') tidePref = ctx.tide.rising ? 1 : 0.6;
      else if (sp.tide === 'falling') tidePref = ctx.tide.rising ? 0.6 : 1;
      else if (sp.tide === 'change') tidePref = ctx.tide.dChange <= 1.5 ? 1 : 0.55;
    }
    let extra = 1;
    if (sp.whiteWater && ctx.wave != null && (ctx.type === 'rock' || ctx.type === 'beach' || ctx.type === 'breakwall')) extra *= ctx.wave >= 0.7 && ctx.wave <= 2 ? 1.08 : 0.9;
    if (sp.moon && ctx.moon.nearNewFull) extra *= 1.1;
    if (sp.rain && ctx.riverRising) extra *= 1.12;
    const act = clamp(Math.pow(Math.max(season, 0.05), 0.8) * tempFit * (0.45 + 0.55 * tod) * (0.6 + 0.4 * tidePref) * extra, 0, 1);
    return { act, season, tempFit, tod, tidePref, closed };
  }

  function scoreHour(loc, d, i, ext, opts) {
    const t = d.times[i];
    const fresh = loc.water === 'fresh';
    const lt = light(d, t), m = moon(t), tide = fresh ? null : tideAt(ext, t);
    const sst = fresh ? estWaterTemp(d, i) : (d.sst[i] ?? nearest(d.sst, i));
    const wave = fresh ? null : (d.wave[i] ?? nearest(d.wave, i));
    const reasons = [], warnings = [];

    // Light
    let fLight = lt.cat === 'dawn' || lt.cat === 'dusk' ? 1 : lt.cat === 'night' ? 0.55 : 0.45;
    if (lt.cat === 'day' && d.cloud[i] > 70) { fLight = 0.6; reasons.push({ g: 1, txt: 'Overcast – fish less shy in daylight' }); }
    if (lt.cat === 'dawn') reasons.push({ g: 2, txt: 'Dawn bite window' });
    if (lt.cat === 'dusk') reasons.push({ g: 2, txt: 'Dusk bite window' });

    // Tide
    let fTide = 0.6, fFlow = 0.75, riverRising = false, rain48 = 0;
    if (fresh) {
      rain48 = rainLast(d, i, 48);
      if (loc.type === 'river') {
        if (rain48 >= 3 && rain48 <= 25) { fFlow = 1; riverRising = true; reasons.push({ g: 2, txt: `River freshening after ${rain48.toFixed(0)} mm of rain – fish on the move` }); }
        else if (rain48 > 60) { fFlow = 0.45; reasons.push({ g: -2, txt: `${rain48.toFixed(0)} mm of rain in 48 h – river likely high and dirty` }); }
        else if (rain48 > 25) { fFlow = 0.75; riverRising = true; reasons.push({ g: 0, txt: `${rain48.toFixed(0)} mm of rain in 48 h – river up and coloured` }); }
        else fFlow = 0.7;
      } else if (rain48 >= 5 && rain48 <= 40) { fFlow = 0.9; riverRising = true; reasons.push({ g: 1, txt: 'Fresh inflow from recent rain' }); }
    } else if (tide) {
      fTide = tide.dChange <= 1.5 ? 1 : tide.dChange <= 3 ? 0.75 : 0.65;
      if ((loc.type === 'estuary' || loc.type === 'harbour') && tide.rising) fTide = Math.min(1, fTide + 0.1);
      if (tide.dChange <= 1.5) reasons.push({ g: 2, txt: `Tide change ${tide.next && (tide.next.t - t) / H <= 1.5 ? 'coming up' : 'just happened'} – water starting to move` });
      else reasons.push({ g: 0, txt: `${tide.state} tide, ${tide.dChange.toFixed(1)} h from the turn` });
    }

    // Wind (onshore component and exposure)
    const ws = d.wind[i] ?? 0, wd = d.windDir[i] ?? 0, gust = d.gust[i] ?? ws;
    const onshore = Math.cos(angleDiff(wd, loc.faces) * Math.PI / 180);
    const effWind = ws * loc.exposure * (1 + 0.5 * Math.max(0, onshore)) + ws * (1 - loc.exposure) * 0.4;
    const fWind = lerp(effWind, 12, 40, 1, 0.15);
    if (effWind < 12) reasons.push({ g: 1, txt: `Light ${compass(wd)} wind ${Math.round(ws)} km/h` });
    else if (effWind > 25) reasons.push({ g: -2, txt: `${onshore > 0.3 ? 'Onshore' : 'Strong'} ${compass(wd)} wind ${Math.round(ws)} km/h (gusts ${Math.round(gust)})` });
    else reasons.push({ g: -1, txt: `Moderate ${compass(wd)} wind ${Math.round(ws)} km/h` });
    if (gust >= 45 && (loc.type === 'offshore' || opts.boat)) warnings.push(`Gusts to ${Math.round(gust)} km/h – unsafe for small boats and kayaks`);

    // Swell
    let fSwell = 1, cap = 100;
    const swellUnknown = !fresh && wave == null && d.marineEnd != null && t > d.marineEnd;
    if (swellUnknown && loc.type !== 'harbour' && loc.type !== 'estuary') {
      reasons.push({ g: 0, txt: 'Swell forecast not out yet for this day – check again closer to the day' });
      if (loc.type === 'rock' || loc.type === 'offshore') warnings.push('No swell forecast yet this far ahead – check the swell before you go out');
    }
    if (wave != null) {
      fSwell = SWELL[loc.type](wave);
      if (loc.type === 'rock') {
        if (wave > 2.5) { cap = 12; warnings.push(`DANGER: ${wave.toFixed(1)} m swell – do not fish these rocks`); }
        else if (wave > 1.8) { cap = 45; warnings.push(`${wave.toFixed(1)} m swell – rock fishing risky, watch sets for 15 min first`); }
        else if (wave >= 0.7) reasons.push({ g: 1, txt: `${wave.toFixed(1)} m swell – nice white-water wash` });
      } else if (loc.type === 'offshore') {
        if (wave > 3) { cap = 15; warnings.push(`${wave.toFixed(1)} m seas – stay in port`); }
        else if (wave > 2) { cap = 45; warnings.push(`${wave.toFixed(1)} m seas – rough offshore and bar crossings`); }
        else if (wave < 1.2) reasons.push({ g: 1, txt: `Calm ${wave.toFixed(1)} m sea offshore` });
      } else if (loc.type === 'breakwall' && wave > 2.5) { cap = 40; warnings.push(`${wave.toFixed(1)} m swell – stay off the wall end`); }
      else if (loc.type === 'beach') {
        if (wave >= 0.4 && wave <= 1.6) reasons.push({ g: 1, txt: `${wave.toFixed(1)} m surf – gutters working` });
        else if (wave > 2.5) reasons.push({ g: -2, txt: `${wave.toFixed(1)} m surf – very hard to hold bottom` });
      }
    }

    // Pressure trend (hPa over 3h)
    let fPress = 0.8;
    if (i >= 3 && d.pressure[i] != null && d.pressure[i - 3] != null) {
      const dp = d.pressure[i] - d.pressure[i - 3];
      if (dp <= -0.5 && dp >= -3) { fPress = 1; reasons.push({ g: 1, txt: 'Barometer falling slowly – fish feeding up' }); }
      else if (Math.abs(dp) < 0.5) fPress = 0.85;
      else if (dp > 0.5 && dp <= 2) fPress = 0.7;
      else { fPress = 0.55; reasons.push({ g: -1, txt: `Pressure changing fast (${dp > 0 ? '+' : ''}${dp.toFixed(1)} hPa / 3 h)` }); }
    }

    // Rain / storms
    let fRain = 1;
    const rain = d.rain[i] ?? 0, code = d.code[i] ?? 0;
    if (code >= 95) { fRain = 0.3; warnings.push('Thunderstorms forecast – get off the water and away from rod tips'); }
    else if (rain > 4) { fRain = 0.65; reasons.push({ g: -1, txt: `Heavy rain (${rain.toFixed(1)} mm/h)` }); }
    else if (rain > 1) fRain = 0.88;

    // Moon / solunar
    const sol = solunar(t, lt.solarNoon, m);
    let fMoon = sol.score + (m.nearNewFull ? 0.1 : 0);
    if (sol.label) reasons.push({ g: sol.score === 1 ? 1 : 0, txt: sol.label + ' (approx.)' });

    const env = (fresh
      ? 0.2 * fFlow + 0.3 * fLight + 0.2 * fWind + 0.15 * fPress + 0.15 * Math.min(1, fMoon)
      : 0.26 * fTide + 0.24 * fLight + 0.22 * fWind + 0.1 * fSwell + 0.1 * fPress + 0.08 * Math.min(1, fMoon)) * fRain;

    // Species
    if (loc.crocs) warnings.push('Crocodile country – stay well back from the water\'s edge, never wade, and don\'t clean fish at the water');
    if (loc.noEat) warnings.push('NSW Health: don\'t eat fish or crustaceans caught west of the Sydney Harbour Bridge (dioxins) – catch and release only');
    const ctx = { month: monthOf(t, loc.tz), sst, wave, light: lt, tide, moon: m, type: loc.type, lat: loc.lat, riverRising, state: loc.state };
    // Pest fish (carp, redfin) are still listed but ranked below the real target species.
    const rank = s => s.act * (FISH.SPECIES[s.id].pest ? 0.6 : 1);
    const species = loc.species.map(id => ({ id, ...speciesActivity(FISH.SPECIES[id], ctx) })).sort((a, b) => rank(b) - rank(a));
    const closures = [...new Set(species.filter(s => s.closed).map(s => s.closed.note))];
    let spFactor;
    if (opts.target && loc.species.includes(opts.target)) spFactor = species.find(s => s.id === opts.target).act;
    else spFactor = species.slice(0, 2).reduce((s, x) => s + rank(x), 0) / Math.min(2, species.length);

    // Power curve spreads the scale so only genuinely prime windows reach "Excellent".
    const score = Math.round(Math.min(cap, 100 * Math.pow(clamp(0.55 * env + 0.45 * spFactor, 0, 1), 1.8)));
    return {
      t, i, score, env, light: lt, tide, moon: m, sst, wave, wind: ws, windDir: wd, gust,
      temp: d.temp[i], rain, rainProb: d.rainProb[i], code, cloud: d.cloud[i], swell: d.swell[i], period: d.period[i],
      species, reasons: reasons.sort((a, b) => b.g - a.g), warnings, closures, fresh, rain48, swellUnknown,
      tidePredicted: !!(d.tidePredictedFrom && t >= d.tidePredictedFrom),
      parts: fresh ? { Flow: fFlow, Light: fLight, Wind: fWind, Pressure: fPress, Moon: Math.min(1, fMoon) }
        : { Tide: fTide, Light: fLight, Wind: fWind, Swell: fSwell, Pressure: fPress, Moon: Math.min(1, fMoon) }
    };
  }

  function nearest(arr, i) {
    for (let k = 1; k < 6; k++) { if (arr[i - k] != null) return arr[i - k]; if (arr[i + k] != null) return arr[i + k]; }
    return null;
  }

  function compass(deg) {
    return ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(((deg % 360) / 22.5)) % 16];
  }

  function bestWindows(hours) {
    if (!hours.length) return [];
    const max = Math.max(...hours.map(h => h.score));
    const thr = Math.max(50, max - 10);
    const wins = [];
    let cur = null;
    hours.forEach(h => {
      if (h.score >= thr) {
        if (!cur) cur = { start: h.t, end: h.t + H, peak: h.score, peakT: h.t };
        else { cur.end = h.t + H; if (h.score > cur.peak) { cur.peak = h.score; cur.peakT = h.t; } }
      } else if (cur) { wins.push(cur); cur = null; }
    });
    if (cur) wins.push(cur);
    return wins.sort((a, b) => b.peak - a.peak).slice(0, 3).sort((a, b) => a.start - b.start);
  }

  // One entry per local day: the best hour and the bite window around it.
  const dayKeyFmts = {};
  const dayKey = (t, tz) => (dayKeyFmts[tz] || (dayKeyFmts[tz] = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }))).format(new Date(t * 1000));
  function dailySummary(hours, tz = 'Australia/Sydney') {
    const days = [];
    hours.forEach((h, k) => {
      const key = dayKey(h.t, tz);
      let d = days[days.length - 1];
      if (!d || d.key !== key) days.push(d = { key, t: h.t, k0: k, hours: [] });
      d.hours.push(k);
    });
    return days.map(d => {
      let bk = d.hours[0];
      d.hours.forEach(k => { if (hours[k].score > hours[bk].score) bk = k; });
      const best = hours[bk], thr = best.score - 8;
      let a = bk, b = bk;
      while (a - 1 >= d.k0 && hours[a - 1].score >= thr) a--;
      while (b + 1 <= d.hours[d.hours.length - 1] && hours[b + 1].score >= thr) b++;
      return { key: d.key, t: d.t, k0: d.k0, best: best.score, peakT: best.t, peakK: bk, start: hours[a].t, end: hours[b].t + H,
        far: best.far, swellUnknown: best.swellUnknown, top: best.species.slice(0, 2).map(s => s.id) };
    });
  }

  FISH.scoring = {
    compass, moon,
    // Conditions at any time inside the downloaded data (yesterday → +3 days); null if outside it.
    at(loc, d, t, opts = {}) {
      if (!d || !d.times.length || t < d.times[0] - H || t > d.times[d.times.length - 1] + H) return null;
      extendMarine(d);
      let i = 0, best = Infinity;
      d.times.forEach((x, k) => { const dist = Math.abs(x - t); if (dist < best) { best = dist; i = k; } });
      return scoreHour(loc, d, i, tideExtremes(d, loc.tideLag), opts);
    },
    HOURS: 14 * 24,
    analyse(loc, d, nowT, opts = {}) {
      extendMarine(d);
      const ext = tideExtremes(d, loc.tideLag);
      let start = d.times.findIndex(t => t > nowT - H);
      if (start < 0) start = 0;
      const hours = [];
      for (let i = start; i < Math.min(d.times.length, start + this.HOURS); i++) {
        const h = scoreHour(loc, d, i, ext, opts);
        h.far = h.t > nowT + 7 * 86400;   // a week+ out: forecast is rougher
        hours.push(h);
      }
      const windows = bestWindows(hours);
      return { loc, hours, extremes: ext, windows, days: dailySummary(hours, loc.tz), hasTide: ext.length > 0 };
    }
  };
})();
