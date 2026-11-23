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
    return { geocode, lookup };
  }

  async function resolveEntry(entry, geocode, signal) {
    const { pin, queryName } = entry;
    const address = pin.importSource.address;
    try {
      const results = await geocode(queryName, address, signal);
      signal.throwIfAborted();
      const expected = normalize(queryName);
      const expectedAddress = normalize(address);
      const exact = results.filter(item => item.confidence >= 0.95 &&
        (!expected || normalize(item.name) === expected) && expectedAddress &&
        normalize(item.label).includes(expectedAddress));
      entry.candidates = [...results, ...entry.candidates];
      if (exact.length === 1 && results.length === 1 && !entry.candidates.some(item => item.provider === 'Wikidata')) {
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

  return { parseCsvContent, createGeocoder, resolveEntry, resolveCustomerIds, coordinates, duplicateKeys, googleMapsUrl };
})();
