// Pinned spots: drop a pin anywhere and CastCall builds a full spot for that exact point –
// live weather, swell, tide and water temperature there, with fish picked from nearby spots.
// Pins are saved on this device and behave like any other spot (list, map, alerts, catch log).
window.FISH = window.FISH || {};
(function () {
  const F = window.FISH, SP = F.SPECIES, KEY = 'castcall-pins';
  const $ = s => document.querySelector(s);
  const EXPOSURE = { rock: 0.9, beach: 0.9, offshore: 1, breakwall: 0.7, harbour: 0.35, estuary: 0.3, dam: 0.6, river: 0.3 };
  const SALT_TYPES = ['estuary', 'harbour', 'beach', 'rock', 'breakwall', 'offshore'], FRESH_TYPES = ['dam', 'river'];
  const DIRS = [['North', 0], ['North-east', 45], ['East', 90], ['South-east', 135], ['South', 180], ['South-west', 225], ['West', 270], ['North-west', 315]];
  let map = null, picking = false, editing = null, draft = null;

  const recs = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const saveRecs = r => localStorage.setItem(KEY, JSON.stringify(r));
  const builtIn = () => F.LOCATIONS.filter(l => !l.pin);

  function km(a, b) {
    const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function nearby(p, water, n = 4) {
    return builtIn().filter(l => !water || l.water === water).map(l => ({ l, km: km(p, l) })).sort((a, b) => a.km - b.km).slice(0, n);
  }
  function nearest(p, water) { return nearby(p, water, 1)[0] || null; }

  // Fish for a pin: what the nearby spots of the same water type hold, most common first.
  function suggestSpecies(p, water) {
    const near = nearby(p, water, 5).filter((x, k) => k < 2 || x.km < 150);
    const count = {};
    near.forEach(({ l }, k) => l.species.forEach(s => { count[s] = (count[s] || 0) + (5 - k); }));
    return Object.keys(count).sort((a, b) => count[b] - count[a]).slice(0, 7);
  }

  function build(r) {
    const near = nearest(r), any = near ? near.l : builtIn()[0];
    return {
      id: r.id, pin: true, name: r.name, region: 'My pins', state: any.state, tz: any.tz,
      lat: r.lat, lon: r.lon, sea: r.water === 'salt' ? [r.lat, r.lon] : undefined,
      access: r.access.length ? r.access : ['land'], type: r.type, faces: r.faces, exposure: EXPOSURE[r.type] ?? 0.5,
      tideLag: r.type === 'estuary' ? 20 : 0, water: r.water, species: r.species.length ? r.species : suggestSpecies(r, r.water),
      crocs: !!(near && near.km < 400 && nearby(r, null, 3).some(x => x.l.crocs)),
      notes: r.notes || (near ? `Your own pinned spot. Everything here is worked out for this exact point. The nearest CastCall spot is ${near.l.name} (${Math.round(near.km)} km): ${near.l.notes}` : 'Your own pinned spot.'),
      access_info: 'Your pin – check access, private land, marine park zones and local rules before you go.'
    };
  }

  function install() {
    for (let i = F.LOCATIONS.length - 1; i >= 0; i--) if (F.LOCATIONS[i].pin) F.LOCATIONS.splice(i, 1);
    recs().forEach(r => F.LOCATIONS.push(build(r)));
  }

  function refreshLists() {
    if (F.alerts && F.alerts.fillSpots) F.alerts.fillSpots();
    if (F.catchlog && F.catchlog.fillSpots) F.catchlog.fillSpots();
  }

  // ---------- Picking on the map ----------
  function setPicking(on) {
    picking = on;
    if (!map) return;
    map.getContainer().classList.toggle('picking', on);
    $('#pin-hint').hidden = !on;
  }

  function startPick() {
    if (F.ui.state.view !== 'spots') F.ui.setView('spots');
    F.ui.closeDetail(false);
    const spots = $('#view-spots');
    if (!spots.classList.contains('show-map') && getComputedStyle($('.map-pane')).display === 'none') $('#map-toggle').click();
    setPicking(true);
  }

  // ---------- Dialog ----------
  function speciesBoxes(water, chosen) {
    const all = Object.entries(SP).filter(([id, s]) => water === 'fresh' ? s.water === 'fresh' || id === 'barramundi' : s.water !== 'fresh')
      .sort((a, b) => (chosen.includes(b[0]) - chosen.includes(a[0])) || a[1].name.localeCompare(b[1].name));
    return all.map(([id, s]) => `<label class="chk"><input type="checkbox" name="p-sp" value="${id}" ${chosen.includes(id) ? 'checked' : ''}> ${F.ui.esc(s.name)}</label>`).join('');
  }

  function fillDialog() {
    const d = draft, near = nearest(d);
    $('#p-coords').textContent = `${d.lat.toFixed(4)}, ${d.lon.toFixed(4)}${near ? ` · ${near.km < 1 ? '<1' : Math.round(near.km)} km from ${near.l.name}` : ''}`;
    $('#p-name').value = d.name;
    document.querySelectorAll('[name=p-water]').forEach(r => { r.checked = r.value === d.water; });
    $('#p-type').innerHTML = (d.water === 'fresh' ? FRESH_TYPES : SALT_TYPES).map(t => `<option value="${t}" ${t === d.type ? 'selected' : ''}>${F.ui.TYPE[t]}</option>`).join('');
    $('#p-faces').innerHTML = DIRS.map(([n, deg]) => `<option value="${deg}" ${deg === d.faces ? 'selected' : ''}>${n}</option>`).join('');
    $('#p-faces-wrap').hidden = d.water === 'fresh';
    document.querySelectorAll('[name=p-access]').forEach(c => { c.checked = d.access.includes(c.value); });
    $('#p-species').innerHTML = speciesBoxes(d.water, d.species);
    $('#p-notes').value = d.notes || '';
    $('#p-title').textContent = editing ? 'Edit your pin' : '📌 New pinned spot';
  }

  function defaultsAt(lat, lon) {
    const p = { lat, lon }, near = nearest(p);
    const water = near && near.l.water === 'fresh' && near.km < 15 ? 'fresh' : 'salt';
    const sameNear = nearest(p, water);
    return {
      id: 'pin-' + Date.now().toString(36), lat, lon, water,
      name: near ? `My spot near ${near.l.name.split(' – ')[0].split(' (')[0]}` : 'My spot',
      type: sameNear && sameNear.km < 30 ? sameNear.l.type : (water === 'fresh' ? 'river' : 'estuary'),
      faces: sameNear ? sameNear.l.faces : 90, access: ['land'],
      species: suggestSpecies(p, water), notes: ''
    };
  }

  function open(rec, isEdit) {
    draft = JSON.parse(JSON.stringify(rec)); editing = isEdit ? rec.id : null;
    setPicking(false);
    fillDialog();
    $('#pin-dialog').showModal();
  }

  async function submit(e) {
    e.preventDefault();
    const d = draft;
    d.name = $('#p-name').value.trim() || 'My spot';
    d.type = $('#p-type').value; d.faces = Number($('#p-faces').value);
    d.access = [...document.querySelectorAll('[name=p-access]:checked')].map(c => c.value);
    d.species = [...document.querySelectorAll('[name=p-sp]:checked')].map(c => c.value);
    d.notes = $('#p-notes').value.trim();
    const all = recs().filter(r => r.id !== d.id); all.push(d); saveRecs(all);
    install(); refreshLists();
    $('#pin-dialog').close();
    $('#status').textContent = 'Getting the forecast for your pin…';
    try { await F.ui.loadPins(); F.ui.select(d.id); }
    catch (err) { F.ui.showError('Could not load the forecast for that pin – check your connection.'); }
  }

  function init() {
    install();
    $('#pin-form').onsubmit = submit;
    $('#p-cancel').onclick = () => { $('#pin-dialog').close(); };
    document.querySelectorAll('[name=p-water]').forEach(r => r.onchange = () => {
      draft.water = r.value;
      draft.type = r.value === 'fresh' ? 'river' : 'estuary';
      draft.species = suggestSpecies(draft, r.value);
      fillDialog();
    });
    $('#p-here').onclick = () => {
      if (!navigator.geolocation) return;
      $('#p-here').textContent = 'Locating…';
      navigator.geolocation.getCurrentPosition(pos => {
        draft.lat = pos.coords.latitude; draft.lon = pos.coords.longitude;
        $('#p-here').textContent = '📍 Use where I am now';
        const keepName = $('#p-name').value; fillDialog(); $('#p-name').value = keepName;
      }, () => { $('#p-here').textContent = '📍 Use where I am now'; F.ui.showError('Could not get your location.'); }, { timeout: 10000 });
    };
    $('#pin-start').onclick = startPick;
    $('#pin-hint-cancel').onclick = () => setPicking(false);
  }

  F.pins = {
    get picking() { return picking; },
    nearest: l => nearest(l),
    attachMap(m) {
      map = m;
      const Ctl = L.Control.extend({
        onAdd() {
          const b = L.DomUtil.create('button', 'map-pin-btn');
          b.type = 'button'; b.innerHTML = '📌 Pin a spot'; b.title = 'Drop a pin anywhere for a full rundown';
          L.DomEvent.disableClickPropagation(b);
          b.onclick = () => setPicking(!picking);
          return b;
        }
      });
      new Ctl({ position: 'topright' }).addTo(map);
    },
    start(lat, lon) { open(defaultsAt(lat, lon), false); },
    edit(id) { const r = recs().find(x => x.id === id); if (r) open(r, true); },
    remove(id) {
      if (!confirm('Remove this pin? Catches you logged here stay in your catch log.')) return;
      saveRecs(recs().filter(r => r.id !== id));
      F.ui.closeDetail(false);
      install(); refreshLists(); F.ui.render();
    }
  };
  // Pins must be in the spot list before the app starts, so install them straight away.
  install();
  document.addEventListener('DOMContentLoaded', init);
})();
