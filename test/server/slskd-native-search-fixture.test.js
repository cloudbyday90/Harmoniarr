/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createConnection, createServer } from 'node:net';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { nativeSearchPeers, nativeSearchPlans, nativeSearchPayloadLimit, encodeNativeSearchResponse,
  resolveNativeSearchPlan } from '../../testing/slskd/native-search-codec.js';
import { createNativeSearchResponder } from '../../testing/slskd/native-search-responder.js';
import { openSoulseekFixture } from '../../testing/slskd/soulseek-fixture.js';
import { openOwnedTcpServer } from '../../testing/slskd/owned-tcp-server.js';
import { createWireDecoder, wireInteger, wireReader, wireFrame, wireString } from '../../testing/slskd/wire-codec.js';

function readResponse(bytes) {
  const initSize = bytes.readUInt32LE();
  const init = wireReader(bytes.subarray(4, 4 + initSize));
  assert.equal(init.byte(), 1); const peer = init.text(); assert.equal(init.text(), 'P'); assert.equal(init.integer(), 0); init.end();
  const frame = bytes.subarray(4 + initSize);
  assert.equal(frame.readUInt32LE(), frame.length - 4); assert.equal(frame.readUInt32LE(4), 9);
  const payload = inflateSync(frame.subarray(8), { maxOutputLength: nativeSearchPayloadLimit, rejectGarbageAfterEnd: true });
  const reader = wireReader(payload);
  assert.equal(reader.text(), peer); const token = reader.integer(); assert.equal(reader.integer(), 1);
  assert.equal(reader.byte(), 1); const filename = reader.text(); const size = reader.integer(); assert.equal(reader.integer(), 0);
  assert.equal(reader.text(), 'wav'); assert.equal(reader.integer(), 4);
  const attributes = Array.from({ length: 4 }, () => [reader.integer(), reader.integer()]);
  assert.deepEqual(attributes, [[0, 1411], [1, 2], [4, 44100], [5, 16]]);
  assert.equal(reader.byte(), 1); assert.equal(reader.integer(), 1_000_000);
  assert.equal(reader.integer(), 0); assert.equal(reader.integer(), 0); assert.equal(reader.integer(), 0); reader.end();
  return { peer, token, filename, size, payload };
}

test('native search frames independently inflate to exact token, file and typed audio metadata', () => {
  for (const plan of nativeSearchPlans) for (const peer of nativeSearchPeers) for (const token of [0, 77, 0x7fffffff]) {
    const response = encodeNativeSearchResponse({ plan, peer, token });
    const decoded = readResponse(response.bytes);
    assert.equal(decoded.peer, peer); assert.equal(decoded.token, token);
    assert.equal(decoded.filename, plan.file.filename); assert.equal(decoded.size, plan.file.size);
    assert.equal(response.evidence.payloadBytes, decoded.payload.length);
    assert.equal(response.evidence.payloadSha256, createHash('sha256').update(decoded.payload).digest('hex'));
    assert.ok(response.evidence.payloadBytes <= nativeSearchPayloadLimit);
    assert.ok(response.evidence.compressedBytes <= nativeSearchPayloadLimit);
  }
});

test('native search codec refuses fabricated manifests, peers, tokens and non-declared queries', () => {
  for (const token of [-1, 0x80000000, 1.5, NaN, '1']) {
    assert.throws(() => encodeNativeSearchResponse({ plan: nativeSearchPlans[0], peer: nativeSearchPeers[0], token }), TypeError);
  }
  assert.throws(() => encodeNativeSearchResponse({ plan: { ...nativeSearchPlans[0] }, peer: nativeSearchPeers[0], token: 1 }), TypeError);
  assert.throws(() => encodeNativeSearchResponse({ plan: nativeSearchPlans[0], peer: 'unowned', token: 1 }), TypeError);
  for (const query of ['', 'unowned', nativeSearchPlans[0].query + ' suffix', null]) assert.throws(() => resolveNativeSearchPlan(query), TypeError);
});

test('native search responder delivers only declared peers and refuses duplicate authority before connecting', { timeout: 5000 }, async t => {
  const stats = { searchRequests: [], searchResponses: [] }; let refused = 0; const received = [];
  const server = await openOwnedTcpServer({ onSocket(socket) {
    const chunks = []; socket.on('data', chunk => chunks.push(chunk)); socket.on('end', () => received.push(readResponse(Buffer.concat(chunks))));
  } });
  const responder = createNativeSearchResponder({ stats, refuse: () => { refused++; } });
  t.after(async () => { await responder.close(); await server.close(); });
  const socket = { remoteAddress: '127.0.0.1', destroy: () => assert.fail('Owned search failed') };
  const input = { socket, port: server.port, query: nativeSearchPlans[0].query, token: 11 };
  await responder.dispatch(input);
  assert.equal(received.length, 2); assert.deepEqual(received.map(row => row.peer), nativeSearchPeers);
  assert.equal(stats.searchRequests.length, 1); assert.equal(stats.searchResponses.length, 2); assert.equal(responder.active(), 0);
  for (const options of [input, { ...input, query: nativeSearchPlans[1].query }, { ...input, token: 12, port: 80 },
    { ...input, token: 12, socket: { remoteAddress: 'not-an-address' } }]) assert.throws(() => responder.dispatch(options));
  assert.equal(stats.searchResponses.length, 2); assert.equal(refused, 0);
});

