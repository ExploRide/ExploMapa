async function lookupCustomerIds(cids, contact) {
  const query = `SELECT DISTINCT ?cid ?item ?point WHERE {
    VALUES ?cid { ${cids.map(cid => `"${cid}"`).join(' ')} }
    ?item wdt:P3749 ?cid; wdt:P625 ?point.
  }`;
  const url = new URL('https://query.wikidata.org/sparql');
  url.search = new URLSearchParams({ query, format: 'json' }).toString();
  const response = await fetch(url, {
    headers: { 'User-Agent': contact, Accept: 'application/sparql-results+json' },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error('Wikidata lookup failed');
  const { results } = await response.json();
  const matches = Object.create(null);
  for (const row of results.bindings) {
    const id = row.cid.value;
    const point = /^Point\(([+-]?[\d.]+) ([+-]?[\d.]+)\)$/.exec(row.point.value);
    if (point && cids.includes(id)) {
      (matches[id] ??= []).push({ item: row.item.value.split('/').at(-1), lat: Number(point[2]), lng: Number(point[1]) });
    }
  }
  return matches;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (origin !== env.APP_ORIGIN) return new Response(null, { status: 403 });

    const headers = {
      'Access-Control-Allow-Origin': env.APP_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Expose-Headers': 'Retry-After',
      'Cache-Control': 'no-store',
      Vary: 'Origin'
    };
    const respond = (status, body, retryAfter) => Response.json(body, {
      status,
      headers: retryAfter ? { ...headers, 'Retry-After': retryAfter } : headers
    });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return respond(405, {});
    if (!env.GEOAPIFY_KEY || !env.FIREBASE_API_KEY || !env.ALLOWED_UIDS) return respond(503, {});
    const token = /^Bearer ([\w.-]{1,4096})$/.exec(request.headers.get('Authorization') || '')?.[1];
    if (!token) return respond(401, {});

    try {
      const authUrl = new URL('https://identitytoolkit.googleapis.com/v1/accounts:lookup');
      authUrl.searchParams.set('key', env.FIREBASE_API_KEY);
      const auth = await fetch(authUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
        signal: AbortSignal.timeout(5000)
      });
      if (!auth.ok) return respond([400, 401, 403].includes(auth.status) ? 401 : 503, {});
      const { users } = await auth.json();
      const uid = users?.[0]?.localId;
      if (!uid || !env.ALLOWED_UIDS.split(',').map(value => value.trim()).includes(uid)) return respond(403, {});

      let payload;
      try {
        payload = await request.json();
      } catch {
        return respond(400, {});
      }
      if (!payload || typeof payload !== 'object') return respond(400, {});
      const { cids, name, address } = payload;
      if (cids !== undefined) {
        if (!Array.isArray(cids) || !cids.length || cids.length > 50 ||
            !cids.every(cid => typeof cid === 'string' && /^\d{1,20}$/.test(cid))) return respond(400, {});
        const { success } = await env.IMPORT_RATE_LIMIT.limit({ key: 'wikidata' });
        if (!success) return respond(429, {}, '60');
        return respond(200, { matches: await lookupCustomerIds(cids, env.WIKIDATA_USER_AGENT) });
      }
      if (typeof name !== 'string' || typeof address !== 'string') return respond(400, {});
      const query = [name.trim(), address.trim()].filter(Boolean).join(', ');
      if (!query || query.length > 500) return respond(400, {});
      const { success } = await env.IMPORT_RATE_LIMIT.limit({ key: 'geoapify' });
      if (!success) return respond(429, {}, '60');

      const url = new URL('https://api.geoapify.com/v1/geocode/search');
      url.search = new URLSearchParams({
        text: query, limit: '5', format: 'json', lang: 'pl',
        bias: 'countrycode:none', apiKey: env.GEOAPIFY_KEY
      }).toString();
      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (response.status === 429) return respond(429, {}, response.headers.get('Retry-After') || '60');
      if (response.status === 401 || response.status === 403) return respond(403, {});
      if (!response.ok) return respond(502, {});
      const { results } = await response.json();
      return respond(200, {
        candidates: results.map(result => ({
          lat: result.lat,
          lng: result.lon,
          name: result.name || '',
          label: result.formatted || result.name || '',
          confidence: result.rank?.confidence || 0,
          country: result.country || ''
        }))
      });
    } catch {
      return respond(503, {});
    }
  }
};
