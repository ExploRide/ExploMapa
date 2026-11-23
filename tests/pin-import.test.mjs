import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import worker from '../geocoding/worker.mjs';

const script = await readFile(new URL('../pin-import.js', import.meta.url), 'utf8');
const loadImporter = (fetch = globalThis.fetch, timer = setTimeout) => {
  const window = {};
  runInNewContext(script, { window, URL, URLSearchParams, fetch, AbortSignal, setTimeout: timer, clearTimeout });
  return window.pinImport;
};
const importer = loadImporter();
const points = entries => JSON.parse(JSON.stringify(entries.map(({ pin }) => [pin.lat, pin.lng])));

test('parses UTF-8, BOM, semicolon, coordinates with decimal commas and quoted newlines', () => {
  const entries = importer.parseCsvContent(
    '\uFEFFDługość geograficzna;Tytuł;Latitude;Notatka;Adres\r\n' +
    '"21,10";"Pałac 🏰";"52,20";"tekst, ""cytat""\r\njeszcze";"Główna 2, Lublin"'
  );
  assert.deepEqual(points(entries), [[52.2, 21.1]]);
  assert.equal(entries[0].pin.nazwa, 'Pałac 🏰');
  assert.equal(entries[0].pin.opis, 'tekst, "cytat"\r\njeszcze');
  assert.equal(entries[0].pin.importSource.address, 'Główna 2, Lublin');
});

test('distinguishes precise GPS, viewport, Takeout CID and invalid coordinates', () => {
  const entries = importer.parseCsvContent([
    'Title,URL,Latitude,Longitude',
    'Exact,"https://www.google.com/maps/place/Exact/@10,20",90,90',
    'First,https://www.google.com/maps/place/First/@10%2C20/data=!3d51.1!4d22.3,,',
    'Second,https://www.google.com/maps/search/?query=51.3%2C22.5,,',
    'Viewport,https://www.google.com/maps/@50%2C21%2C12z,,',
    'Takeout,https://www.google.com/maps/place/Takeout/data=!4m2!3m1!1s0x4722576a7c8212a9:0xd981d34e6e914c7c,,',
    'Invalid,,92,21', ',,,'
  ].join('\n'));
  assert.deepEqual(points(entries.slice(0, 3)), [[90, 90], [51.1, 22.3], [51.3, 22.5]]);
  assert.equal(entries[3].state, 'pending');
  assert.equal(entries[3].candidates[0].lat, 50);
  assert.match(importer.duplicateKeys(entries[4].pin)[0], /^cid:\d{20}$/);
  assert.equal(entries[5].state, 'pending');
  assert.equal(entries.length, 6);
  const [idOnly] = importer.parseCsvContent('Name,Google Place ID\nExample,ChIJ123');
  assert.equal(new URL(idOnly.pin.importSource.url).searchParams.get('query_place_id'), 'ChIJ123');
  assert.equal(importer.googleMapsUrl('https://www.google.zip/maps'), null);
});

test('matches known coordinates and equivalent hexadecimal / decimal customer IDs', () => {
  const [first, second] = importer.parseCsvContent('Name,CID,Lat,Lng\nŁąka,0x1:0x2a,51,22\nLaka,42,51.000001,22');
  assert.deepEqual(importer.duplicateKeys(first.pin), importer.duplicateKeys(second.pin));
});

test('keeps one thousand locations in file order', () => {
  const rows = Array.from({ length: 1000 }, (_, index) => `Miejsce ${index},52.1,21.2`);
  const entries = importer.parseCsvContent('Name,Latitude,Longitude\n' + rows.join('\n'));
  assert.equal(entries.length, 1000);
  assert.equal(entries.at(-1).pin.nazwa, 'Miejsce 999');
  assert.ok(entries.every(entry => entry.state === 'ready'));
});

test('batches CID resolution and preserves ambiguous matches for review', async () => {
  const entries = importer.parseCsvContent('Name,CID\n' + Array.from({ length: 106 }, (_, i) => `Miejsce ${i},${i + 1}`).join('\n'));
  const requests = [];
  await importer.resolveCustomerIds(entries, async cids => {
    requests.push(cids.length);
    return {
      1: [{ lat: 53, lng: 23, item: 'Q1' }],
      2: [{ lat: 53, lng: 23, item: 'Q2' }, { lat: 52, lng: 22, item: 'Q3' }]
    };
  }, new AbortController().signal);
  assert.deepEqual(requests, [50, 50, 6]);
  assert.equal(entries[0].state, 'ready');
  assert.equal(entries[1].state, 'pending');
  assert.equal(entries[1].candidates.length, 2);
});

