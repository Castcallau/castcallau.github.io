// One-off import of saved data from CastCall's old address (lapennaa07-dotcom.github.io/tideline-nsw).
// The old address redirects here with #castcall-import=<data>; merge it in before the rest of the app loads.
(function () {
  const PREFIX = '#castcall-import=';
  if (!location.hash.startsWith(PREFIX)) return;
  try {
    const incoming = JSON.parse(decodeURIComponent(location.hash.slice(PREFIX.length)));
    let moved = 0;
    for (const [key, raw] of Object.entries(incoming)) {
      const add = JSON.parse(raw), have = JSON.parse(localStorage.getItem(key) || '[]');
      if (!Array.isArray(add) || !Array.isArray(have)) continue;
      // Merge without duplicates: records by id (catches, pins, alerts), saved spots by value.
      const seen = new Set(have.map(x => (x && x.id) || x));
      const extra = add.filter(x => !seen.has((x && x.id) || x));
      if (extra.length) { localStorage.setItem(key, JSON.stringify(have.concat(extra))); moved += extra.length; }
    }
    if (moved) sessionStorage.setItem('castcall-imported', String(moved));
  } catch (e) { console.warn('Could not import saved data from the old address', e); }
  history.replaceState(null, '', location.pathname + location.search);   // tidy the address bar
})();
