/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm, link } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import { createPeerInput } from '../../testing/slskd/peer-input.js';
import { wireInteger, wireString, wireFrame, createWireDecoder, wireReader } from '../../testing/slskd/wire-codec.js';
import { openSoulseekFixture } from '../../testing/slskd/soulseek-fixture.js';
import { nativeTransferFiles, nativeFileChunk, nativeFileDigest } from '../../testing/slskd/native-file-data.js';
import { sendNativeFile } from '../../testing/slskd/native-file-sender.js';
import { inspectNativeFile } from '../../testing/slskd/native-file-inspection.js';
import { acknowledgeNativeFileVolume, nativeFileVolumeOptions } from '../../testing/slskd/native-file-volume.js';

const username = 'owned-client';
function init(kind = 'F', token = 42, user = username) {
  const body = Buffer.concat([Buffer.from([1]), wireString(user), wireString(kind), wireInteger(token)]);
  return Buffer.concat([wireInteger(body.length), body]);
}
const raw = (token = 42, offset = 0n) => {
  const bytes = Buffer.alloc(12); bytes.writeUInt32LE(token); bytes.writeBigUInt64LE(offset, 4); return bytes;
};
function input() {
  const events = [];
  const reader = createPeerInput({ username, onInit: (...args) => events.push(['init', ...args]),
    onMessage: bytes => events.push(['message', bytes.toString('hex')]), onTransfer: token => events.push(['transfer', token]) });
  return { reader, events };
}

test('peer parsing handles every split and coalescing across initialization and raw or framed traffic', () => {
  for (const kind of ['P', 'F']) {
    const suffix = kind === 'F' ? raw() : wireFrame(40, wireInteger(0));
    const bytes = Buffer.concat([init(kind), suffix]);
    for (let split = 0; split <= bytes.length; split++) {
      const { reader, events } = input();
      reader.push(bytes.subarray(0, split)); reader.push(bytes.subarray(split)); reader.end();
      assert.deepEqual(events, [['init', kind, 42], kind === 'F' ? ['transfer', 42] : ['message', suffix.subarray(4).toString('hex')]]);
    }
    const { reader, events } = input();
    for (const byte of bytes) reader.push(Buffer.from([byte]));
    reader.end(); assert.equal(events.length, 2);
  }
});

test('raw negotiation refuses wrong identity, type, token, nonzero offset, suffix, size and partial EOF', () => {
  for (const bytes of [init('F', 42, 'other'), init('X'), Buffer.concat([init(), raw(43)]),
    Buffer.concat([init(), raw(42, 1n)]), Buffer.concat([init(), raw(), Buffer.from([0])]),
    wireInteger(16385), wireInteger(0)]) {
    const { reader, events } = input();
    assert.throws(() => reader.push(bytes));
    assert.equal(events.some(row => row[0] === 'transfer'), false);
    assert.throws(() => reader.push(Buffer.alloc(0)), TypeError);
  }
  for (const bytes of [init().subarray(0, -1), Buffer.concat([init(), raw().subarray(0, -1)])]) {
    const { reader } = input(); reader.push(bytes); assert.throws(() => reader.end(), RangeError);
  }
  const { reader, events } = input(); reader.push(Buffer.concat([init(), raw()]));
  reader.push(Buffer.alloc(0)); assert.equal(events.length, 2);
  assert.throws(() => reader.push(raw()), RangeError);
});

test('native peer refuses unowned and replayed capabilities, sends exact bytes and drains held raw negotiation', { timeout: 5000 }, async t => {
  const fixture = await openSoulseekFixture({ username, password: 'owned-password', mode: 'files' });
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
  message.socket.write(init('P'));
  async function request(token, file) {
    message.socket.write(wireFrame(40, wireInteger(0), wireInteger(token), wireString(file.filename), Buffer.alloc(8)));
    const response = wireReader(await next());
    assert.equal(response.integer(), 41); assert.equal(response.integer(), token); assert.equal(response.byte(), 1);
    assert.equal(response.integer(), file.size); assert.equal(response.integer(), 0); response.end();
  }
  const unknown = await connect(); let unknownBytes = 0;
  unknown.socket.on('data', chunk => { unknownBytes += chunk.length; });
  unknown.socket.write(Buffer.concat([init('F', 999), raw(999)])); await unknown.closed;
  assert.equal(unknownBytes, 0);
  await request(42, nativeTransferFiles[0]);
  const wrong = await connect();
  wrong.socket.write(Buffer.concat([init(), raw(43)])); await wrong.closed;
  const file = nativeTransferFiles[1]; await request(45, file);
  const transfer = await connect(); const chunks = [];
  let ready; const received = new Promise(resolve => { ready = resolve; });
  transfer.socket.on('data', chunk => {
    chunks.push(chunk);
    if (chunks.reduce((sum, bytes) => sum + bytes.length, 0) >= file.size) ready();
  });
  transfer.socket.write(Buffer.concat([init('F', 45), raw(45)]));
  await received;
  assert.equal(Buffer.concat(chunks).length, file.size);
  assert.equal(createHash('sha256').update(Buffer.concat(chunks)).digest('hex'), nativeFileDigest(file));
  transfer.socket.destroy(); await transfer.closed;
  const replay = await connect(); replay.socket.write(Buffer.concat([init('F', 45), raw(45)])); await replay.closed;
  await request(46, nativeTransferFiles[2]);
  const held = await connect(); held.socket.write(Buffer.concat([init('F', 46), raw(46).subarray(0, 4)]));
  await fixture.close(); await held.closed;
  assert.equal(fixture.snapshot().activeSockets, 0); assert.equal(fixture.snapshot().refused, 3);
  assert.deepEqual(fixture.snapshot().sentFiles, [file.filename]);
});

