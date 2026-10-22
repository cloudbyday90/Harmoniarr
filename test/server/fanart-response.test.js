/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { inspect } from 'node:util';
import { createFanartTvClient } from '../../src/server/integrations/fanart-tv/fanart-client.js';
import { createArtworkFetchService } from '../../src/server/artwork/artwork-fetch-service.js';

const secret = 'PUBLIC-TEST-ONLY-fanart-private';
const artist = { artistthumb: [{ id: 'chosen', url: 'https://assets.fanart.tv/fixture.jpg', lang: '', likes: '5' }] };
const expected = [{ imageType: 'artistthumb', id: 'chosen', url: 'https://assets.fanart.tv/fixture.jpg', likes: 5 }];
const client = options => createFanartTvClient({ maxRetries: 1, requestTimeoutMs: 1000,
  sleepImpl: async () => {}, resolveApiKey: async () => secret, resolveClientKey: async () => secret, ...options });
const get = service => service.fetchArtistImages({ mbid: 'fixture' });
const turn = () => new Promise(resolve => { setImmediate(resolve); });
function padded(bytes, payload = artist) {
  const value = { ...payload, padding: '' };
  value.padding = 'x'.repeat(bytes - Buffer.byteLength(JSON.stringify(value)));
  const body = JSON.stringify(value); assert.equal(Buffer.byteLength(body), bytes); return body;
}
function safe(error, kind = 'response_invalid', status = null) {
  assert.equal(error.diagnosticCode, kind); assert.equal(error.details.status, status);
  assert.equal(inspect(error, { depth: 8 }).includes(secret), false);
  for (const key of ['url', 'cause', 'headers', 'body']) assert.equal(Object.hasOwn(error.details, key), false);
  assert.equal(Object.hasOwn(error, 'cause'), false); return true;
}

for (const [method, path] of [['fetchArtistImages', 'music'], ['fetchAlbumImages', 'music/albums']]) {
  test(`Fanart.tv ${method} accepts exactly 2 MB and preserves header credentials and paths`, async () => {
    const payload = path === 'music' ? artist : { albumcover: artist.artistthumb };
    const service = client({ fetchImpl: async (url, options) => {
      assert.equal(url.toString(), `https://webservice.fanart.tv/v3.2/${path}/fixture`);
      assert.deepEqual(options.headers, { Accept: 'application/json', 'api-key': secret, 'client-key': secret });
      assert.equal(options.redirect, 'error'); return new Response(padded(2_000_000, payload));
    } });
    assert.deepEqual(await service[method]({ mbid: 'fixture' }), [{ ...expected[0], imageType: path === 'music' ? 'artistthumb' : 'albumcover' }]);
  });
  test(`Fanart.tv ${method} cancels one decoded byte above the ceiling without retry`, async t => {
    let cancelled = false;
    const fetchImpl = t.mock.fn(async () => new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode(padded(2_000_001)));
    }, cancel() { cancelled = true; } })));
    await assert.rejects(client({ fetchImpl })[method]({ mbid: 'fixture' }), error => safe(error));
    assert.equal(cancelled, true); assert.equal(fetchImpl.mock.callCount(), 1);
  });
}

test('Fanart.tv counts UTF-8 bytes rather than characters and refuses declared oversize before reading', async () => {
  const body = JSON.stringify({ value: 'é'.repeat(1_000_000) }); assert.ok(body.length < 2_000_000);
  await assert.rejects(get(client({ fetchImpl: async () => new Response(body) })), safe);
  let cancelled = false;
  await assert.rejects(get(client({ fetchImpl: async () => new Response(new ReadableStream({
    cancel() { cancelled = true; },
  }), { headers: { 'content-length': '2000001' } }) })), safe);
  assert.equal(cancelled, true);
});

test('Fanart.tv body parsing failures are terminal private errors rather than empty artwork results', async t => {
  for (const body of [`{"private":"${secret}`, Buffer.from([123, 34, 120, 34, 58, 34, 255, 34, 125]), '[]', 'null', '1', null]) {
    const fetchImpl = t.mock.fn(async () => new Response(body));
    await assert.rejects(get(client({ fetchImpl })), error => safe(error)); assert.equal(fetchImpl.mock.callCount(), 1);
  }
});

