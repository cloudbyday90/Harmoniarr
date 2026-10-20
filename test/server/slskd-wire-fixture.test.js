/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createConnection } from 'node:net';
import { once } from 'node:events';
import { access } from 'node:fs/promises';
import { dirname } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { createWireDecoder, wireFrame, wireInteger, wireReader, wireString } from '../../testing/slskd/wire-codec.js';
import { openSoulseekFixture } from '../../testing/slskd/soulseek-fixture.js';
import { nativeFiles, nativePeer } from '../../testing/slskd/fixture-data.js';
import { requireNativeSlskdImages, withNativeSlskdProvider } from '../../testing/slskd/native-provider-runtime.js';
import { removeOwnedDockerWorkspace } from '../../scripts/docker-smoke-cleanup.js';

const username = 'owned-client'; const password = 'owned-fixture-password';
const login = () => wireFrame(1, wireString(username), wireString(password), wireInteger(170),
  wireString(createHash('md5').update(username + password).digest('hex')), wireInteger(760));

async function client(t, port) {
  const socket = createConnection({ port, host: '127.0.0.1' });
  const closed = new Promise(resolve => { socket.once('close', resolve); });
  socket.on('error', () => {});
  const frames = []; const waiters = [];
  socket.on('data', chunk => decoder.push(chunk));
  const decoder = createWireDecoder(frame => { if (waiters.length) waiters.shift()(frame); else frames.push(frame); });
  t.after(async () => { socket.destroy(); await closed; });
  await once(socket, 'connect', { signal: t.signal });
  return { socket, closed, next: () => frames.length ? Promise.resolve(frames.shift()) : new Promise(resolve => { waiters.push(resolve); }) };
}

test('wire framing handles every split and coalesced frames without exposing partial payload bytes', () => {
  const first = wireFrame(3, wireString('owned')); const second = wireFrame(92, wireInteger(0));
  const bytes = Buffer.concat([first, second]);
  for (let split = 0; split <= bytes.length; split++) {
    const seen = []; const decoder = createWireDecoder(frame => seen.push(frame));
    decoder.push(bytes.subarray(0, split)); decoder.push(bytes.subarray(split)); decoder.end();
    assert.deepEqual(seen, [first.subarray(4), second.subarray(4)]);
  }
  const seen = []; const decoder = createWireDecoder(frame => seen.push(frame));
  for (const byte of first.subarray(0, -1)) decoder.push(Buffer.from([byte]));
  assert.deepEqual(seen, []);
  decoder.push(first.subarray(-1)); assert.deepEqual(seen, [first.subarray(4)]);
});

test('bounded wire readers refuse invalid lengths, partial EOF, bad UTF-8 and trailing fields', () => {
  for (const size of [0, 16385, 0xffffffff]) {
    const decoder = createWireDecoder(() => assert.fail('Invalid frame reached its consumer'));
    assert.throws(() => decoder.push(wireInteger(size)), RangeError);
    assert.throws(() => decoder.push(wireFrame(1)), TypeError);
  }
  const decoder = createWireDecoder(() => assert.fail('Partial frame reached its consumer'));
  decoder.push(wireFrame(1).subarray(0, -1)); assert.throws(() => decoder.end(), RangeError);
  assert.throws(() => wireReader(Buffer.concat([wireInteger(1), Buffer.from([255])])).text(), TypeError);
  assert.throws(() => wireReader(wireInteger(4097)).text(), RangeError);
  assert.throws(() => wireReader(wireInteger(0)).end(), RangeError);
});

