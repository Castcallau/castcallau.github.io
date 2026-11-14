// Alerts: "tell me when a spot/fish hits score X". Rules are saved on this device and checked every time
// CastCall loads or refreshes its forecast. Matches can be sent as browser notifications or added to a calendar.
window.FISH = window.FISH || {};
(function () {
  const F = window.FISH, SP = F.SPECIES, H = 3600;
  const KEY = 'castcall-alerts', SEEN = 'castcall-alerts-seen';
  const $ = s => document.querySelector(s);
  const WHEN = { any: 'Any time', dawndusk: 'Dawn & dusk only', daylight: 'Daylight only', weekend: 'Weekends only' };

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const save = r => localStorage.setItem(KEY, JSON.stringify(r));
  const seen = () => { try { return JSON.parse(localStorage.getItem(SEEN) || '{}'); } catch (e) { return {}; } };

  let cache = { sig: null, results: {} };

  function whenOk(rule, h, loc) {
    if (rule.when === 'dawndusk') return h.light.cat === 'dawn' || h.light.cat === 'dusk';
    if (rule.when === 'daylight') return h.light.cat !== 'night';
    if (rule.when === 'weekend') { const d = F.ui.day(h.t, loc.tz); return d === 'Sat' || d === 'Sun'; }
    return true;
  }
  const inRegion = (l, region) => region === 'all' || (region.startsWith('state:') ? l.state === region.slice(6) : l.region === region);
  const regionName = r => r === 'all' ? 'Australia' : r.startsWith('state:') ? F.STATES[r.slice(6)].name : r;

  function describe(rule) {
    const loc = rule.spot !== 'any' && F.ui.findLoc(rule.spot);
    const where = loc ? loc.name : `any spot in ${regionName(rule.region)}`;
    const water = !loc && rule.water && rule.water !== 'all' ? (rule.water === 'fresh' ? ' (freshwater)' : ' (saltwater)') : '';
    return `${rule.species ? SP[rule.species].name : 'Any fish'} at ${where}${water} · score ${rule.min}+ · ${WHEN[rule.when]}`;
  }

  // Windows (consecutive matching hours) for one rule across its candidate spots.
  function matches(rule) {
    const st = F.ui.state, now = Date.now() / 1000;
    let locs = rule.spot !== 'any' ? [F.ui.findLoc(rule.spot)].filter(Boolean)
      : F.LOCATIONS.filter(l => inRegion(l, rule.region) && (!rule.water || rule.water === 'all' || l.water === rule.water));
    if (rule.species) locs = locs.filter(l => l.species.includes(rule.species));
    const out = [];
    for (const loc of locs) {
      if (!st.data[loc.id]) continue;
      const a = F.scoring.analyse(loc, st.data[loc.id], now, { target: rule.species || '' });
      const okHour = h => {
        if (h.score < rule.min || !whenOk(rule, h, loc)) return false;
        const sp = rule.species && h.species.find(s => s.id === rule.species);
        return !(sp && sp.closed && !sp.closed.release);
      };
      // 1) blocks of consecutive matching hours, 2) inside each block keep only the hours near its peak,
      // so a long OK stretch becomes the real bite windows (e.g. dawn and dusk) instead of one 16-hour block.
      const blocks = [];
      let cur = [];
      for (const h of a.hours) { if (okHour(h)) cur.push(h); else if (cur.length) { blocks.push(cur); cur = []; } }
      if (cur.length) blocks.push(cur);
      for (const b of blocks) {
        const thr = Math.max(rule.min, Math.max(...b.map(h => h.score)) - 8);
        let w = null;
        for (const h of b) {
          if (h.score >= thr) {
            if (!w) w = { loc, start: h.t, end: h.t + H, peak: h.score, peakT: h.t, top: h.species.slice(0, 2).map(s => s.id) };
            else { w.end = h.t + H; if (h.score > w.peak) { w.peak = h.score; w.peakT = h.t; } }
          } else if (w) { out.push(w); w = null; }
        }
        if (w) out.push(w);
      }
    }
    return out.sort((x, y) => y.peak - x.peak).slice(0, 6).sort((x, y) => x.start - y.start);
  }

  function allMatches() {
    const rules = load(), st = F.ui.state;
    const sig = st.fetchedAt + '|' + localStorage.getItem(KEY);
    if (cache.sig !== sig) {
      cache = { sig, results: {} };
      for (const r of rules) if (r.enabled) cache.results[r.id] = matches(r);
    }
    return cache.results;
  }

  const winKey = (r, w) => `${r.id}|${w.loc.id}|${w.start}`;
  const winLabel = w => {
    const tz = w.loc.tz, d0 = F.ui.day(w.start, tz), d1 = F.ui.day(w.end, tz);
    return `${d0} ${F.ui.hr(w.start, tz)}–${d1 !== d0 ? d1 + ' ' : ''}${F.ui.hr(w.end, tz)}`;
  };

  // Called after every render: notify about new matches once.
  function check() {
    const st = F.ui.state;
    if (!st.data) return;
    const rules = load().filter(r => r.enabled);
    if (!rules.length) { $('#alert-banner').hidden = true; return; }
    const res = allMatches(), s = seen(), fresh = [];
    for (const r of rules) for (const w of res[r.id] || []) {
      const k = winKey(r, w);
      if (!s[k]) { fresh.push({ r, w }); s[k] = w.end; }
    }
    const nowS = Date.now() / 1000;
    for (const k of Object.keys(s)) if (s[k] < nowS - 86400) delete s[k];
    localStorage.setItem(SEEN, JSON.stringify(s));

    const upcoming = rules.flatMap(r => (res[r.id] || []).map(w => ({ r, w }))).sort((a, b) => a.w.start - b.w.start);
    const banner = $('#alert-banner');
    if (upcoming.length && !sessionStorage.getItem('castcall-banner-closed')) {
      banner.hidden = false;
      const first = upcoming.slice(0, 3);
      banner.innerHTML = `<span>🔔</span><div class="ab-list">${first.map(({ w }) =>
        `<button class="link" data-open="${w.loc.id}" data-t="${w.peakT}"><b>${F.ui.esc(w.loc.name.split(' – ')[0])}</b> hits ${w.peak} · ${winLabel(w)}</button>`).join('')}
        ${upcoming.length > 3 ? `<button class="link" data-view="alerts">+${upcoming.length - 3} more</button>` : ''}</div>
        <button class="icon-btn" id="ab-close" aria-label="Dismiss">✕</button>`;
      banner.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { F.ui.setView('spots'); F.ui.select(b.dataset.open); F.ui.jumpTo(Number(b.dataset.t)); });
      banner.querySelectorAll('[data-view]').forEach(b => b.onclick = () => F.ui.setView('alerts'));
      $('#ab-close').onclick = () => { sessionStorage.setItem('castcall-banner-closed', '1'); banner.hidden = true; };
    } else banner.hidden = true;

    if (fresh.length && 'Notification' in window && Notification.permission === 'granted') {
      const body = fresh.slice(0, 3).map(({ w }) => `${w.loc.name.split(' – ')[0]}: ${w.peak} on ${winLabel(w)}`).join('\n');
      const title = fresh.length === 1 ? '🎣 Fishing alert' : `🎣 ${fresh.length} fishing alerts`;
      notify(title, body);
    }
  }

  async function notify(title, body) {
    try {
      const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
      if (reg) reg.showNotification(title, { body, icon: 'icon.svg', tag: 'castcall' });
      else new Notification(title, { body, icon: 'icon.svg' });
    } catch (e) { console.warn('Notification failed', e); }
  }

  // ---------- Calendar ----------
  const icsDate = t => new Date(t * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  function details(w) {
    const lines = w.top.map(id => `${SP[id].name}: ${SP[id].baits.slice(0, 3).join(', ')}`);
    return `CastCall score ${w.peak}. Target: ${lines.join(' | ')}. Check conditions before you go.`;
  }
  function ics(w) {
    const txt = s => s.replace(/[,;\\]/g, m => '\\' + m);
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CastCall//EN', 'BEGIN:VEVENT',
      `UID:${w.loc.id}-${w.start}@castcall`, `DTSTAMP:${icsDate(Date.now() / 1000)}`,
      `DTSTART:${icsDate(w.start)}`, `DTEND:${icsDate(w.end)}`,
      `SUMMARY:${txt(`🎣 Fishing – ${w.loc.name.split(' – ')[0]} (score ${w.peak})`)}`,
      `DESCRIPTION:${txt(details(w))}`, `LOCATION:${txt(w.loc.name)}`, `GEO:${w.loc.lat};${w.loc.lon}`,
      'BEGIN:VALARM', 'TRIGGER:-PT60M', 'ACTION:DISPLAY', 'DESCRIPTION:Fishing window in 1 hour', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  }
  function gcal(w) {
    const p = new URLSearchParams({ action: 'TEMPLATE', text: `🎣 Fishing – ${w.loc.name.split(' – ')[0]} (score ${w.peak})`,
      dates: `${icsDate(w.start)}/${icsDate(w.end)}`, details: details(w), location: `${w.loc.lat},${w.loc.lon}` });
    return 'https://calendar.google.com/calendar/render?' + p.toString();
  }

  // A closure that currently blocks this alert's fish everywhere it could match.
  function closedNow(r) {
    if (!r.species) return null;
    const m = new Date().getMonth();
    return (SP[r.species].closures || []).find(c => !c.release && c.where === 'all' && c.months.includes(m)) || null;
  }

  // ---------- View ----------
  function render() {
    const rules = load(), res = F.ui.state.data ? allMatches() : {};
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    $('#notif-status').innerHTML = perm === 'granted' ? '✅ Notifications are on for this browser.'
      : perm === 'denied' ? '🚫 Notifications are blocked – allow them in your browser\'s site settings.'
      : perm === 'unsupported' ? 'This browser can\'t show notifications – use the calendar buttons instead.'
      : '<button class="btn" id="notif-on">🔔 Turn on notifications</button>';
    const on = $('#notif-on');
    if (on) on.onclick = async () => { await Notification.requestPermission(); render(); };

    $('#alert-rules').innerHTML = rules.length ? rules.map(r => {
      const wins = res[r.id] || [];
      return `<article class="rule${r.enabled ? '' : ' off'}">
        <div class="rule-head">
          <label class="switch"><input type="checkbox" data-toggle="${r.id}" ${r.enabled ? 'checked' : ''}><span>${r.enabled ? 'On' : 'Off'}</span></label>
          <div class="rule-desc">${F.ui.esc(describe(r))}</div>
          <button class="icon-btn" data-delrule="${r.id}" title="Delete alert" aria-label="Delete alert">🗑</button>
        </div>
        ${!r.enabled ? '' : wins.length ? `<ul class="rule-wins">${wins.map((w, k) => `<li>
            <button class="link" data-open="${w.loc.id}" data-t="${w.peakT}"><b>${F.ui.esc(w.loc.name.split(' – ')[0])}</b> · ${winLabel(w)} · peak ${w.peak}</button>
            <span class="cal"><a href="${gcal(w)}" target="_blank" rel="noopener">Google Calendar</a> · <button class="link" data-ics="${r.id}|${k}">Phone calendar (.ics)</button></span>
          </li>`).join('')}</ul>` : closedNow(r)
            ? `<p class="muted small">⛔ ${F.ui.esc(closedNow(r).note)} This alert will start matching again when the season reopens.</p>`
            : '<p class="muted small">Nothing hits this in the next 2 weeks yet. CastCall will check again each time you open it.</p>'}
      </article>`;
    }).join('') : '<p class="empty">No alerts yet. Make one above – e.g. "Kingfish, any spot in Sydney, score 70+, dawn & dusk".</p>';

    document.querySelectorAll('[data-toggle]').forEach(c => c.onchange = () => {
      const rs = load(), r = rs.find(x => x.id === c.dataset.toggle); r.enabled = c.checked; save(rs); render(); check();
    });
    document.querySelectorAll('[data-delrule]').forEach(b => b.onclick = () => {
      if (!confirm('Delete this alert?')) return;
      save(load().filter(x => x.id !== b.dataset.delrule)); render(); check();
    });
    document.querySelectorAll('#alert-rules [data-open]').forEach(b => b.onclick = () => { F.ui.setView('spots'); F.ui.select(b.dataset.open); F.ui.jumpTo(Number(b.dataset.t)); });
    document.querySelectorAll('[data-ics]').forEach(b => b.onclick = () => {
      const [rid, k] = b.dataset.ics.split('|'), w = (allMatches()[rid] || [])[Number(k)];
      if (!w) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([ics(w)], { type: 'text/calendar' }));
      a.download = `fishing-${w.loc.id}.ics`; a.click();
    });
  }

  function fillSpots() {
    const locs = F.LOCATIONS.slice().sort((a, b) => a.name.localeCompare(b.name)), cur = $('#a-spot').value;
    $('#a-spot').innerHTML = `<option value="any">Any spot</option>` + Object.keys(F.STATES).map(st => {
      const ls = locs.filter(l => l.state === st && !l.pin);
      return ls.length ? `<optgroup label="${F.STATES[st].name}">${ls.map(l => `<option value="${l.id}">${F.ui.esc(l.name)}</option>`).join('')}</optgroup>` : '';
    }).join('') + (locs.some(l => l.pin) ? `<optgroup label="📌 My pins">${locs.filter(l => l.pin).map(l => `<option value="${l.id}">${F.ui.esc(l.name)}</option>`).join('')}</optgroup>` : '');
    if (cur) $('#a-spot').value = cur;
  }

  function init() {
    fillSpots();
    $('#a-region').innerHTML = F.ui.regionOptions('All Australia');
    $('#a-species').innerHTML = `<option value="">Any fish</option>` + Object.entries(SP).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([id, s]) => `<option value="${id}">${s.name}</option>`).join('');
    $('#a-when').innerHTML = Object.entries(WHEN).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    const syncSpot = () => { const any = $('#a-spot').value === 'any'; $('#a-region-wrap').hidden = !any; $('#a-water-wrap').hidden = !any; };
    $('#a-spot').onchange = syncSpot; syncSpot();
    $('#a-min').oninput = e => { $('#a-min-val').textContent = e.target.value; };
    $('#alert-form').onsubmit = e => {
      e.preventDefault();
      const spot = $('#a-spot').value;
      const rule = { id: Date.now().toString(36), spot, region: spot === 'any' ? $('#a-region').value : 'all', water: spot === 'any' ? $('#a-water').value : 'all',
        species: $('#a-species').value, min: Number($('#a-min').value), when: $('#a-when').value, enabled: true };
      const rs = load(); rs.push(rule); save(rs);
      sessionStorage.removeItem('castcall-banner-closed');
      render(); check();
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().then(render);
    };
  }

  F.alerts = {
    render, check, fillSpots,
    prefill(spotId) {
      $('#a-spot').value = spotId; $('#a-spot').dispatchEvent(new Event('change'));
      $('#alert-form').scrollIntoView({ behavior: 'smooth' });
    }
  };
  document.addEventListener('DOMContentLoaded', init);
})();