test('Fanart.tv awaits 404 body cancellation before publishing empty artwork', async () => {
  let release; let completed = false;
  const gate = new Promise(resolve => { release = resolve; });
  const service = client({ fetchImpl: async () => new Response(new ReadableStream({ cancel() { return gate; } }), { status: 404 }) });
  const request = get(service).then(value => { completed = true; return value; });
  await turn(); assert.equal(completed, false); release(); assert.deepEqual(await request, []);
});

test('Fanart.tv awaits ignored HTTP body retirement before retry and resolves credentials once per logical request', async t => {
  for (const status of [429, 503, 500]) {
    let release; let retired = false; let calls = 0;
    const gate = new Promise(resolve => { release = resolve; });
    const resolveApiKey = t.mock.fn(async () => secret); const resolveClientKey = t.mock.fn(async () => secret);
    const sleepImpl = t.mock.fn(async delay => { assert.equal(retired, true); assert.equal(delay, 3000); });
    const service = client({ resolveApiKey, resolveClientKey, sleepImpl, fetchImpl: async () => {
      calls++; if (calls > 1) { assert.equal(retired, true); return new Response(JSON.stringify(artist)); }
      return new Response(new ReadableStream({ cancel() { return gate.then(() => { retired = true; }); } }),
        { status, headers: { 'retry-after': '3' } });
    } });
    const request = get(service); await turn(); assert.equal(calls, 1); assert.equal(sleepImpl.mock.callCount(), 0);
    release(); assert.deepEqual(await request, expected); assert.equal(calls, 2);
    assert.equal(resolveApiKey.mock.callCount(), 1); assert.equal(resolveClientKey.mock.callCount(), 1);
  }
});

test('Fanart.tv retains HTTP-date Retry-After and ignores an invalid value in favor of backoff', async () => {
  for (const retryAfter of [new Date(Date.now() + 60000).toUTCString(), 'invalid']) {
    let calls = 0; const delays = [];
    const service = client({ fetchImpl: async () => ++calls === 1
      ? new Response(secret, { status: 429, headers: { 'retry-after': retryAfter } }) : new Response('{}'),
    sleepImpl: async delay => { delays.push(delay); } });
    assert.deepEqual(await get(service), []); assert.equal(calls, 2); assert.equal(delays.length, 1);
    if (retryAfter === 'invalid') assert.ok(delays[0] >= 2000 && delays[0] < 2250);
    else assert.ok(delays[0] > 50000 && delays[0] <= 60000);
  }
});

test('Fanart.tv cleanup failure retains known HTTP classification and bounded retry exhaustion', async t => {
  for (const status of [400, 401, 403, 429, 500, 503]) {
    const fetchImpl = t.mock.fn(async () => new Response(new ReadableStream({ cancel() { throw new Error(secret); } }), { status }));
    await assert.rejects(get(client({ fetchImpl })), error => {
      safe(error, status >= 500 || status === 429 ? 'unavailable' : 'request_rejected', status);
      assert.equal(error.details.attempts, status >= 500 || status === 429 ? 2 : 1); return true;
    });
    assert.equal(fetchImpl.mock.callCount(), status >= 500 || status === 429 ? 2 : 1);
  }
});

test('Fanart.tv transport failure is retried without retaining credential headers, URL or native cause', async t => {
  const fetchImpl = t.mock.fn(async (url, options) => { throw Object.assign(new Error(secret), { url, headers: options.headers }); });
  await assert.rejects(get(client({ fetchImpl })), error => safe(error, 'unavailable'));
  assert.equal(fetchImpl.mock.callCount(), 2);
});

test('Fanart.tv credential resolver failures are private and dispatch no request', async t => {
  for (const resolver of ['resolveApiKey', 'resolveClientKey']) {
    const fetchImpl = t.mock.fn();
    await assert.rejects(get(client({ fetchImpl, [resolver]: async () => { throw new Error(secret); } })), error => {
      safe(error, 'credentials_unavailable'); assert.equal(error.details.attempts, 0); assert.equal(error.details.retryable, false); return true;
    });
    assert.equal(fetchImpl.mock.callCount(), 0);
  }
});

