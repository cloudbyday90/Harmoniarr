import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addMusicQueueReleaseToLibrary,
  allowMusicQueueFallbackQuality,
  fetchMusicQueueRelease,
  fetchMusicQueueReleases,
  recheckMusicQueueReleaseSafeAdd,
  rejectMusicQueueMatch,
  searchMusicQueueReleaseAgain,
  useMusicQueueMatch,
} from '../../src/client/lib/acquisition-api.js';

function createJsonResponse({ payload = { ok: true } } = {}) {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    ok: true,
    status: 200,
    async json() {
      return payload;
    },
  };
}

test('acquisition-api fetchMusicQueueReleases sends bounded query params', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchMusicQueueReleases({ limit: 25, offset: 10 });

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/acquisition/releases?limit=25&offset=10');
});

test('acquisition-api fetchMusicQueueReleases sends an optional artist scope', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchMusicQueueReleases({ limit: 25, metadataArtistId: 'artist/1', offset: 10 });

  assert.equal(
    globalThis.fetch.mock.calls[0].arguments[0],
    '/api/v1/acquisition/releases?limit=25&metadataArtistId=artist%2F1&offset=10',
  );
});

test('acquisition-api fetchMusicQueueRelease encodes wanted release id', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchMusicQueueRelease('wanted/release 1');

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/acquisition/releases/wanted%2Frelease%201');
});

test('acquisition-api useMusicQueueMatch sends CSRF-backed scoped POST', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-mq' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await useMusicQueueMatch({
    matchId: 'candidate/1',
    reason: 'Looks right',
    wantedReleaseId: 'wanted/1',
  });

  const [url, options] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(url, '/api/v1/acquisition/releases/wanted%2F1/matches/candidate%2F1/use');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.get('X-CSRF-Token'), 'csrf-mq');
  assert.match(options.headers.get('Idempotency-Key'), /^acquisition-music-queue-matches-use-/);
  assert.deepEqual(JSON.parse(options.body), { reason: 'Looks right' });
});

test('acquisition-api useMusicQueueMatch reuses a caller-held idempotency key', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-mq' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await useMusicQueueMatch({
    idempotencyKey: 'acquisition-music-queue-matches-use-retry-1',
    matchId: 'candidate-1',
    wantedReleaseId: 'wanted-1',
  });

  const [, options] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(options.headers.get('Idempotency-Key'), 'acquisition-music-queue-matches-use-retry-1');
});

test('acquisition-api rejectMusicQueueMatch sends CSRF-backed scoped POST', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-mq' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await rejectMusicQueueMatch({
    matchId: 'candidate-1',
    wantedReleaseId: 'wanted-1',
  });

  const [url, options] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(url, '/api/v1/acquisition/releases/wanted-1/matches/candidate-1/reject');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.get('X-CSRF-Token'), 'csrf-mq');
  assert.deepEqual(JSON.parse(options.body), {});
});

test('acquisition-api searchMusicQueueReleaseAgain sends CSRF-backed scoped POST', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-mq' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await searchMusicQueueReleaseAgain({
    wantedReleaseId: 'wanted/1',
  });

  const [url, options] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(url, '/api/v1/acquisition/releases/wanted%2F1/search-again');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.get('X-CSRF-Token'), 'csrf-mq');
  assert.deepEqual(JSON.parse(options.body), {});
});

test('acquisition-api allowMusicQueueFallbackQuality sends CSRF-backed scoped POST', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-mq' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await allowMusicQueueFallbackQuality({
    wantedReleaseId: 'wanted/1',
  });

  const [url, options] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(url, '/api/v1/acquisition/releases/wanted%2F1/allow-fallback-quality');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.get('X-CSRF-Token'), 'csrf-mq');
  assert.deepEqual(JSON.parse(options.body), {});
});

test('acquisition-api recheckMusicQueueReleaseSafeAdd sends a CSRF-backed release-only POST', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-mq' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await recheckMusicQueueReleaseSafeAdd({ wantedReleaseId: 'wanted/1' });

  const [url, options] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(url, '/api/v1/acquisition/releases/wanted%2F1/recheck-library-add');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.get('X-CSRF-Token'), 'csrf-mq');
  assert.deepEqual(JSON.parse(options.body), {});
});

test('acquisition-api addMusicQueueReleaseToLibrary sends a CSRF-backed release-only POST', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-mq' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await addMusicQueueReleaseToLibrary({ wantedReleaseId: 'wanted/1' });

  const [url, options] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(url, '/api/v1/acquisition/releases/wanted%2F1/add-to-library');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.get('X-CSRF-Token'), 'csrf-mq');
  assert.deepEqual(JSON.parse(options.body), {});
});
