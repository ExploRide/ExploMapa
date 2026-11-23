/* CSV parsing and coordinate resolution shared by the pin import dialog. */
window.pinImport = (() => {
  const normalize = value => String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/ł/g, 'l').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

  const columnNames = {
    name: ['tytul', 'title', 'nazwa', 'nazwa miejsca', 'name', 'place name', 'location name', 'miejsce', 'location', 'poi'],
    description: ['opis', 'description', 'notatka', 'note', 'notes', 'notatki', 'komentarz', 'comment', 'skomentuj', 'comments'],
    tags: ['tagi', 'tags', 'labels', 'etykiety'],
    address: ['adres', 'address', 'formatted address', 'full address', 'street address', 'adres miejsca'],
    url: ['url', 'link', 'link google maps', 'google maps link', 'google maps url', 'maps url', 'link do map google'],
    id: ['place id', 'placeid', 'google place id', 'google maps place id', 'google maps id', 'google id', 'feature id', 'ftid', 'cid', 'google cid', 'identyfikator miejsca', 'identyfikator google maps', 'data id'],
    lat: ['lat', 'latitude', 'szerokosc', 'szerokosc geograficzna', 'gps latitude', 'y'],
    lng: ['lng', 'lon', 'long', 'longitude', 'dlugosc', 'dlugosc geograficzna', 'gps longitude', 'x'],
    coordinates: ['wspolrzedne', 'wspolrzedne gps', 'coordinates', 'gps', 'lat lng', 'lat lon', 'location coordinates', 'wkt']
  };
  const headerFields = new Map(Object.entries(columnNames).flatMap(([field, aliases]) =>
    aliases.map(alias => [alias.replaceAll(' ', ''), field])));

  function parseRecords(text, delimiter) {
    const records = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (quoted) {
        if (char === '"' && text[i + 1] === '"') {
          field += '"';
          i++;
        } else if (char === '"') quoted = false;
        else field += char;
      } else if (char === '"' && field === '') {
        quoted = true;
      } else if (char === delimiter) {
        row.push(field);
        field = '';
      } else if (char === '\r' || char === '\n') {
        if (char === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        if (row.some(value => value.trim())) records.push(row);
        row = [];
        field = '';
      } else {
        field += char;
      }
    }
    if (quoted) throw new Error('Plik CSV zawiera niedomknięte pole w cudzysłowie.');
    row.push(field);
    if (row.some(value => value.trim())) records.push(row);
    return records;
  }

  function coordinates(lat, lng) {
    const number = value => {
      if (typeof value === 'number') return value;
      const text = String(value ?? '').trim().replace(',', '.');
      return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text) ? Number(text) : NaN;
    };
    lat = number(lat);
    lng = number(lng);
    return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  }

  function coordinatePair(value) {
    const point = /^POINT\s*\(\s*(\S+)\s+(\S+)\s*\)$/i.exec(value);
    if (point) return coordinates(point[2], point[1]);
    const parts = value.trim().split(/\s*[,;]\s*|\s+/);
    return parts.length === 2 ? coordinates(...parts) : null;
  }

  function googleMapsUrl(value) {
    try {
      const url = new URL(value);
      const host = url.hostname;
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      if (host === 'maps.app.goo.gl' || host === 'maps.goo.gl' || (host === 'goo.gl' && url.pathname.startsWith('/maps/'))) return url;
      if (/^(?:(?:www|maps)\.)?google\.(?:com(?:\.[a-z]{2})?|co\.[a-z]{2}|pl|de|fr|it|es|pt|nl|be|at|ch|cz|sk|hu|ro|gr|ca|ie|se|no|fi|dk|lt|lv|ee|ua|hr|si|bg|rs|jp|kr|in|au)$/.test(host) &&
          (host.startsWith('maps.') || /^\/maps(?:\/|$)/.test(url.pathname))) return url;
    } catch { /* Invalid URLs are not used as links. */ }
    return null;
  }

  function normalizePlaceId(value) {
    const pair = /^(0x[\da-f]+):(0x[\da-f]+)$/i.exec(value);
    if (/^(?:0x[\da-f]+|\d+)$/i.test(pair?.[2] || value)) {
      try { return 'cid:' + BigInt(pair?.[2] || value).toString(); }
      catch { return ''; }
    }
    return value ? 'google:' + value : '';
  }

  function parseMapLink(url) {
    if (!url) return {};
    let path = url.pathname;
    try { path = decodeURIComponent(path); } catch { /* Keep original path. */ }
    const data = path + ' ' + [...url.searchParams.values()].join(' ');
    const place = /!3d([+-]?[\d.]+)!4d([+-]?[\d.]+)/.exec(data);
    const pinpoint = (place && coordinates(place[1], place[2])) ||
      coordinatePair(url.searchParams.get('query') || url.searchParams.get('q') || '');
    const viewport = /@([+-]?[\d.]+),([+-]?[\d.]+)/.exec(data);
    const placeId = url.searchParams.get('query_place_id') ||
      /^place_id:(.+)$/.exec(url.searchParams.get('q') || '')?.[1] ||
      url.searchParams.get('cid') || url.searchParams.get('ftid') ||
      /!1s(0x[\da-f]+:0x[\da-f]+|ChI[\w-]+)/i.exec(data)?.[1] || '';
    const name = /\/place\/([^/]+)/.exec(path)?.[1]?.replaceAll('+', ' ') || '';
    return {
      pinpoint, viewport: viewport && coordinates(viewport[1], viewport[2]), placeId, name
    };
  }

  function mapsSourceUrl(placeId, name) {
    if (!placeId) return '';
    const normalized = normalizePlaceId(placeId);
    if (normalized.startsWith('cid:')) return 'https://www.google.com/maps?cid=' + normalized.slice(4);
    if (!/^[A-Za-z0-9_-]+$/.test(placeId)) return '';
    const params = new URLSearchParams({ api: '1', query: name || placeId, query_place_id: placeId });
    return 'https://www.google.com/maps/search/?' + params;
  }

  function parseCsvContent(content) {
    const text = content.replace(/^\uFEFF/, '');
    const formats = [];
    for (const delimiter of [',', ';']) {
      try {
        const [headers = [], ...records] = parseRecords(text, delimiter);
        const fields = headers.map(header => headerFields.get(normalize(header).replaceAll(' ', '')));
        const matchingRows = records.filter(row => row.length === headers.length).length;
        formats.push({ fields, records, score: fields.filter(Boolean).length * 4 + matchingRows / Math.max(records.length, 1) });
      } catch (error) {
        if (delimiter === ';' && !formats.length) throw error;
      }
    }
    const { fields, records } = formats.sort((a, b) => b.score - a.score)[0];
    if (!fields.some(field => field && !['description', 'tags'].includes(field))) {
      throw new Error('Nie rozpoznano nagłówków CSV. Użyj np. Nazwa, Adres, URL, Lat i Lng.');
    }
    return records.map((row, index) => {
      const values = (key) => row.flatMap((value, col) => fields[col] === key && value.trim() ? [value.trim()] : []);
      const first = (key) => values(key)[0] || '';
      const url = googleMapsUrl(first('url')) || row.map(googleMapsUrl).find(Boolean);
      const link = parseMapLink(url);
      const direct = coordinates(first('lat'), first('lng')) || coordinatePair(first('coordinates'));
      const pinpoint = direct || link.pinpoint;
      const placeId = link.placeId || first('id');
      const address = first('address');
      const name = first('name') || link.name || address;
      const sourceUrl = url?.href || mapsSourceUrl(placeId, name);
      return {
        pin: {
          nazwa: name || `Pinezka ${index + 1}`,
          opis: values('description').join('\n'),
          ...pinpoint,
          importSource: {
            address, url: sourceUrl, placeId, tags: values('tags').join(', '),
            coordinateSource: direct ? 'CSV' : pinpoint ? 'Google Maps URL' : ''
          }
        },
        queryName: name === address ? '' : name,
        candidates: link.viewport && !pinpoint ? [{ ...link.viewport, label: 'Środek widoku z linku Google Maps', provider: 'Google Maps URL' }] : [],
        state: pinpoint ? 'ready' : 'pending'
      };
    });
  }

  function customerId(placeId) {
    const key = normalizePlaceId(placeId || '');
    return key.startsWith('cid:') ? key.slice(4) : '';
  }

  async function resolveCustomerIds(entries, lookup, signal) {
    const pending = new Map();
    for (const entry of entries) {
      if (entry.state !== 'pending' || entry.duplicate) continue;
      const id = customerId(entry.pin.importSource.placeId);
      if (!id) continue;
      if (!pending.has(id)) pending.set(id, []);
      pending.get(id).push(entry);
    }
    const ids = [...pending.keys()];
    for (let i = 0; i < ids.length; i += 50) {
      signal.throwIfAborted();
      const batch = ids.slice(i, i + 50);
      const matches = await lookup(batch, signal);
      signal.throwIfAborted();
      for (const id of batch) {
        const candidates = (matches[id] || []).flatMap(item => {
          const point = coordinates(item.lat, item.lng);
          return point ? [{ ...point, label: 'Wikidata · ' + item.item, provider: 'Wikidata' }] : [];
        });
        for (const entry of pending.get(id)) {
          if (candidates.length === 1) {
            const { lat, lng } = candidates[0];
            Object.assign(entry.pin, { lat, lng });
            entry.pin.importSource.coordinateSource = 'Wikidata';
            entry.state = 'ready';
          } else {
            entry.candidates.unshift(...candidates);
          }
        }
      }
    }
  }

  function duplicateKeys(pin) {
    const keys = [];
    const placeId = normalizePlaceId(pin.importSource?.placeId || '');
    if (placeId) keys.push(placeId);
    const source = googleMapsUrl(pin.importSource?.url);
    if (source && !placeId) keys.push('url:' + source.href);
    const name = normalize(pin.nazwa);
    const point = coordinates(pin.lat, pin.lng);
    if (name && point) keys.push(`point:${name}:${point.lat.toFixed(5)},${point.lng.toFixed(5)}`);
    return keys;
  }


  // Browser-local import preview cache. Google Places coordinates expire within
  // 30 calendar days per Google Maps Platform terms; all other entries expire
  // sooner. Never persist errors or the Google Places full response.
  const CACHE_KEY = 'exploPinImportLookupCache.v1';
  const CACHE_TTL = 29 * 24 * 60 * 60 * 1000;
  const REVIEW_TTL = 7 * 24 * 60 * 60 * 1000;
  const CACHE_MAX = 600;
  const cacheKey = pin => {
    const source = pin.importSource || {};
    const url = googleMapsUrl(source.url);
    if (url) return 'url:' + url.href;
    const placeId = normalizePlaceId(source.placeId);
    if (placeId) return 'place:' + placeId;
    const name = normalize(pin.nazwa);
    const address = normalize(source.address);
    // Do not equate two unrelated places solely by a generic name.
    return name && address ? 'name-address:' + name + '|' + address : '';
  };
  function readImportCache() {
    try {
      const data = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
      const now = Date.now();
      let changed = false;
      for (const [key, record] of Object.entries(data)) {
        if (!record || !Number.isFinite(record.expires) || record.expires <= now || record.expires > now + CACHE_TTL) {
          delete data[key];
          changed = true;
        }
      }
      if (changed) localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      return data;
    } catch { return {}; }
  }
  function saveImportCache(entry) {
    const key = cacheKey(entry.pin);
    if (!key || entry.error || entry.duplicate || entry.imported || entry.state === 'pending') return false;
    const state = entry.state;
    if (!['ready', 'review', 'unresolved'].includes(state)) return false;
    const point = coordinates(entry.pin.lat, entry.pin.lng);
    if (state === 'ready' && !point) return false;
    const data = readImportCache();
    // Save only the minimum data needed to reproduce the same import preview.
    const candidates = state === 'review' ? (entry.candidates || []).slice(0, 8).flatMap(candidate => {
      const loc = coordinates(candidate.lat, candidate.lng);
      return loc ? [{ ...loc, label: candidate.label || '', name: candidate.name || '',
        provider: candidate.provider || '', confidence: candidate.confidence || 0,
        country: candidate.country || '', nameMatch: candidate.nameMatch || 0 }] : [];
    }) : [];
    const ttl = state === 'ready' ? CACHE_TTL : state === 'review' ? REVIEW_TTL : 24 * 60 * 60 * 1000;
    data[key] = {
      state, point: point || null, candidates,
      coordinateSource: entry.pin.importSource?.coordinateSource || '',
      country: entry.pin.kraj || '',
      expires: Date.now() + ttl
    };
    const keys = Object.keys(data);
    if (keys.length > CACHE_MAX) {
      keys.sort((a, b) => data[a].expires - data[b].expires);
      for (const old of keys.slice(0, keys.length - CACHE_MAX)) delete data[old];
    }
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); return true; }
    catch { return false; }
  }
  function restoreImportCache(entries) {
    const data = readImportCache();
    let hits = 0;
    for (const entry of entries) {
      if (entry.state !== 'pending' || entry.imported) continue;
      const record = data[cacheKey(entry.pin)];
      if (!record) continue;
      const point = record.point && coordinates(record.point.lat, record.point.lng);
      if (record.state === 'ready' && point) {
        Object.assign(entry.pin, point);
        entry.pin.importSource.coordinateSource = record.coordinateSource || 'Pamięć importu';
        if (record.country) entry.pin.kraj = record.country;
        entry.state = 'ready';
      } else if (record.state === 'review') {
        entry.candidates = Array.isArray(record.candidates) ? record.candidates.flatMap(item => {
          const loc = coordinates(item.lat, item.lng);
          return loc ? [{ ...item, ...loc }] : [];
        }) : [];
        entry.state = entry.candidates.length ? 'review' : 'unresolved';
      } else if (record.state === 'unresolved') {
        entry.state = 'unresolved';
      } else continue;
      entry.cached = true;
      hits++;
    }
    return hits;
  }
  function clearImportCache() {
    try { localStorage.removeItem(CACHE_KEY); return true; }
    catch { return false; }
  }
  function importCacheCount() { return Object.keys(readImportCache()).length; }

  function wait(delay, signal) {
    return new Promise((resolve, reject) => {
      signal.throwIfAborted();
      const onAbort = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, delay);
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  function createGeocoder(endpoint, getToken, { interval = 1100 } = {}) {
    // Keep provider suggestions in memory for this page session.
    const cache = new Map();
    let nextRequest = 0;
    const geocode = async (name, address, signal) => {
      if (!endpoint || (!name && !address)) return [];
      const key = JSON.stringify([name.trim().toLowerCase(), address.trim().toLowerCase()]);
      if (cache.has(key)) return cache.get(key);
      for (let attempt = 0; ; attempt++) {
        await wait(Math.max(0, nextRequest - Date.now()), signal);
        const token = await getToken();
        signal.throwIfAborted();
        nextRequest = Date.now() + interval;
        let response;
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
            body: JSON.stringify({ name, address }),
            signal: AbortSignal.any([signal, AbortSignal.timeout(12000)])
          });
        } catch (error) {
          if (signal.aborted || attempt === 2) throw error;
        }
        if (response?.ok) {
          const data = await response.json();
          const candidates = data.candidates.flatMap(item => {
            const point = coordinates(item.lat, item.lng);
            return point ? [{ ...item, ...point, provider: 'Geoapify' }] : [];
          });
          if (cache.size >= 2000) cache.delete(cache.keys().next().value);
          cache.set(key, candidates);
          return candidates;
        }
        const code = response?.status;
        if (attempt === 2 || (code && ![408, 429, 500, 502, 503, 504].includes(code))) {
          throw Object.assign(new Error('Geokodowanie niedostępne'), { status: code });
        }
        const retryAfter = response?.headers.get('Retry-After');
        const seconds = Number(retryAfter);
        const delay = retryAfter && Number.isFinite(seconds) ? seconds * 1000 :
          retryAfter ? Date.parse(retryAfter) - Date.now() : 0;
        await wait(Math.max(1500 * 2 ** attempt, delay || 0), signal);
      }
    };
    // Keep only a short-lived in-memory cache (not persistent Places storage).
    const googleCache = new Map();
    // 1250 ms = at most 48 Google lookups in any rolling minute, safely below
    // the configured 60/min quota. Cache hits do not consume a request slot.
    const googleInterval = 1250;
    let nextGoogleRequest = 0;
    let googleQueue = Promise.resolve();
    const google = (mapsUrl, signal) => {
      if (!endpoint || !mapsUrl) return Promise.resolve(null);
      if (googleCache.has(mapsUrl)) return Promise.resolve(googleCache.get(mapsUrl));
      // Serialize lookups so concurrent import operations cannot burst the API.
      const request = googleQueue.then(async () => {
        signal.throwIfAborted();
        if (googleCache.has(mapsUrl)) return googleCache.get(mapsUrl);
        await wait(Math.max(0, nextGoogleRequest - Date.now()), signal);
        signal.throwIfAborted();
        const token = await getToken();
        signal.throwIfAborted();
        nextGoogleRequest = Date.now() + googleInterval;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ mapsUrl }),
          signal: AbortSignal.any([signal, AbortSignal.timeout(25000)])
        });
        if (!response.ok) return null;
        const place = (await response.json()).place || null;
        if (googleCache.size >= 500) googleCache.delete(googleCache.keys().next().value);
        googleCache.set(mapsUrl, place);
        return place;
      });
      googleQueue = request.catch(() => {});
      return request;
    };
    const lookup = async (cids, signal) => {
      const token = await getToken();
      signal.throwIfAborted();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ cids }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(12000)])
      });
      if (!response.ok) throw Object.assign(new Error('Wyszukiwanie CID niedostępne'), { status: response.status });
      return (await response.json()).matches;
    };
    return { geocode, lookup, google };
  }

  // Geoapify's confidence measures geocoding certainty, not whether the
  // suggested POI is the place requested by the user.
  const genericWords = new Set(['z', 'ze', 'w', 'we', 'na', 'i', 'oraz', 'do', 'od', 'im', 'imienia', 'the', 'of']);
  function placeMatchScore(requested, candidate) {
    const tokens = value => normalize(value).split(' ')
      .filter(word => word.length > 2 && !genericWords.has(word));
    const query = [...new Set(tokens(requested))];
    const found = [...new Set(tokens(candidate))];
    if (!query.length || !found.length) return 0;
    const common = query.filter(word => found.includes(word)).length;
    const coverage = common / query.length;
    const precision = common / found.length;
    return coverage >= 0.5 && precision >= 0.5
      ? 2 * coverage * precision / (coverage + precision) : 0;
  }

  function rankCandidates(queryName, candidates) {
    const ranked = candidates.map(candidate => {
      const names = [candidate.name, (candidate.label || '').split(',')[0]].filter(Boolean);
      const match = Math.max(0, ...names.map(name => placeMatchScore(queryName, name)));
      return { ...candidate, nameMatch: match };
    }).sort((a, b) => b.nameMatch - a.nameMatch || (b.confidence || 0) - (a.confidence || 0));
    // A generic word such as "zabytkowa" does NOT identify a place.
    return ranked.filter(candidate => candidate.nameMatch >= 0.65);
  }

  async function resolveGoogleEntry(entry, google, signal) {
    if (entry.state !== 'pending' || !entry.pin.importSource?.url) return false;
    try {
      const item = await google(entry.pin.importSource.url, signal);
      if (!item) return false;
      const point = coordinates(item.lat, item.lng);
      if (!point) return false;
      // Place identity is sourced from this item's actual Google Maps URL,
      // not a name search. We only request location (Essentials SKU).
      // The original CSV name and URL are preserved.
      if (!/^[A-Za-z0-9_-]{5,}$/.test(item.placeId || '')) return false;
      Object.assign(entry.pin, point);
      entry.pin.importSource.coordinateSource = 'Google Places (Maps URL)';
      entry.state = 'ready';
      return true;
    } catch (error) {
      if (signal.aborted) throw error;
      return false;
    }
  }

  async function resolveEntry(entry, geocode, signal) {
    const { pin, queryName } = entry;
    const address = pin.importSource.address;
    try {
      const results = await geocode(queryName, address, signal);
      signal.throwIfAborted();
      const ranked = rankCandidates(queryName || address, results);
      const expected = normalize(queryName);
      const expectedAddress = normalize(address);
      // For Takeout exports the address is often missing. A strong, exact
      // place-name match can still be accepted, but only when unambiguous.
      const exact = ranked.filter(item => {
        if (item.confidence < 0.95 || !expected) return false;
        // Without an address, generic one-word names are unsafe to auto-place.
        if (!expectedAddress && expected.split(' ').filter(Boolean).length < 2) return false;
        const candidateName = normalize(item.name);
        const labelName = normalize((item.label || '').split(',')[0]);
        // Some Geoapify POIs use a shorter localized name or leave name empty.
        // Compare the complete first label segment, never a loose substring.
        const nameMatches = candidateName === expected || labelName === expected;
        return nameMatches && (!expectedAddress || normalize(item.label).includes(expectedAddress));
      });
      const competing = ranked.some(item => !exact.includes(item) &&
        item.confidence >= 0.9 &&
        (normalize(item.name) === expected || normalize((item.label || '').split(',')[0]) === expected));
      const hasWikidataCandidates = entry.candidates.some(item => item.provider === 'Wikidata');
      entry.candidates = [...ranked, ...entry.candidates];
      if (exact.length === 1 && !competing && !hasWikidataCandidates) {
        Object.assign(pin, coordinates(exact[0].lat, exact[0].lng));
        pin.importSource.coordinateSource = 'Geoapify';
        pin.kraj = exact[0].country || '';
        entry.state = 'ready';
      } else {
        entry.state = entry.candidates.length ? 'review' : 'unresolved';
      }
    } catch (error) {
      if (signal.aborted) throw error;
      entry.state = entry.candidates.length ? 'review' : 'unresolved';
      entry.error = true;
      if ([401, 403, 429].includes(error.status)) return error.status;
    }
    return 0;
  }

  return { parseCsvContent, createGeocoder, resolveEntry, resolveGoogleEntry, resolveCustomerIds, rankCandidates, coordinates, duplicateKeys, googleMapsUrl, restoreImportCache, saveImportCache, clearImportCache, importCacheCount };
})();