test('bounded native send waits for backpressure and write completion without ending the consumer', async t => {
  const file = nativeTransferFiles[1]; const chunks = [];
  let entered; const ready = new Promise(resolve => { entered = resolve; });
  let release;
  const target = new Writable({ highWaterMark: 1, write(chunk, encoding, callback) {
    chunks.push(Buffer.from(chunk));
    if (chunks.length === 1) { release = callback; entered(); } else callback();
  } });
  t.after(() => target.destroy());
  let complete = false;
  const sent = sendNativeFile(target, file).then(() => { complete = true; });
  await ready; assert.equal(complete, false); assert.equal(chunks.length, 1); assert.equal(chunks[0].length, 16_384);
  release(); await sent;
  assert.equal(target.writableEnded, false); assert.ok(chunks.every(chunk => chunk.length <= 16_384));
  const bytes = Buffer.concat(chunks); assert.equal(bytes.length, file.size);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), nativeFileDigest(file));
});

test('file inspection proves native path/descriptor identity and refuses content, size, links and fabricated manifest', async t => {
  const root = await mkdtemp(join(tmpdir(), 'harmoniarr-native-file-unit-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'NativeBytes'));
  const file = nativeTransferFiles[0]; const path = join(root, 'NativeBytes', 'file-1.bin');
  const chunks = [];
  for (let offset = 0; offset < file.size; offset += 16_384) chunks.push(nativeFileChunk(file, offset, Math.min(16_384, file.size - offset)));
  const bytes = Buffer.concat(chunks); await writeFile(path, bytes);
  const proof = await inspectNativeFile(root, file);
  assert.equal(proof.size, file.size); assert.equal(proof.sha256, nativeFileDigest(file)); assert.equal(proof.identityStable, true);
  bytes[0] ^= 255; await writeFile(path, bytes);
  await assert.rejects(inspectNativeFile(root, file), { code: 'ERR_ASSERTION' });
  await writeFile(path, Buffer.alloc(file.size + 1));
  await assert.rejects(inspectNativeFile(root, file), { code: 'ERR_ASSERTION' });
  await link(path, join(root, 'alias.bin'));
  await writeFile(path, Buffer.concat(chunks));
  await assert.rejects(inspectNativeFile(root, file), { code: 'ERR_ASSERTION' });
  await assert.rejects(inspectNativeFile(root, { ...file, filename: '../outside.bin' }), TypeError);
});

test('volume admission refuses wider inspector mounts, mismatched ownership and unbounded storage before file reads', async () => {
  const name = 'owned_completed'; const projectName = 'owned';
  const provider = { Mounts: [{ Type: 'volume', Destination: '/data/downloads', RW: true, Name: name }] };
  const fixture = { Mounts: [{ Type: 'volume', Destination: '/downloads', RW: false, Name: name }] };
  const volume = { Name: name, Driver: 'local', Options: { ...nativeFileVolumeOptions },
    Labels: { 'com.docker.compose.project': projectName, 'com.docker.compose.volume': 'completed' } };
  const verify = (p = provider, f = fixture, v = volume) => acknowledgeNativeFileVolume({ provider: p, fixture: f, projectName,
    inspectVolume: async () => v });
  assert.equal((await verify()).boundedTmpfs, true);
  await assert.rejects(verify(provider, { Mounts: [{ ...fixture.Mounts[0], RW: true }] }));
  await assert.rejects(verify(provider, fixture, { ...volume, Options: {} }));
  await assert.rejects(verify(provider, fixture, { ...volume, Labels: { ...volume.Labels, 'com.docker.compose.project': 'other' } }));
  await assert.rejects(verify({ Mounts: [{ ...provider.Mounts[0], Name: 'other_completed' }] }));
});
