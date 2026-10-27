/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlexHttpClient } from '../../src/server/integrations/plex/plex-http-client.js';
import { createPlexRequestService } from '../../src/server/integrations/plex/plex-request-service.js';
import { admitPlexDestination, validatePlexHeaders, decodePlexResponse, plexOperationPolicy } from '../../src/server/integrations/plex/plex-http-policy.js';
import { createPlexResponseTransport } from '../../testing/server/plex-response-transport.js';
import { drainApplicationWorkerOwners } from '../../src/server/application-worker-drain.js';

const input = { clientIdentifier: 'fixture-client', accessToken: 'public-fixture-token' };
const response = (body, status = 200, headers = {}) => ({ status, headers: new Headers({ 'content-type': 'application/json', ...headers }), body: Buffer.from(body) });

test('Plex client preserves endpoint/header/collection contracts through a single owned request service', async () => {
  const calls = [];
  const client = createPlexHttpClient({ transport: createPlexResponseTransport(async (url, options) => {
    calls.push({ url, ...options });
    const path = new URL(url).pathname;
    return Response.json(path.endsWith('/home/users') ? { MediaContainer: { User: [{ id: 1 }] } }
      : path.endsWith('/resources') ? [{ name: 'server' }] : { id: 123, code: 'pin' });
  }) });
  assert.equal((await client.createPin(input)).id, 123);
  await client.readPin({ ...input, pinId: 123 }); await client.fetchCurrentUser(input);
  assert.deepEqual(await client.fetchHomeUsers(input), [{ id: 1 }]); assert.deepEqual(await client.fetchResources(input), [{ name: 'server' }]);
  assert.equal(calls[0].method, 'POST'); assert.equal(calls[0].url, 'https://plex.tv/api/v2/pins?strong=true');
  assert.equal(calls[0].headers['X-Plex-Token'], undefined); assert.equal(calls[1].headers['X-Plex-Token'], undefined); assert.equal(calls[2].headers['X-Plex-Token'], input.accessToken);
  assert.equal(calls[2].headers['Accept-Encoding'], 'identity'); assert.match(calls[4].url, /^https:\/\/clients\.plex\.tv\//u);
  await client.close(); assert.equal(client.getRequestState().closed, true);
});

test('Plex destination and primitive header validation refuses authority/path/header substitution before dispatch', async () => {
  for (const value of ['http://plex.tv/api', 'https://plex.tv.evil.invalid/', 'https://plex.tv:444/', 'https://user@plex.tv/', 'https://clients.plex.tv/#secret', 'https://127.0.0.1/']) assert.throws(() => admitPlexDestination(value));
  assert.equal(admitPlexDestination('https://plex.tv/api/v2/user').hostname, 'plex.tv');
  for (const value of ['', 'a\r\nX: token', 'a'.repeat(257)]) assert.throws(() => validatePlexHeaders({ clientIdentifier: value }));
  assert.throws(() => validatePlexHeaders({ ...input, accessToken: 'a'.repeat(4097) }));
  await assert.rejects(createPlexHttpClient().readPin({ ...input, pinId: '..' }));
});

test('response policy bounds bytes and UTF-8/JSON roots, refuses encoding/redirects and never exposes remote error text', () => {
  assert.equal(plexOperationPolicy('createPin').bytes, 65536); assert.equal(plexOperationPolicy('resources').bytes, 2097152);
  assert.deepEqual(decodePlexResponse(response('{}'), 'user'), {});
  for (const body of ['', 'null', '42', '[]', 'invalid']) assert.throws(() => decodePlexResponse(response(body), 'user'), { code: 'plex_user_invalid_response' });
  assert.throws(() => decodePlexResponse({ ...response('{}'), body: Buffer.from([255]) }, 'user'));
  assert.throws(() => decodePlexResponse(response('{}', 200, { 'content-encoding': 'gzip' }), 'user'), { code: 'plex_request_invalid' });
  assert.throws(() => decodePlexResponse(response('{}', 200, { 'content-length': '99999999' }), 'user'), { code: 'plex_request_oversized' });
  assert.throws(() => decodePlexResponse(response('{}', 200, { 'content-type': 'text/html' }), 'user'));
  for (const status of [301, 302, 303, 307, 308]) assert.throws(() => decodePlexResponse(response('{}', status), 'user'), { code: 'plex_request_redirect' });
  for (const [status, code] of [[401, 'plex_token_invalid'], [500, 'plex_user_fetch_failed']]) {
    assert.throws(() => decodePlexResponse(response('{"message":"public-fixture-secret"}', status), 'user'), error => error.code === code && !error.message.includes('public-fixture-secret'));
  }
});

test('deadline refuses late publication while retaining admission until actual transport drain', async () => {
  const result = Promise.withResolvers(), drain = Promise.withResolvers(), entered = Promise.withResolvers(); let signal, calls = 0;
  const service = createPlexRequestService({ timeoutMs: 25, maxActive: 1, transport: { startRequest(_url, options) { calls++; signal = options.signal; entered.resolve(); return { result: result.promise, drained: drain.promise }; } } });
  const request = service.requestJson({ url: 'https://plex.tv/api/v2/user', method: 'GET', headers: {}, operation: 'user' });
  const refusal = assert.rejects(request, { code: 'plex_request_timeout' }); await entered.promise; await refusal;
  assert.equal(signal.aborted, true); assert.equal(service.getState().active, 1);
  await assert.rejects(service.requestJson({ url: 'https://plex.tv/api/v2/user', method: 'GET', headers: {}, operation: 'user' }), { code: 'plex_request_busy' });
  result.resolve(response('{}')); drain.resolve(true); assert.equal(await service.waitForDrain(), true); assert.equal(calls, 1); await service.close();
});

test('Plex shutdown cancels work, closes admission and waits for held drainage; uncertain retirement seals future work', async () => {
  const result = Promise.withResolvers(), drain = Promise.withResolvers(); let signal, closed = false;
  const service = createPlexRequestService({ transport: { startRequest(_url, options) { signal = options.signal; return { result: result.promise, drained: drain.promise }; } } });
  const request = service.requestJson({ url: 'https://plex.tv/api/v2/user', method: 'GET', headers: {}, operation: 'user' });
  const refusal = assert.rejects(request); await new Promise(resolve => { setImmediate(resolve); });
  const closing = service.close(); closing.then(() => { closed = true; }, () => {}); assert.equal(service.close(), closing); assert.equal(signal.aborted, true);
  await refusal; await new Promise(resolve => { setImmediate(resolve); }); assert.equal(closed, false);
  result.resolve(response('{}')); drain.resolve(false); await assert.rejects(closing, /retirement is uncertain/u);
  await assert.rejects(service.requestJson({ url: 'https://plex.tv/api/v2/user', method: 'GET', headers: {}, operation: 'user' }), { code: 'plex_request_closed' });
});

test('application shutdown drains Plex transport after producer workers', async () => {
  const gate = Promise.withResolvers(), entered = Promise.withResolvers(); let transportClosed = false;
  const running = drainApplicationWorkerOwners({ libraryModule: { libraryScanWorker: { close: async () => { entered.resolve(); await gate.promise; } } }, plexHttpClient: { close: async () => { transportClosed = true; } } });
  await entered.promise; assert.equal(transportClosed, false); gate.resolve(); await running; assert.equal(transportClosed, true);
});

test('a valid body with uncertain retirement cannot publish and seals the owner', async () => {
  const service = createPlexRequestService({ transport: { startRequest: () => ({ result: Promise.resolve(response('{}')), drained: Promise.resolve(false) }) } });
  await assert.rejects(service.requestJson({ url: 'https://plex.tv/api/v2/user', method: 'GET', headers: {}, operation: 'user' }), { code: 'plex_request_unavailable' });
  assert.equal(await service.waitForDrain(), false); assert.equal(service.getState().sealed, true);
  await assert.rejects(service.close(), /retirement is uncertain/u);
});