test('owned central login and peer queue acknowledge only the fixture manifest', { timeout: 5000 }, async t => {
  const fixture = await openSoulseekFixture({ username, password }); t.after(() => fixture.close());
  const central = await client(t, fixture.serverPort);
  central.socket.write(login());
  const authenticated = wireReader(await central.next());
  assert.equal(authenticated.integer(), 1); assert.equal(authenticated.byte(), 1);
  central.socket.write(wireFrame(3, wireString(nativePeer)));
  const address = wireReader(await central.next());
  assert.equal(address.integer(), 3); assert.equal(address.text(), nativePeer);
  const peer = await client(t, fixture.peerPort);
  const init = Buffer.concat([Buffer.from([1]), wireString(username), wireString('P'), wireInteger(12)]);
  peer.socket.write(Buffer.concat([wireInteger(init.length), init,
    wireFrame(40, wireInteger(0), wireInteger(44), wireString(nativeFiles[0].filename), Buffer.alloc(8))]));
  const queued = wireReader(await peer.next());
  assert.equal(queued.integer(), 41); assert.equal(queued.integer(), 44); assert.equal(queued.byte(), 0);
  assert.equal(queued.text(), 'Queued'); queued.end();
  peer.socket.write(wireFrame(40, wireInteger(0), wireInteger(45), wireString('unowned.flac'), Buffer.alloc(8)));
  await peer.closed;
  assert.deepEqual(fixture.snapshot().requests, [nativeFiles[0].filename]);
  assert.equal(fixture.snapshot().refused, 1);
});

test('unauthenticated or unknown peer requests cannot resolve an address', { timeout: 5000 }, async t => {
  const fixture = await openSoulseekFixture({ username, password }); t.after(() => fixture.close());
  const unauthenticated = await client(t, fixture.serverPort);
  unauthenticated.socket.write(wireFrame(3, wireString(nativePeer))); await unauthenticated.closed;
  const authenticated = await client(t, fixture.serverPort);
  authenticated.socket.write(login()); await authenticated.next();
  authenticated.socket.write(wireFrame(3, wireString('unowned-peer'))); await authenticated.closed;
  assert.equal(fixture.snapshot().addresses, 0); assert.equal(fixture.snapshot().refused, 2);
});

test('fixture close retires held partial sockets and closes admission before returning', { timeout: 5000 }, async t => {
  const fixture = await openSoulseekFixture({ username, password }); t.after(() => fixture.close());
  const connection = await client(t, fixture.serverPort);
  connection.socket.write(Buffer.from([10]));
  const first = fixture.close(); assert.equal(fixture.close(), first);
  await first; await connection.closed;
  assert.equal(fixture.snapshot().activeSockets, 0);
  const refused = createConnection({ port: fixture.serverPort, host: '127.0.0.1' });
  const closed = new Promise(resolve => { refused.once('close', resolve); });
  const [error] = await once(refused, 'error', { signal: t.signal });
  assert.equal(error.code, 'ECONNREFUSED'); await closed;
});

test('native image inputs refuse absent, mutable or non-image references before Docker work', () => {
  for (const value of [undefined, 'slskd/slskd:0.26.0', 'sha256:short', 'x'.repeat(64)]) {
    assert.throws(() => requireNativeSlskdImages({ HARMONIARR_NATIVE_APP_IMAGE: value, HARMONIARR_NATIVE_SLSKD_IMAGE: value }), TypeError);
  }
});

for (const original of [new Error('Controlled startup failure'), null]) {
  test(`unacknowledged startup retains owned files and preserves the first ${original === null ? 'null' : 'Error'} after cleanup failure`, async t => {
    let workspaceRoot; const commands = [];
    t.after(async () => {
      if (workspaceRoot) await removeOwnedDockerWorkspace({ workspaceRoot, tempRootDir: tmpdir(), prefix: 'harmoniarr-native-slskd-' });
    });
    await assert.rejects(withNativeSlskdProvider({ applicationImage: 'sha256:' + 'a'.repeat(64), providerImage: 'sha256:' + 'b'.repeat(64),
      execute: async (binary, args) => {
        assert.equal(binary, 'docker'); commands.push(args);
        if (args.includes('up')) { workspaceRoot = dirname(args[args.indexOf('-f') + 1]); throw original; }
        if (args.includes('stop')) throw new Error('Later cleanup failure');
        return { stdout: '', stderr: '' };
      } }), error => error === original);
    await access(workspaceRoot);
    assert.equal(commands.filter(args => args.includes('stop')).length, 2);
    assert.ok(commands.some(args => args.includes('down')));
    assert.equal(commands.filter(args => args.includes('ls')).length, 3);
  });
}
