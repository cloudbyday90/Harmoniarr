/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */


import assert from 'node:assert/strict';
import test from 'node:test';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { openSoulseekFixture } from '../../testing/slskd/soulseek-fixture.js';
import { wireInteger, wireString, wireFrame, createWireDecoder, wireReader } from '../../testing/slskd/wire-codec.js';
import { nativeAudioFiles, nativeAudioDigest } from '../../testing/slskd/native-audio-data.js';

const username = 'owned-audio-client';
function init(kind, token) {
  const body = Buffer.concat([Buffer.from([1]), wireString(username), wireString(kind), wireInteger(token)]);
  return Buffer.concat([wireInteger(body.length), body]);
}
function raw(token, offset = 0n) {
  const bytes = Buffer.alloc(12); bytes.writeUInt32LE(token); bytes.writeBigUInt64LE(offset, 4); return bytes;
}

test('native audio peer refuses unknown, replayed, offset and duplicate capabilities while sending only declared bytes', { timeout: 5000 }, async t => {
  const fixture = await openSoulseekFixture({ username, password: 'owned-password', mode: 'audio' });
  t.after(() => fixture.close());
  async function connect() {
    const socket = createConnection({ host: '127.0.0.1', port: fixture.peerPort });
    const closed = new Promise(resolve => { socket.once('close', resolve); });
    socket.on('error', () => {});
    t.after(async () => { socket.destroy(); await closed; });
    await once(socket, 'connect', { signal: t.signal });
    return { socket, closed };
  }
  const message = await connect(); const frames = []; const waiters = [];
  const decoder = createWireDecoder(frame => { if (waiters.length) waiters.shift()(frame); else frames.push(frame); });
  message.socket.on('data', chunk => decoder.push(chunk));
  const next = () => frames.length ? Promise.resolve(frames.shift()) : new Promise(resolve => { waiters.push(resolve); });
  message.socket.write(init('P', 1));
  async function request(token, file) {
    message.socket.write(wireFrame(40, wireInteger(0), wireInteger(token), wireString(file.filename), Buffer.alloc(8)));
    const response = wireReader(await next());
    assert.equal(response.integer(), 41); assert.equal(response.integer(), token); assert.equal(response.byte(), 1);
    assert.equal(response.integer(), file.size); assert.equal(response.integer(), 0); response.end();
  }
  const unknown = await connect(); let leaked = 0;
  unknown.socket.on('data', chunk => { leaked += chunk.length; });
  unknown.socket.write(Buffer.concat([init('F', 999), raw(999)])); await unknown.closed; assert.equal(leaked, 0);
  await request(42, nativeAudioFiles[0]);
  const transfer = await connect(); const chunks = []; let count = 0; let ready;
  const received = new Promise(resolve => { ready = resolve; });
  transfer.socket.on('data', chunk => { chunks.push(chunk); count += chunk.length; if (count === nativeAudioFiles[0].size) ready(); });
  transfer.socket.write(Buffer.concat([init('F', 42), raw(42)])); await received;
  assert.equal(createHash('sha256').update(Buffer.concat(chunks)).digest('hex'), nativeAudioDigest(nativeAudioFiles[0]));
  transfer.socket.destroy(); await transfer.closed;
  const replay = await connect(); replay.socket.write(Buffer.concat([init('F', 42), raw(42)])); await replay.closed;
  await request(43, nativeAudioFiles[1]);
  const offset = await connect(); offset.socket.write(Buffer.concat([init('F', 43), raw(43, 1n)])); await offset.closed;
  message.socket.write(wireFrame(40, wireInteger(0), wireInteger(44), wireString(nativeAudioFiles[0].filename), Buffer.alloc(8)));
  await message.closed; await fixture.close();
  const result = fixture.snapshot();
  assert.equal(result.fileConnections, 2); assert.equal(result.requests.length, 2);
  assert.deepEqual(result.sentFiles, [nativeAudioFiles[0].filename]);
  assert.equal(result.refused, 4); assert.equal(result.activeSockets, 0);
});
