/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import test from 'node:test';
import { createLastFmClient } from '../../src/server/integrations/lastfm/lastfm-client.js';

const secret = 'PUBLIC-TEST-ONLY-lastfm-private-sentinel';
const options = { apiKey: secret, maxRetries: 0, sleepImpl: async () => {} };
const input = { artistName: 'PUBLIC-TEST-ONLY-private-artist' };
const empty = { similarartists: { artist: [] } };
function safe(error, diagnosticCode) {
  assert.equal(error.diagnosticCode, diagnosticCode);
  assert.equal(inspect(error, { depth: 8 }).includes(secret), false);
  assert.equal(inspect(error, { depth: 8 }).includes(input.artistName), false);
  assert.equal(Object.hasOwn(error, 'cause'), false);
  assert.deepEqual(Object.keys(error.details).sort(), ['attempts', 'maxRetries', 'retryable', 'status']);
  return true;
}

test('Last.fm network exhaustion retains approved retry metadata without URL or native cause', async () => {
  let calls = 0; const delays = [];
  const client = createLastFmClient({ ...options, maxRetries: 1, sleepImpl: async delay => { delays.push(delay); },
    fetchImpl: async (url, init) => {
      calls++; assert.equal(url.searchParams.get('api_key'), secret); assert.equal(init.redirect, 'error');
      throw Object.assign(new Error(secret), { url: url.toString(), diagnosticCode: secret });
    } });
  await assert.rejects(client.getSimilarArtists(input), error => {
    safe(error, 'unavailable'); assert.equal(error.code, 'lastfm_unavailable');
    assert.deepEqual(error.details, { attempts: 2, maxRetries: 1, retryable: true, status: null });
    return true;
  });
  assert.equal(calls, 2); assert.equal(delays.length, 1); assert.ok(delays[0] >= 2000 && delays[0] < 2250);
});

test('Last.fm accepts the decoded byte ceiling and rejects overflow without a retry or empty success', async () => {
  const prefix = JSON.stringify({ ...empty, padding: '' });
  for (const bytes of [2_000_000, 2_000_001]) {
    const body = JSON.stringify({ ...empty, padding: 'x'.repeat(bytes - Buffer.byteLength(prefix)) });
    let calls = 0;
    const client = createLastFmClient({ ...options, fetchImpl: async () => { calls++; return new Response(body); } });
    if (bytes === 2_000_000) assert.deepEqual(await client.getSimilarArtists(input), []);
    else await assert.rejects(client.getSimilarArtists(input), error => {
      safe(error, 'response_invalid'); assert.equal(error.code, 'lastfm_invalid_response'); assert.equal(error.details.retryable, false); return true;
    });
    assert.equal(calls, 1);
  }
});

test('Last.fm waits for ignored HTTP body cancellation before retry backoff', async () => {
  let acknowledge; let release;
  const cancelled = new Promise(resolve => { acknowledge = resolve; });
  const released = new Promise(resolve => { release = resolve; });
  let calls = 0; let delays = 0;
  const client = createLastFmClient({ ...options, maxRetries: 1, sleepImpl: async () => { delays++; }, fetchImpl: async () => {
    calls++;
    return calls === 1 ? new Response(new ReadableStream({ cancel() { acknowledge(); return released; } }), { status: 503 }) : Response.json(empty);
  } });
  const running = client.getSimilarArtists(input);
  try {
    await Promise.race([cancelled, running.then(() => { assert.fail('Expected error body cancellation'); })]);
    assert.equal(calls, 1); assert.equal(delays, 0);
  } finally { release(); await running.catch(() => {}); }
  assert.deepEqual(await running, []); assert.equal(calls, 2); assert.equal(delays, 1);
});

test('Last.fm invalid successful bodies are typed terminal failures without provider text', async () => {
  for (const response of [() => new Response(`{"private":"${secret}`), () => Response.json([]), () => Response.json(null),
    () => new Response(Buffer.from([123, 34, 120, 34, 58, 34, 255, 34, 125])),
    () => new Response(new ReadableStream({ start(controller) { controller.error(new Error(secret)); } })),
    () => new Response('{}', { headers: { 'content-length': '2000001' } })]) {
    let calls = 0;
    const client = createLastFmClient({ ...options, maxRetries: 1, fetchImpl: async () => { calls++; return response(); } });
    await assert.rejects(client.getSimilarArtists(input), error => safe(error, 'response_invalid'));
    assert.equal(calls, 1);
  }
});

test('Last.fm preserves caller abort identity, cancels the active reader and admits the next queued request', async () => {
  const controller = new AbortController(); const reason = new Error('Owned response-budget abort');
  let acknowledge; let cancelled = false; let calls = 0;
  const reading = new Promise(resolve => { acknowledge = resolve; });
  const client = createLastFmClient({ ...options, fetchImpl: async () => {
    calls++;
    return calls === 1 ? new Response(new ReadableStream({ pull(stream) { stream.enqueue(Buffer.from('{')); acknowledge(); },
      cancel() { cancelled = true; } }, { highWaterMark: 0 })) : Response.json(empty);
  } });
  const running = client.getSimilarArtists({ ...input, signal: controller.signal });
  await Promise.race([reading, running]); controller.abort(reason);
  await assert.rejects(running, error => error === reason);
  assert.deepEqual(await client.getSimilarArtists(input), []);
  assert.equal(cancelled, true); assert.equal(calls, 2);
});

test('Last.fm configuration failures do not echo rejected URLs or numeric inputs', () => {
  for (const invalid of [{ baseUrl: `https://ws.audioscrobbler.com/?api_key=${secret}` }, { minIntervalMs: secret },
    { requestTimeoutMs: secret }, { maxRetries: secret }]) {
    assert.throws(() => createLastFmClient({ ...options, ...invalid }), error => {
      assert.equal(error.code, 'lastfm_misconfigured'); assert.equal(inspect(error).includes(secret), false); return true;
    });
  }
});
