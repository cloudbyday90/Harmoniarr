/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { inspect } from 'node:util';
import { createMusicBrainzClient } from '../../src/server/integrations/musicbrainz/musicbrainz-client.js';
import { readBoundedJsonResponse } from '../../src/server/integrations/providers/provider-json-response.js';
import { largeMusicBrainzRelease } from '../../testing/server/musicbrainz-response-fixtures.js';
import { createMusicBrainzCatalogService } from '../../src/server/metadata/musicbrainz-catalog-service.js';
import { createProviderHealthRecorder } from '../../src/server/dependency-health-service.js';
import { createMusicBrainzImportService } from '../../src/server/metadata/musicbrainz-import-service.js';

const secret = 'PUBLIC-TEST-ONLY-private-query';
const client = options => createMusicBrainzClient({ maxRetries: 1, requestTimeoutMs: 1000,
  sleepImpl: async () => {}, ...options });
const operations = [
  ['lookupArtist', { artistId: 'fixture' }, 2_000_000, '/artist/fixture', { inc: 'aliases' }],
  ['lookupArtistRelations', { artistId: 'fixture' }, 4_000_000, '/artist/fixture', { inc: 'artist-rels+genres+tags' }],
  ['lookupRelease', { releaseId: 'fixture' }, 8_000_000, '/release/fixture', { inc: 'artist-credits+recordings+release-groups+media' }],
  ['lookupReleaseGroup', { releaseGroupId: 'fixture' }, 4_000_000, '/release-group/fixture', { inc: 'artist-credits+releases' }],
  ['searchArtists', { query: secret, limit: 100, offset: 3, dismax: true }, 2_000_000, '/artist', { query: secret, limit: '100', offset: '3', dismax: 'true' }],
  ['searchReleases', { query: secret, limit: 100, offset: 3 }, 4_000_000, '/release', { query: secret, limit: '100', offset: '3' }],
  ['browseArtistReleaseGroups', { artistId: 'fixture', limit: 100, offset: 7 }, 2_000_000, '/release-group',
    { artist: 'fixture', limit: '100', offset: '7', 'release-group-status': 'website-default', inc: 'artist-credits' }],
  ['browseReleaseGroupReleases', { releaseGroupId: 'fixture', limit: 100, offset: 7 }, 8_000_000, '/release',
    { 'release-group': 'fixture', limit: '100', offset: '7', inc: 'artist-credits+media' }],
];

function assertPrivate(error, code = 'musicbrainz_invalid_response') {
  assert.equal(error.code, code);
  assert.equal(inspect(error, { depth: 8 }).includes(secret), false);
  assert.equal(Object.hasOwn(error.details, 'url'), false);
  assert.equal(Object.hasOwn(error.details, 'cause'), false);
  assert.equal(Object.hasOwn(error, 'cause'), false);
  return true;
}

for (const [method, input, cap, pathname, query] of operations) {
  test(`MusicBrainz ${method} keeps parameters and accepts its exact decoded ceiling`, async () => {
    const body = JSON.stringify({ value: 'x'.repeat(cap - 12) });
    assert.equal(Buffer.byteLength(body), cap);
    const service = client({ fetchImpl: async (url, options) => {
      assert.equal(url.pathname, `/ws/2${pathname}`);
      assert.deepEqual(Object.fromEntries(url.searchParams), { fmt: 'json', ...query });
      assert.equal(options.redirect, 'error');
      return new Response(body);
    } });
    assert.equal((await service[method](input)).value.length, cap - 12);
  });
  test(`MusicBrainz ${method} refuses one decoded byte above its ceiling without retry`, async t => {
    let cancelled = false;
    const fetchImpl = t.mock.fn(async () => new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode(JSON.stringify({ value: 'x'.repeat(cap - 11) })));
    }, cancel() { cancelled = true; } })));
    await assert.rejects(client({ fetchImpl })[method](input), error => assertPrivate(error));
    assert.equal(fetchImpl.mock.callCount(), 1); assert.equal(cancelled, true);
  });
}

test('MusicBrainz preserves a complete 3000-track release and short browse-page metadata', async () => {
  const release = largeMusicBrainzRelease();
  assert.ok(Buffer.byteLength(JSON.stringify(release)) > 2_000_000);
  const service = client({ fetchImpl: async url => new Response(JSON.stringify(url.pathname.endsWith('/release')
    ? { 'release-count': 101, offset: 7, releases: [release] } : release)) });
  assert.deepEqual(await service.lookupRelease({ releaseId: 'fixture' }), release);
  assert.deepEqual(await service.browseReleaseGroupReleases({ releaseGroupId: 'fixture', limit: 100, offset: 7 }),
    { 'release-count': 101, offset: 7, releases: [release] });
});