test('retries rate limits, caches results, requires review for name-only and handles no results', async () => {
  let requests = 0;
  const api = loadImporter(async () => ++requests === 1
    ? new Response(null, { status: 429, headers: { 'Retry-After': '1' } })
    : Response.json({ candidates: [{ name: 'Pałac', label: 'Pałac, Główna 2', lat: 52, lng: 22, confidence: 1 }] }),
    callback => setTimeout(callback, 0));
  const { geocode } = api.createGeocoder('https://example.com', async () => 'token', { interval: 0 });
  const signal = new AbortController().signal;
  const [address, same, uncertain, missing] = api.parseCsvContent('Name,Address\nPałac,Główna 2\nPałac,Główna 2\nPałac,\nBrak,');
  await api.resolveEntry(address, geocode, signal);
  await api.resolveEntry(same, geocode, signal);
  assert.equal(address.state, 'ready');
  assert.equal(same.state, 'ready');
  assert.equal(requests, 2);
  await api.resolveEntry(uncertain, geocode, signal);
  assert.equal(uncertain.state, 'review');
  await api.resolveEntry(missing, async () => [], signal);
  assert.equal(missing.state, 'unresolved');
});

test('accepts only unambiguous high-confidence name matches without a CSV address', async () => {
  const signal = new AbortController().signal;
  const [safe, low, ambiguous, different] = importer.parseCsvContent(
    'Name\nMuzeum Józefa Czechowicza\nPałac\nMuzeum\nMuzeum Zabawek'
  );
  await importer.resolveEntry(safe, async () => [{
    name: 'Muzeum Józefa Czechowicza', label: 'Muzeum Józefa Czechowicza, Lublin, Polska',
    confidence: 0.99, lat: 51.25, lng: 22.57
  }], signal);
  assert.equal(safe.state, 'ready');
  assert.deepEqual(points([safe]), [[51.25, 22.57]]);
  await importer.resolveEntry(low, async () => [{
    name: 'Pałac', label: 'Pałac, Polska', confidence: 0.87, lat: 51, lng: 22
  }], signal);
  assert.equal(low.state, 'review');
  await importer.resolveEntry(ambiguous, async () => [
    { name: 'Muzeum', label: 'Muzeum, Lublin', confidence: 0.99, lat: 51, lng: 22 },
    { name: 'Muzeum', label: 'Muzeum, Warszawa', confidence: 0.92, lat: 52, lng: 21 }
  ], signal);
  assert.equal(ambiguous.state, 'review');
  await importer.resolveEntry(different, async () => [{
    name: 'Muzeum Narodowe', label: 'Muzeum Narodowe, Warszawa',
    confidence: 0.99, lat: 52, lng: 21
  }], signal);
  assert.equal(different.state, 'review');
});

test('rejects unrelated Geoapify place despite high geocoder confidence', async () => {
  const [entry] = importer.parseCsvContent('Name\nZabytkowa lokomotywownia z halą wachlarzową');
  await importer.resolveEntry(entry, async () => [{
    name: 'Zabytkowa dzwonnica z 1871r.', label: 'Zabytkowa dzwonnica z 1871r., Cyców, Polska',
    confidence: 0.99, lat: 51.3031481, lng: 23.1357546
  }], new AbortController().signal);
  assert.equal(entry.state, 'unresolved');
  assert.equal(entry.candidates.length, 0);
  assert.equal(entry.pin.lat, undefined);
});

test('keeps matching location and rejects a wrong competing result', async () => {
  const [entry] = importer.parseCsvContent('Name\nMuzeum Józefa Czechowicza');
  await importer.resolveEntry(entry, async () => [
    { name: 'Zabytkowa dzwonnica', label: 'Zabytkowa dzwonnica, Cyców', confidence: 1, lat: 51.3, lng: 23.1 },
    { name: 'Muzeum Józefa Czechowicza', label: 'Muzeum Józefa Czechowicza, Lublin',
      confidence: 0.99, lat: 51.25, lng: 22.57 }
  ], new AbortController().signal);
  assert.equal(entry.state, 'ready');
  assert.deepEqual(points([entry]), [[51.25, 22.57]]);
});

