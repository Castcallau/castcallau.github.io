// Catch log – saved on this device (localStorage). Each catch stores a snapshot of the conditions.
window.FISH = window.FISH || {};
(function () {
  const F = window.FISH, SP = F.SPECIES;
  const KEY = 'castcall-catches';
  const $ = s => document.querySelector(s);
  let photoData = null;

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { F.ui.showError('Storage is full – remove some photos or export a backup and delete old catches.'); return false; }
  }

  function localInputValue(date) {
    const p = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
  }

  function minSize(sp) {
    const m = sp && sp.size && sp.size.match(/^(\d+)(?:–(\d+))?/);
    return m ? { min: Number(m[1]), max: m[2] ? Number(m[2]) : null } : null;
  }

  function sizeWarning() {
    const sp = SP[$('#c-species').value], len = Number($('#c-length').value), lim = minSize(sp), out = $('#c-size-warn');
    if (!sp || !len || !lim) { out.hidden = true; return; }
    let msg = null;
    if (len < lim.min) msg = `Under the legal size (${sp.size}) – it has to go back.`;
    else if (lim.max && len > lim.max) msg = `Over the slot limit (${sp.size}) – it has to go back.`;
    if (sp.pest) msg = 'Pest species – do not release it alive.';
    out.hidden = !msg; out.textContent = msg ? '⚠️ ' + msg : '';
  }

  function resizePhoto(file) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, 480 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = rej; img.src = url;
    });
  }

  function snapshot(spotId, t) {
    const loc = F.ui.findLoc(spotId), st = F.ui.state;
    if (!loc || !st.data || !st.data[loc.id]) return null;
    const h = F.scoring.at(loc, st.data[loc.id], t);
    if (!h) return null;
    return {
      score: h.score, wind: Math.round(h.wind), windDir: Math.round(h.windDir), wave: h.wave, sst: h.sst != null ? Math.round(h.sst * 10) / 10 : null,
      tide: h.tide ? h.tide.state : null, light: h.light.cat, moon: h.moon.name, temp: h.temp != null ? Math.round(h.temp) : null,
      rain48: h.fresh ? Math.round(h.rain48) : null
    };
  }

  function stats(list) {
    if (!list.length) return '';
    const count = (key) => {
      const m = {};
      list.forEach(c => { const k = c[key]; if (k) m[k] = (m[k] || 0) + 1; });
      return Object.entries(m).sort((a, b) => b[1] - a[1]);
    };
    const species = count('speciesName'), baits = count('bait'), spots = count('spotName');
    const biggest = list.filter(c => c.length).sort((a, b) => b.length - a.length)[0];
    const scored = list.filter(c => c.cond && c.cond.score != null);
    const avg = scored.length ? Math.round(scored.reduce((s, c) => s + c.cond.score, 0) / scored.length) : null;
    const tile = (k, v, s) => `<div><span class="c-k">${k}</span><span class="c-v">${v}</span><span class="c-s">${s || ''}</span></div>`;
    return `<div class="cond-grid stats">
      ${tile('Catches', list.length, `${list.filter(c => c.kept === 'released').length} released`)}
      ${tile('Top species', species[0] ? F.ui.esc(species[0][0].split(' (')[0]) : '–', species[0] ? `${species[0][1]} caught · ${species.length} species` : '')}
      ${tile('Biggest', biggest ? biggest.length + ' cm' : '–', biggest ? F.ui.esc(biggest.speciesName.split(' (')[0]) : '')}
      ${tile('Best bait', baits[0] ? F.ui.esc(baits[0][0]) : '–', baits[0] ? `${baits[0][1]} fish` : '')}
      ${tile('Best spot', spots[0] ? F.ui.esc(spots[0][0].split(' – ')[0]) : '–', spots[0] ? `${spots[0][1]} fish` : '')}
      ${tile('Avg score', avg ?? '–', avg != null ? 'when you caught fish' : '')}
    </div>`;
  }

  function entryHtml(c) {
    const u = F.ui, d = new Date(c.t * 1000);
    const when = d.toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const cond = c.cond ? [
      `Score ${c.cond.score}`, `${u.arrow(c.cond.windDir)} ${c.cond.wind} km/h`,
      c.cond.wave != null ? `🌊 ${c.cond.wave.toFixed(1)} m` : null, c.cond.rain48 != null ? `🌧️ ${c.cond.rain48} mm/48h` : null,
      c.cond.sst != null ? `🌡️ ${c.cond.sst}° water` : null, c.cond.tide ? `${c.cond.tide} tide` : null, c.cond.light, c.cond.moon
    ].filter(Boolean).map(x => `<span class="chip">${x}</span>`).join('') : '<span class="muted small">No conditions saved (outside forecast range)</span>';
    return `<article class="catch">
      ${c.photo ? `<img src="${c.photo}" alt="Photo of ${u.esc(c.speciesName)}">` : '<div class="no-photo" aria-hidden="true">🐟</div>'}
      <div class="catch-body">
        <div class="catch-title"><b>${u.esc(c.speciesName)}</b>${c.length ? ` · ${c.length} cm` : ''}${c.weight ? ` · ${c.weight} kg` : ''}
          <span class="chip ${c.kept === 'released' ? 'good' : ''}">${c.kept === 'released' ? 'Released' : 'Kept'}</span></div>
        <div class="muted small">${u.esc(c.spotName || 'Unknown spot')} · ${when}</div>
        ${c.bait ? `<div class="small">🎣 ${u.esc(c.bait)}</div>` : ''}
        ${c.notes ? `<div class="small">${u.esc(c.notes)}</div>` : ''}
        <div class="chips">${cond}</div>
      </div>
      <button class="icon-btn del" data-del="${c.id}" title="Delete catch" aria-label="Delete catch">🗑</button>
    </article>`;
  }

  function render() {
    const list = load().sort((a, b) => b.t - a.t);
    $('#log-stats').innerHTML = stats(list);
    $('#log-list').innerHTML = list.length ? list.map(entryHtml).join('')
      : '<p class="empty">No catches yet. Log your first fish above – CastCall saves the weather, tide and score with it so you can see what works.</p>';
    document.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (!confirm('Delete this catch? This cannot be undone.')) return;
      save(load().filter(c => c.id !== b.dataset.del)); render();
    });
  }

  function fillSpots() {
    const locs = F.LOCATIONS.slice().sort((a, b) => a.name.localeCompare(b.name)), cur = $('#c-spot').value;
    const opt = l => `<option value="${l.id}">${F.ui.esc(l.name)}</option>`;
    $('#c-spot').innerHTML = `<option value="">— Choose a spot —</option>` +
      (locs.some(l => l.pin) ? `<optgroup label="📌 My pins">${locs.filter(l => l.pin).map(opt).join('')}</optgroup>` : '') +
      Object.keys(F.STATES).map(st => {
        const ls = locs.filter(l => l.state === st && !l.pin);
        return ls.length ? `<optgroup label="${F.STATES[st].name}">${ls.map(opt).join('')}</optgroup>` : '';
      }).join('') +
      `<option value="other">Other spot…</option>`;
    if (cur) $('#c-spot').value = cur;
  }

  function fillForm() {
    fillSpots();
    $('#c-species').innerHTML = `<option value="">— Choose a fish —</option>` +
      Object.entries(SP).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([id, s]) => `<option value="${id}">${s.name}</option>`).join('') +
      `<option value="other">Other fish…</option>`;
    const baits = new Set();
    Object.values(SP).forEach(s => [...s.baits, ...s.lures].forEach(b => baits.add(b.split(' (')[0])));
    $('#c-baits').innerHTML = [...baits].sort().map(b => `<option value="${F.ui.esc(b)}">`).join('');
    $('#c-time').value = localInputValue(new Date());
  }

  function resetForm() {
    $('#catch-form').reset();
    photoData = null; $('#c-photo-preview').hidden = true;
    $('#c-spot-other').hidden = true; $('#c-species-other').hidden = true; $('#c-size-warn').hidden = true;
    $('#c-time').value = localInputValue(new Date());
  }

  function init() {
    fillForm();
    $('#c-spot').onchange = e => { $('#c-spot-other').hidden = e.target.value !== 'other'; };
    $('#c-species').onchange = e => { $('#c-species-other').hidden = e.target.value !== 'other'; sizeWarning(); };
    $('#c-length').oninput = sizeWarning;
    $('#c-photo').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      try { photoData = await resizePhoto(f); $('#c-photo-preview').src = photoData; $('#c-photo-preview').hidden = false; }
      catch (err) { F.ui.showError('Could not read that photo.'); }
    };
    $('#catch-form').onsubmit = e => {
      e.preventDefault();
      const spotId = $('#c-spot').value, spId = $('#c-species').value;
      const t = Math.round(new Date($('#c-time').value).getTime() / 1000);
      const loc = F.ui.findLoc(spotId);
      const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t,
        spotId: loc ? spotId : '', spotName: loc ? loc.name : ($('#c-spot-other').value.trim() || 'Other spot'),
        species: SP[spId] ? spId : '', speciesName: SP[spId] ? SP[spId].name : ($('#c-species-other').value.trim() || 'Unknown fish'),
        length: Number($('#c-length').value) || null, weight: Number($('#c-weight').value) || null,
        bait: $('#c-bait').value.trim(), kept: document.querySelector('[name=c-kept]:checked').value,
        notes: $('#c-notes').value.trim(), photo: photoData, cond: loc ? snapshot(spotId, t) : null
      };
      const list = load(); list.push(entry);
      if (save(list)) { resetForm(); $('#log-form-wrap').open = false; render(); $('#log-saved').hidden = false; setTimeout(() => { $('#log-saved').hidden = true; }, 3000); }
    };
    $('#log-export').onclick = () => {
      const rows = [['Date', 'Spot', 'Species', 'Length cm', 'Weight kg', 'Bait/lure', 'Kept/released', 'Score', 'Wind km/h', 'Swell m', 'Water temp', 'Tide', 'Light', 'Moon', 'Notes']];
      load().sort((a, b) => a.t - b.t).forEach(c => rows.push([new Date(c.t * 1000).toLocaleString('en-AU'), c.spotName, c.speciesName, c.length ?? '', c.weight ?? '', c.bait, c.kept,
        c.cond?.score ?? '', c.cond?.wind ?? '', c.cond?.wave ?? '', c.cond?.sst ?? '', c.cond?.tide ?? '', c.cond?.light ?? '', c.cond?.moon ?? '', c.notes]));
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      download('castcall-catches.csv', 'text/csv', csv);
    };
    $('#log-backup').onclick = () => download('castcall-backup.json', 'application/json', JSON.stringify(load()));
    $('#log-restore').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const incoming = JSON.parse(await f.text());
        if (!Array.isArray(incoming)) throw new Error('bad file');
        const ids = new Set(load().map(c => c.id));
        save(load().concat(incoming.filter(c => c && c.id && c.t && !ids.has(c.id)))); render();
      } catch (err) { F.ui.showError('That file is not a CastCall backup.'); }
      e.target.value = '';
    };
  }

  function download(name, type, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  F.catchlog = {
    render, fillSpots,
    prefill(spotId) {
      $('#log-form-wrap').open = true;
      $('#c-spot').value = spotId; $('#c-spot-other').hidden = true;
      $('#c-time').value = localInputValue(new Date());
      $('#log-form-wrap').scrollIntoView({ behavior: 'smooth' });
    }
  };
  document.addEventListener('DOMContentLoaded', init);
})();