test('MusicBrainz catalogue refuses invalid bodies, records degraded health and recovers without caching empty success', async () => {
  let valid = false; let loads = 0;
  const recorder = createProviderHealthRecorder();
  const service = createMusicBrainzCatalogService({ providerHealthRecorder: recorder,
    metadataProviderCacheService: { async getOrLoad({ load }) { loads++; return { payload: await load(), cache: {} }; } },
    musicBrainzClient: client({ fetchImpl: async () => new Response(valid
      ? JSON.stringify({ 'release-group-count': 10, offset: 7, 'release-groups': [{ id: 'fixture-group', title: 'Fixture' }] })
      : `{"private":"${secret}`) }) });
  const input = { artistId: 'fixture', limit: 25, offset: 7 };
  await assert.rejects(service.browseArtistReleaseGroups(input), assertPrivate);
  const [health] = recorder.getSnapshots();
  assert.equal(health.status, 'degraded'); assert.equal(health.code, 'musicbrainz_invalid_response');
  assert.equal(health.details.retryable, false); assert.equal(inspect(health).includes(secret), false);
  valid = true;
  const page = await service.browseArtistReleaseGroups(input);
  assert.equal(loads, 2); assert.equal(page.results.length, 1); assert.equal(page.limit, 25);
  assert.equal(page.offset, 7); assert.equal(page.total, 10);
  assert.equal(recorder.getSnapshots()[0].status, 'healthy');
});

test('MusicBrainz import normalizes every track of a large release and refuses malformed input before storage', async t => {
  let valid = true;
  const stored = { artist: { id: 'local-artist' }, releaseGroup: { id: 'local-group' }, release: { id: 'local-release' } };
  const storeReleaseGraph = t.mock.fn(async graph => {
    assert.equal(graph.release.trackCount, 3000); assert.equal(graph.release.mediumCount, 60);
    assert.equal(graph.media[59].tracks[49].recording.musicbrainzRecordingId, 'recording-59-49');
    return stored;
  });
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createMusicBrainzImportService({ metadataService: { storeReleaseGraph }, recordAuditEventFn,
    musicBrainzClient: client({ fetchImpl: async url => new Response(valid ? JSON.stringify(url.pathname.includes('/artist/')
      ? { id: 'fixture-artist', name: 'Fixture artist' } : largeMusicBrainzRelease()) : 'null') }) });
  const result = await service.importReleaseById({ releaseId: 'fixture-release' });
  assert.equal(result.release.id, 'local-release'); assert.equal(storeReleaseGraph.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  valid = false;
  await assert.rejects(service.importReleaseById({ releaseId: 'fixture-release' }), assertPrivate);
  assert.equal(storeReleaseGraph.mock.callCount(), 1); assert.equal(recordAuditEventFn.mock.callCount(), 1);
});

test('MusicBrainz parser adoption does not enlarge other providers or replace exact byte accounting with characters', async () => {
  await assert.rejects(readBoundedJsonResponse(new Response('{}'), { maxResponseBytes: 2_000_001 }),
    error => error.code === 'provider_response_invalid');
  const body = JSON.stringify({ value: 'é'.repeat(1_000_000) });
  assert.ok(body.length < 2_000_000);
  await assert.rejects(client({ fetchImpl: async () => new Response(body) }).lookupArtist({ artistId: 'fixture' }), assertPrivate);
});

test('MusicBrainz rejects malformed, invalid UTF-8, absent and non-object bodies without retaining input or retrying', async t => {
  for (const body of [`{"private":"${secret}`, Buffer.from([123, 34, 120, 34, 58, 34, 255, 34, 125]), '[]', 'null', '1', null]) {
    const fetchImpl = t.mock.fn(async () => new Response(body));
    await assert.rejects(client({ fetchImpl }).searchArtists({ query: secret }), assertPrivate);
    assert.equal(fetchImpl.mock.callCount(), 1);
  }
});

test('MusicBrainz retires declared oversize bodies before materialization', async () => {
  let cancelled = false;
  const service = client({ fetchImpl: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }),
    { headers: { 'content-length': '2000001' } }) });
  await assert.rejects(service.lookupArtist({ artistId: 'fixture' }), assertPrivate);
  assert.equal(cancelled, true);
});

