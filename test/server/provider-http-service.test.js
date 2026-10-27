/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createProviderHttpService } from '../../src/server/integrations/providers/provider-http-service.js';
import { createProviderJsonRequestService } from '../../src/server/integrations/providers/provider-json-request-service.js';
import { drainApplicationWorkerOwners } from '../../src/server/application-worker-drain.js';

const input = { provider: 'spotify', url: 'https://api.spotify.com/v1/tracks/fixture', timeoutMs: 1000 };
const response = () => ({ status: 200, headers: new Headers(), body: Buffer.from('{"id":"fixture"}') });
const tick = () => new Promise(resolve => { setImmediate(resolve); });
function held() {
  const result = Promise.withResolvers(), drain = Promise.withResolvers(), entered = Promise.withResolvers(); let accepted, calls = 0;
  return { result, drain, entered, get accepted() { return accepted; }, get calls() { return calls; },
    transport: { startRequest(url, options) { accepted = { url, ...options }; calls++; entered.resolve(); return { result: result.promise, drained: drain.promise }; } } };
}
test('provider success waits for actual retirement and shares capacity across providers', async () => {
  const f = held(), owner = createProviderHttpService({ transport: f.transport, maxActive: 1 }); let published = false;
  const pending = owner.request(input).then(value => { published = true; return value; }); await f.entered.promise;
  f.result.resolve(response()); await tick(); assert.equal(published, false); assert.equal(owner.getState().active, 1);
  await assert.rejects(owner.request({ ...input, provider: 'youtube', url: 'https://www.googleapis.com/youtube/v3/videos' }), { diagnosticCode: 'unavailable' });
  f.drain.resolve(true); assert.deepEqual(await pending, { id: 'fixture' }); assert.equal(await owner.waitForDrain(), true); await owner.close();
});
test('deadline refuses a late response but holds admission until its actual drain', async () => {
  const f = held(), owner = createProviderHttpService({ transport: f.transport, maxActive: 1 });
  const pending = assert.rejects(owner.request({ ...input, timeoutMs: 25 }), { diagnosticCode: 'timeout' }); await f.entered.promise; await pending;
  assert.equal(f.accepted.signal.aborted, true); assert.equal(owner.getState().active, 1);
  await assert.rejects(owner.request(input), { diagnosticCode: 'unavailable' });
  f.result.resolve(response()); f.drain.resolve(true); assert.equal(await owner.waitForDrain(), true); assert.equal(f.calls, 1); await owner.close();
});
test('provider shutdown cancels work, prevents new dispatch and waits for held drain', async () => {
  const f = held(), owner = createProviderHttpService({ transport: f.transport }); let closed = false;
  const refused = assert.rejects(owner.request(input), { diagnosticCode: 'timeout' }); await f.entered.promise;
  const closing = owner.close(); closing.then(() => { closed = true; }); assert.equal(owner.close(), closing); await refused; await tick();
  assert.equal(closed, false); assert.equal(f.accepted.signal.aborted, true); await assert.rejects(owner.request(input), { diagnosticCode: 'unavailable' });
  f.result.resolve(response()); f.drain.resolve(true); await closing; assert.equal(closed, true);
});
test('uncertain retirement refuses valid JSON and seals subsequent admission', async () => {
  const owner = createProviderHttpService({ transport: { startRequest: () => ({ result: Promise.resolve(response()), drained: Promise.resolve(false) }) } });
  await assert.rejects(owner.request(input), { diagnosticCode: 'unavailable' }); assert.equal(await owner.waitForDrain(), false);
  assert.equal(owner.getState().sealed, true); await assert.rejects(owner.request(input), { diagnosticCode: 'unavailable' }); await assert.rejects(owner.close(), /retirement is uncertain/u);
});
test('request preparation belongs to the deadline and cannot dispatch after expiry', async () => {
  const f = held(), entered = Promise.withResolvers(), release = Promise.withResolvers(), owner = createProviderHttpService({ transport: f.transport, maxActive: 1 });
  await assert.rejects(owner.request({ ...input, timeoutMs: 25, beforeRequest: async () => { entered.resolve(); await release.promise; } }), { diagnosticCode: 'timeout' });
  await entered.promise; assert.equal(owner.getState().active, 1); release.resolve(); await owner.waitForDrain(); assert.equal(f.calls, 0); await owner.close();
});
test('headers and request body are captured before asynchronous admission', async () => {
  const f = held(), entered = Promise.withResolvers(), release = Promise.withResolvers(), owner = createProviderHttpService({ transport: f.transport });
  const headers = { Authorization: 'Bearer accepted' }, body = Buffer.from('accepted');
  const pending = owner.request({ provider: 'spotify', url: 'https://accounts.spotify.com/api/token', method: 'POST', headers, body,
    beforeRequest: async () => { entered.resolve(); await release.promise; } });
  await entered.promise; headers.Authorization = 'Bearer changed'; body.fill(0); release.resolve(); await f.entered.promise;
  assert.equal(f.accepted.headers.Authorization, 'Bearer accepted'); assert.equal(f.accepted.body.toString(), 'accepted');
  f.result.resolve(response()); f.drain.resolve(true); await pending; await owner.close();
});
test('native requests refuse proxy configuration and cross-provider origins before dispatch', async () => {
  let calls = 0;
  const owner = createProviderHttpService({ env: { HTTPS_PROXY: 'http://public-fixture.invalid', NO_PROXY: '*' }, transport: { kind: 'native', startRequest() { calls++; } } });
  await assert.rejects(owner.request(input), { diagnosticCode: 'request_rejected' });
  await assert.rejects(owner.request({ ...input, provider: 'youtube' }), { diagnosticCode: 'request_rejected' });
  await assert.rejects(owner.request({ ...input, headers: { Host: 'other.example' } }), { diagnosticCode: 'request_rejected' });
  assert.equal(calls, 0); await owner.close();
});
test('injected fetch cancellation remains owned until its cancellation promise settles', async () => {
  const cancelled = Promise.withResolvers(), release = Promise.withResolvers();
  const owner = createProviderHttpService({ maxActive: 1, fetchFn: async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(Buffer.from('{')); },
    cancel() { cancelled.resolve(); return release.promise; } })) });
  await assert.rejects(owner.request({ ...input, timeoutMs: 25 }), { diagnosticCode: 'timeout' }); await cancelled.promise; assert.equal(owner.getState().active, 1);
  await assert.rejects(owner.request(input), { diagnosticCode: 'unavailable' }); release.resolve(); assert.equal(await owner.waitForDrain(), true); await owner.close();
});
test('request adapters use the same supplied owner for OAuth, API and empty revocation', async () => {
  const inputs = [], providerHttpService = { request: async value => { inputs.push(value); return {}; } };
  const spotify = createProviderJsonRequestService({ provider: 'spotify', providerHttpService }), youtube = createProviderJsonRequestService({ provider: 'youtube', providerHttpService });
  await spotify.requestJson({ url: input.url }); await spotify.requestJson({ url: 'https://accounts.spotify.com/api/token', method: 'POST', oauth: true });
  await youtube.requestEmpty({ url: 'https://oauth2.googleapis.com/revoke', method: 'POST' });
  assert.deepEqual(inputs.map(row => [row.provider, row.empty, row.oauth]), [['spotify', false, undefined], ['spotify', false, true], ['youtube', true, undefined]]);
});
test('application drains provider HTTP after producer workers and Plex, preserving an earlier failure', async () => {
  const order = [], failure = new Error('producer failed');
  await assert.rejects(drainApplicationWorkerOwners({ libraryModule: { libraryScanWorker: { close: async () => { order.push('producer'); throw failure; } } },
    plexHttpClient: { close: async () => { order.push('plex'); } }, providerHttpService: { close: async () => { order.push('provider'); } } }), error => error === failure);
  assert.deepEqual(order, ['producer', 'plex', 'provider']);
});