test('Fanart.tv configuration failures do not retain rejected values and invalid retry counts refuse before dispatch', () => {
  for (const options of [{ baseUrl: `https://user:${secret}@webservice.fanart.tv` }, { baseUrl: secret },
    { requestTimeoutMs: secret }, { requestTimeoutMs: 2_147_483_648 }, ...[secret, NaN, Infinity, 1.5].map(maxRetries => ({ maxRetries }))]) {
    assert.throws(() => client(options), error => error.code === 'fanarttv_misconfigured' && !inspect(error).includes(secret));
  }
});

test('Fanart.tv defers automatic retries beyond the timer range instead of scheduling them early', async t => {
  for (const retryAfter of ['2147484', '9'.repeat(400), 'Thu, 01 Jan 2099 00:00:00 GMT']) {
    const fetchImpl = t.mock.fn(async () => new Response(secret, { status: 429, headers: { 'retry-after': retryAfter } }));
    const sleepImpl = t.mock.fn(async () => {});
    await assert.rejects(get(client({ fetchImpl, sleepImpl })), error => safe(error, 'retry_deferred', 429));
    assert.equal(fetchImpl.mock.callCount(), 1); assert.equal(sleepImpl.mock.callCount(), 0);
  }
});

test('Fanart.tv preserves finite retry clamping and the existing maximum of ten retries', async t => {
  for (const [maxRetries, count] of [[-1, 1], [99, 11]]) {
    const fetchImpl = t.mock.fn(async () => { throw new Error(secret); });
    await assert.rejects(get(client({ fetchImpl, maxRetries })), error => safe(error, 'unavailable'));
    assert.equal(fetchImpl.mock.callCount(), count);
  }
});

test('Fanart.tv applies one deadline through stalled headers or an active body read and remains usable afterward', { timeout: 5000 }, async t => {
  for (const phase of ['headers', 'body']) {
    let calls = 0; let cancelled = false;
    const fetchImpl = t.mock.fn(async () => {
      calls++; if (calls > 1) return new Response(JSON.stringify(artist));
      return phase === 'headers' ? new Promise(() => {}) : new Response(new ReadableStream({ cancel() { cancelled = true; } }));
    });
    const service = client({ fetchImpl, maxRetries: 0, requestTimeoutMs: 40 });
    const keeper = setTimeout(() => {}, 2000);
    try { await assert.rejects(get(service), error => safe(error, 'timeout')); } finally { clearTimeout(keeper); }
    if (phase === 'body') assert.equal(cancelled, true);
    assert.equal(calls, 1); assert.deepEqual(await get(service), expected);
  }
});

test('actual artwork consumer refuses malformed metadata before download or ingestion and preserves 404-empty behavior', async t => {
  let valid = false; let absent = false;
  const downloadImageFn = t.mock.fn(async () => Buffer.from('fixture image'));
  const ingestArtworkBuffer = t.mock.fn(async () => ({ asset: { id: 'fixture-asset' } }));
  const assignPreferredArtwork = t.mock.fn(async () => {});
  const service = createArtworkFetchService({ artworkPolicyService: { getArtworkRuntimePolicy: async () => ({ fetch: { enabled: true } }) },
    listArtworkAssignmentsFn: async () => [], downloadImageFn, artworkIngestionService: { ingestArtworkBuffer },
    artworkAssignmentService: { assignPreferredArtwork }, fanartTvClient: client({ fetchImpl: async () => absent
      ? new Response(null, { status: 404 }) : new Response(valid ? JSON.stringify(artist) : `{"private":"${secret}`) }) });
  const input = { ownerId: 'fixture', ownerType: 'musicbrainz_artist', artworkRole: 'artist_thumbnail' };
  await assert.rejects(service.resolveArtwork(input), error => safe(error));
  assert.equal(downloadImageFn.mock.callCount(), 0); assert.equal(ingestArtworkBuffer.mock.callCount(), 0);
  absent = true; assert.equal((await service.resolveArtwork(input)).assetId, null);
  assert.equal(downloadImageFn.mock.callCount(), 0);
  absent = false; valid = true;
  assert.equal((await service.resolveArtwork(input)).assetId, 'fixture-asset');
  assert.equal(downloadImageFn.mock.callCount(), 1); assert.equal(ingestArtworkBuffer.mock.callCount(), 1);
  assert.equal(assignPreferredArtwork.mock.callCount(), 1);
  assert.equal(assignPreferredArtwork.mock.calls[0].arguments[0].ownerId, input.ownerId);
});