test('MusicBrainz cancels ignored HTTP bodies before backoff and retains throttling metadata', async t => {
  for (const status of [400, 404, 429, 500, 503]) {
    let retired = false; let release;
    const gate = new Promise(resolve => { release = resolve; });
    const fetchImpl = t.mock.fn(async () => new Response(new ReadableStream({ cancel() { return gate.then(() => { retired = true; }); } }),
      { status, headers: { 'retry-after': '3' } }));
    const service = client({ fetchImpl, sleepImpl: async delay => { assert.equal(retired, true); assert.ok(delay >= 3000); } });
    const request = service.searchArtists({ query: secret });
    const result = assert.rejects(request, error => {
      assertPrivate(error, status === 404 ? 'musicbrainz_not_found' : status >= 500 || status === 429 ? 'musicbrainz_unavailable' : 'musicbrainz_request_failed');
      assert.equal(error.details.status, status);
      assert.equal(error.details.throttled, status === 429 || status === 503);
      assert.equal(error.details.retryAfterMs, status === 404 ? null : 3000);
      return true;
    });
    await new Promise(resolve => { setImmediate(resolve); });
    assert.equal(fetchImpl.mock.callCount(), 1); release(); await result;
    assert.equal(retired, true); assert.equal(fetchImpl.mock.callCount(), status >= 500 || status === 429 ? 2 : 1);
  }
});

test('MusicBrainz preserves HTTP-date Retry-After, transport retries and private diagnostics', async t => {
  const delays = [];
  const fetchImpl = t.mock.fn(async () => fetchImpl.mock.callCount() === 0
    ? new Response(secret, { status: 503, headers: { 'retry-after': new Date(Date.now() + 60000).toUTCString() } })
    : new Response('{}'));
  await client({ fetchImpl, sleepImpl: async delay => { delays.push(delay); } }).searchArtists({ query: secret });
  assert.equal(delays.length, 1); assert.ok(delays[0] > 50000 && delays[0] <= 60000);
  const failing = t.mock.fn(async () => { throw new Error(secret); });
  await assert.rejects(client({ fetchImpl: failing }).searchArtists({ query: secret }), error => assertPrivate(error, 'musicbrainz_unavailable'));
  assert.equal(failing.mock.callCount(), 2);
  for (const options of [{ baseUrl: `https://user:${secret}@musicbrainz.org` }, { maxRetries: secret }]) {
    assert.throws(() => client(options), error => !inspect(error).includes(secret) && error.code === 'musicbrainz_misconfigured');
  }
});

test('MusicBrainz ignored-body cleanup failure preserves the known HTTP result', async () => {
  const service = client({ maxRetries: 0, fetchImpl: async () => new Response(new ReadableStream({
    cancel() { throw new Error(secret); },
  }), { status: 503, headers: { 'retry-after': '3' } }) });
  await assert.rejects(service.searchArtists({ query: secret }), error => {
    assertPrivate(error, 'musicbrainz_unavailable');
    assert.equal(error.details.status, 503); assert.equal(error.details.retryAfterMs, 3000);
    return true;
  });
});

test('MusicBrainz body deadline and caller cancellation settle reads, retire bodies and permit later queued work', { timeout: 5000 }, async t => {
  for (const caller of [false, true]) {
    let started; let markRetired;
    const retired = new Promise(resolve => { markRetired = resolve; });
    const gate = new Promise(resolve => { started = resolve; });
    const controller = new AbortController(); const reason = new Error('internal caller deadline');
    const fetchImpl = t.mock.fn(async () => fetchImpl.mock.callCount() > 0 ? new Response('{"ok":true}')
      : new Response(new ReadableStream({ pull() { started(); }, cancel() { markRetired(); } }, { highWaterMark: 0 })));
    const service = client({ fetchImpl, requestTimeoutMs: 40 });
    const request = service.lookupArtist({ artistId: 'fixture', signal: caller ? controller.signal : null });
    const rejected = assert.rejects(request, error => caller ? error === reason : assertPrivate(error, 'musicbrainz_unavailable') && error.diagnosticCode === 'timeout');
    // Keep the process alive while AbortSignal.timeout's unref'ed timer owns the read.
    const keeper = setTimeout(() => {}, 1500);
    try { await gate; if (caller) controller.abort(reason); await rejected; }
    finally { clearTimeout(keeper); }
    await retired; assert.equal(fetchImpl.mock.callCount(), 1);
    assert.deepEqual(await service.lookupArtist({ artistId: 'healthy' }), { ok: true });
  }
});