test('resolves an exact Google Maps place without Pro-priced name fields', async () => {
  const [entry] = importer.parseCsvContent(
    'Name,URL\nZabytkowa lokomotywownia z halą wachlarzową,https://www.google.com/maps/place/Test'
  );
  const resolved = await importer.resolveGoogleEntry(entry, async () => ({
    lat: 51.2293462, lng: 22.5657447, placeId: 'ChIJj61dQgK6j4AR4GeTYWZsKWw'
  }), new AbortController().signal);
  assert.equal(resolved, true);
  assert.equal(entry.state, 'ready');
  assert.equal(entry.pin.importSource.coordinateSource, 'Google Places (Maps URL)');
  assert.deepEqual(points([entry]), [[51.2293462, 22.5657447]]);
});

test('reports exhausted quota and aborts an active request', async () => {
  let requests = 0;
  const api = loadImporter(async () => {
    requests++;
    return new Response(null, { status: 429 });
  }, callback => setTimeout(callback, 0));
  const { geocode } = api.createGeocoder('https://example.com', async () => 'token', { interval: 0 });
  const [entry] = api.parseCsvContent('Name\nPałac');
  assert.equal(await api.resolveEntry(entry, geocode, new AbortController().signal), 429);
  assert.equal(entry.error, true);
  assert.equal(requests, 3);

  const controller = new AbortController();
  const interrupted = loadImporter(async (_url, options) => {
    controller.abort();
    options.signal.throwIfAborted();
  }).createGeocoder('https://example.com', async () => 'token');
  await assert.rejects(interrupted.geocode('Pałac', '', controller.signal), { name: 'AbortError' });
});

test('reads the supplied Takeout export when PIN_IMPORT_TEST_CSV is set', {
  skip: !process.env.PIN_IMPORT_TEST_CSV
}, async () => {
  const entries = importer.parseCsvContent(await readFile(process.env.PIN_IMPORT_TEST_CSV, 'utf8'));
  assert.equal(entries.length, 106);
  assert.equal(entries.filter(entry => entry.state === 'pending').length, 106);
  assert.ok(entries.every(entry => entry.pin.importSource.placeId && entry.pin.importSource.url));
  assert.equal(entries[0].pin.nazwa, 'Muzeum Józefa Czechowicza');
});

test('worker checks the origin, UID, input and request quota before geocoding', async t => {
  const origin = 'https://exploride.github.io';
  let allowed = true;
  let quota = true;
  let upstream = 0;
  const env = {
    APP_ORIGIN: origin,
    ALLOWED_UIDS: 'editor',
    GEOAPIFY_KEY: 'geocoder-test-key',
    FIREBASE_API_KEY: 'auth-test-key',
    WIKIDATA_USER_AGENT: 'ExploMapa tests',
    IMPORT_RATE_LIMIT: { limit: async () => ({ success: quota }) }
  };
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.hostname === 'identitytoolkit.googleapis.com') {
      return Response.json({ users: [{ localId: allowed ? 'editor' : 'other' }] });
    }
    upstream++;
    if (url.hostname === 'query.wikidata.org') {
      assert.match(url.searchParams.get('query'), /"42"/);
      return Response.json({ results: { bindings: [
        { cid: { value: '42' }, item: { value: 'http://www.wikidata.org/entity/Q42' }, point: { value: 'Point(21 52)' } }
      ] } });
    }
    assert.equal(url.searchParams.get('text'), 'Pałac, Lublin');
    return Response.json({ results: [{ lat: 52, lon: 21, name: 'Pałac', formatted: 'Lublin', rank: { confidence: 1 } }] });
  });
  const request = (payload, options = {}) => worker.fetch(new Request('https://import.example.com', {
    method: 'POST', headers: { Origin: origin, Authorization: 'Bearer a.b.c', ...options },
    body: JSON.stringify(payload)
  }), env);
  assert.equal((await request({}, { Origin: 'https://elsewhere.example.com' })).status, 403);
  assert.equal((await request({}, { Authorization: '' })).status, 401);
  allowed = false;
  assert.equal((await request({ name: 'Pałac', address: 'Lublin' })).status, 403);
  allowed = true;
  assert.equal((await request({ cids: ['invalid'] })).status, 400);
  quota = false;
  const limited = await request({ name: 'Pałac', address: 'Lublin' });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
  assert.equal(upstream, 0);
  quota = true;
  const cid = await request({ cids: ['42'] });
  assert.deepEqual((await cid.json()).matches['42'][0], { item: 'Q42', lat: 52, lng: 21 });
  const address = await request({ name: 'Pałac', address: 'Lublin' });
  assert.equal((await address.json()).candidates[0].lng, 21);
  assert.equal(upstream, 2);
});