test('central search refuses unauthenticated, missing, changed and invalid endpoints or unknown queries and statistics targets', { timeout: 5000 }, async t => {
  const username = 'owned-client'; const password = 'owned-password';
  const fixture = await openSoulseekFixture({ username, password, mode: 'audio' }); t.after(() => fixture.close());
  const query = wireFrame(26, wireInteger(11), wireString(nativeSearchPlans[0].query));
  for (const commands of [[query], [null, query], [null, wireFrame(2, wireInteger(80))],
    [null, wireFrame(2, wireInteger(40000)), wireFrame(2, wireInteger(40001))],
    [null, wireFrame(2, wireInteger(40000)), wireFrame(26, wireInteger(11), wireString('unowned'))],
    [null, wireFrame(36, wireString('unowned'))]]) {
    const socket = createConnection({ host: '127.0.0.1', port: fixture.serverPort }); t.after(() => socket.destroy());
    socket.on('error', () => {}); await once(socket, 'connect');
    const closed = new Promise(resolve => { socket.once('close', resolve); });
    for (const command of commands) {
      if (command) socket.write(command);
      else {
        const ack = new Promise(resolve => { const decoder = createWireDecoder(resolve); socket.on('data', chunk => decoder.push(chunk)); });
        socket.write(wireFrame(1, wireString(username), wireString(password), wireInteger(170),
          wireString(createHash('md5').update(username + password).digest('hex')), wireInteger(760)));
        assert.equal(wireReader(await ack).integer(), 1);
      }
    }
    await closed;
  }
  assert.equal(fixture.snapshot().refused, 6); assert.deepEqual(fixture.snapshot().searchRequests, []);
  assert.deepEqual(fixture.snapshot().searchResponses, []);
});

test('search shutdown aborts a held socket, drains its task and closes later admission', { timeout: 5000 }, async t => {
  const held = new Set(); let observed;
  const received = new Promise(resolve => { observed = resolve; });
  const server = createServer({ allowHalfOpen: true }, socket => { held.add(socket); socket.on('data', observed); socket.on('error', () => {}); });
  await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { for (const socket of held) socket.destroy(); await new Promise(resolve => { server.close(resolve); }); });
  const stats = { searchRequests: [], searchResponses: [] }; let refused = 0;
  const responder = createNativeSearchResponder({ stats, refuse: () => { refused++; } }); t.after(() => responder.close());
  const input = { socket: { remoteAddress: '127.0.0.1', destroy: () => assert.fail('Shutdown is not a protocol failure') },
    port: server.address().port, token: 21, query: nativeSearchPlans[0].query };
  const task = responder.dispatch(input); await received;
  const close = responder.close(); assert.equal(responder.close(), close); await close;
  await assert.rejects(task, { code: 'ABORT_ERR' }); assert.equal(responder.active(), 0); assert.equal(refused, 0);
  assert.throws(() => responder.dispatch({ ...input, token: 22, query: nativeSearchPlans[1].query }));
});

test('central login accepts identical listen-port replay and routes the original search token to both peers', { timeout: 5000 }, async t => {
  const received = []; let complete;
  const delivered = new Promise(resolve => { complete = resolve; });
  const sink = await openOwnedTcpServer({ onSocket(socket) {
    const chunks = []; socket.on('data', chunk => chunks.push(chunk)); socket.on('end', () => {
      received.push(readResponse(Buffer.concat(chunks))); if (received.length === 2) complete();
    });
  } });
  const username = 'owned-client'; const password = 'owned-password';
  const fixture = await openSoulseekFixture({ username, password, mode: 'audio' });
  t.after(async () => { await fixture.close(); await sink.close(); });
  const socket = createConnection({ host: '127.0.0.1', port: fixture.serverPort }); t.after(() => socket.destroy());
  socket.on('error', () => {}); await once(socket, 'connect');
  socket.write(Buffer.concat([wireFrame(1, wireString(username), wireString(password), wireInteger(170),
    wireString(createHash('md5').update(username + password).digest('hex')), wireInteger(760)),
  wireFrame(2, wireInteger(sink.port)), wireFrame(2, wireInteger(sink.port)),
  wireFrame(26, wireInteger(31), wireString(nativeSearchPlans[0].query))]));
  await delivered; await fixture.close();
  assert.equal(fixture.snapshot().refused, 0); assert.equal(fixture.snapshot().activeSockets, 0);
  assert.deepEqual(fixture.snapshot().searchRequests, [{ token: 31, query: nativeSearchPlans[0].query }]);
  assert.equal(received.length, 2); assert.ok(received.every(row => row.token === 31));
});
