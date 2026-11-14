// Live data from Open-Meteo (free, no API key).
// Weather: https://open-meteo.com/en/docs   Marine (swell, sea temp, tide): https://open-meteo.com/en/docs/marine-weather-api
window.FISH = window.FISH || {};
(function () {
  const CACHE_KEY = 'fish-cache-v2';
  const TTL = 30 * 60 * 1000; // 30 minutes

  const WEATHER_VARS = 'temperature_2m,precipitation_probability,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m';
  const MARINE_VARS = 'wave_height,wave_direction,wave_period,swell_wave_height,sea_surface_temperature,sea_level_height_msl';

  function url(base, pts, extra) {
    const lat = pts.map(p => p[0].toFixed(3)).join(',');
    const lon = pts.map(p => p[1].toFixed(3)).join(',');
    return `${base}?latitude=${lat}&longitude=${lon}&timezone=Australia%2FSydney&timeformat=unixtime&past_days=1&forecast_days=4&${extra}`;
  }

  async function fetchJSON(u, ms) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(u, { signal: ctl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      if (j && j.error) throw new Error(j.reason || 'API error');
      return Array.isArray(j) ? j : [j];
    } finally { clearTimeout(timer); }
  }

  // Try each mirror directly; if all are blocked (some school/work networks and sandboxed
  // browsers block them) and the page is served by serve.ps1, retry through its local proxy.
  async function getJSON(urls) {
    let last;
    for (const u of urls) { try { return await fetchJSON(u, 9000); } catch (e) { last = e; } }
    if (location.hostname === 'localhost') {
      for (const u of urls.slice().reverse()) { try { return await fetchJSON('/proxy?url=' + encodeURIComponent(u), 20000); } catch (e) { last = e; } }
    }
    throw last;
  }

  function merge(weather, marine) {
    const h = weather.hourly;
    const out = {
      times: h.time,
      temp: h.temperature_2m, rainProb: h.precipitation_probability, rain: h.precipitation,
      code: h.weather_code, cloud: h.cloud_cover, pressure: h.pressure_msl,
      wind: h.wind_speed_10m, windDir: h.wind_direction_10m, gust: h.wind_gusts_10m,
      sunrise: weather.daily.sunrise, sunset: weather.daily.sunset,
      wave: [], waveDir: [], period: [], swell: [], sst: [], sea: []
    };
    if (marine && marine.hourly) {
      const m = marine.hourly, idx = new Map(m.time.map((t, i) => [t, i]));
      const keys = [['wave', 'wave_height'], ['waveDir', 'wave_direction'], ['period', 'wave_period'],
        ['swell', 'swell_wave_height'], ['sst', 'sea_surface_temperature'], ['sea', 'sea_level_height_msl']];
      for (const t of out.times) {
        const i = idx.get(t);
        for (const [k, mk] of keys) out[k].push(i === undefined || !m[mk] ? null : m[mk][i]);
      }
    } else {
      for (const k of ['wave', 'waveDir', 'period', 'swell', 'sst', 'sea']) out[k] = out.times.map(() => null);
    }
    return out;
  }

  FISH.api = {
    async load(locations, force) {
      if (!force) {
        try {
          const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
          if (c && Date.now() - c.at < TTL && c.ids === locations.map(l => l.id).join()) return { data: c.data, at: c.at, cached: true };
        } catch (e) { /* ignore bad cache */ }
      }
      const pts = locations.map(l => [l.lat, l.lon]), wq = `hourly=${WEATHER_VARS}&daily=sunrise,sunset&wind_speed_unit=kmh`;
      const weatherUrls = [
        url('https://api.open-meteo.com/v1/forecast', pts, wq),
        url('https://historical-forecast-api.open-meteo.com/v1/forecast', pts, wq) // mirror of the same forecast
      ];
      const marineUrl = url('https://marine-api.open-meteo.com/v1/marine', locations.map(l => l.sea), `hourly=${MARINE_VARS}&cell_selection=sea`);

      const [weather, marine] = await Promise.all([
        getJSON(weatherUrls),
        getJSON([marineUrl]).catch(e => { console.warn('Marine data unavailable:', e); return null; })
      ]);

      const data = {};
      locations.forEach((l, i) => { data[l.id] = merge(weather[i], marine ? marine[i] : null); });
      const at = Date.now();
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at, ids: locations.map(l => l.id).join(), data })); } catch (e) { /* storage full */ }
      return { data, at, cached: false, marineOk: !!marine };
    }
  };
})();
