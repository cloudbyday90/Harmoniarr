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
import { createNativeRefusalPolicy, nativeRefusalPlans } from '../../testing/slskd/native-refusal-policy.js';
import { sendNativeRefusal } from '../../testing/slskd/native-refusal-transfer.js';
import { nativeFileDigest } from '../../testing/slskd/native-file-data.js';
import { openOwnedTcpServer } from '../../testing/slskd/owned-tcp-server.js';
import { runNativeRefusalScenario } from '../../testing/slskd/native-refusal-runner.js';

const plan = nativeRefusalPlans[0];
const record = attempt => ({ plan, attempt, acceptsFile: true });
const prefix = () => ({ size: plan.partial.bytes, sha256: nativeFileDigest(plan.partial.file, plan.partial.bytes), identityStable: true });

test('exhaustion capabilities require send and socket retirement, exact offsets and three total invocations', () => {
  const policy = createNativeRefusalPolicy(); const filename = plan.partial.file.filename;
  assert.throws(() => policy.reserve(1, '../unowned'));
  for (let attempt = 1; attempt <= 3; attempt++) {
    const owned = policy.reserve(attempt, filename);
    assert.equal(owned.attempt, attempt); assert.throws(() => policy.start(attempt, 0));
    policy.claim(attempt); assert.throws(() => policy.claim(attempt));
    const offset = attempt === 1 ? 0 : plan.partial.bytes;
    assert.equal(policy.acceptOffset(attempt, BigInt(offset + 1)), false);
    policy.start(attempt, offset); assert.throws(() => policy.start(attempt, offset));
    if (attempt < 3) {
      assert.throws(() => policy.reserve(attempt + 1, filename));
      owned.sent = true; assert.throws(() => policy.reserve(attempt + 1, filename));
    }
    owned.sent = true; owned.closed = true;
  }
  assert.throws(() => policy.reserve(4, filename)); assert.throws(() => policy.reserve(1, nativeRefusalPlans[1].partial.file.filename));
});

test('changed-size response never grants a second file connection and refuses a third request', () => {
  const policy = createNativeRefusalPolicy(); const file = nativeRefusalPlans[1].partial.file;
  const first = policy.reserve(10, file.filename); policy.claim(10); policy.start(10, 0);
  assert.equal(first.advertisedSize, file.size); first.sent = true; first.closed = true;
  const second = policy.reserve(11, file.filename);
  assert.equal(second.advertisedSize, file.size + 1); assert.equal(second.acceptsFile, false);
  assert.throws(() => policy.claim(11)); assert.equal(policy.acceptOffset(11, 32791n), false);
  assert.throws(() => policy.start(11, 32791)); assert.throws(() => policy.reserve(12, file.filename));
});

test('actual repeated-EOF socket sends no missing bytes and retires after prefix verification', { timeout: 5000 }, async t => {
  const sent = Promise.withResolvers(); let work;
  const server = await openOwnedTcpServer({ onSocket(socket) {
    work = sendNativeRefusal(socket, record(2), plan.partial.bytes, { inspect: async () => prefix() });
    work.then(sent.resolve, sent.reject);
  } });
  t.after(async () => { await server.close(); await work; });
  const client = createConnection({ host: '127.0.0.1', port: server.port }); client.on('error', () => {});
  const closed = once(client, 'close'); let bytes = 0; let ended = false;
  t.after(async () => { client.destroy(); await closed; });
  client.on('data', chunk => { bytes += chunk.length; }); client.on('end', () => { ended = true; });
  await once(client, 'connect', { signal: t.signal }); await closed;
  const result = await sent.promise;
  assert.equal(ended, true); assert.equal(bytes, 0); assert.equal(result.emittedBytes, 0);
  assert.equal(result.prefixSha256, prefix().sha256); assert.equal(result.prefixIdentityStable, true);
});

test('refusal send rejects mismatched offsets and unowned plans before ending the socket', async () => {
  const socket = { end() { assert.fail('Invalid refusal ended socket'); } }; let reads = 0;
  await assert.rejects(sendNativeRefusal(socket, record(2), plan.partial.bytes - 1, { inspect: async () => { reads++; } }));
  assert.equal(reads, 0);
  await assert.rejects(sendNativeRefusal(socket, record(2), plan.partial.bytes, { inspect: async () => ({ size: 1 }) }));
  await assert.rejects(sendNativeRefusal(socket, { plan: { ...plan }, attempt: 2, acceptsFile: true }, plan.partial.bytes), TypeError);
  const abort = new AbortController(); abort.abort(null);
  await assert.rejects(sendNativeRefusal(socket, record(2), plan.partial.bytes, { signal: abort.signal, inspect: async () => { reads++; } }), error => error === null);
  assert.equal(reads, 0);
});

for (const reason of [new Error('owned cancellation'), null]) {
  test('held prefix read drains and preserves cancellation ' + (reason === null ? 'null' : 'Error'), async () => {
    const entered = Promise.withResolvers(); const released = Promise.withResolvers(); const abort = new AbortController();
    let settled = false;
    const work = sendNativeRefusal({ end() { assert.fail('Cancelled prefix ended socket'); } }, record(2), plan.partial.bytes, {
      signal: abort.signal, inspect: async () => { entered.resolve(); await released.promise; return prefix(); },
    }).then(() => assert.fail('Cancelled refusal succeeded'), error => { assert.equal(error, reason); settled = true; });
    await entered.promise; abort.abort(reason); await Promise.resolve(); assert.equal(settled, false);
    released.resolve(); await work;
  });

  test('held EOF callback drains before preserving cancellation ' + (reason === null ? 'null' : 'Error'), async () => {
    const entered = Promise.withResolvers(); const abort = new AbortController(); let callback; let settled = false;
    const work = sendNativeRefusal({ end(done) { callback = done; entered.resolve(); } }, record(3), plan.partial.bytes, {
      signal: abort.signal, inspect: async () => prefix(),
    }).then(() => assert.fail('Cancelled EOF succeeded'), error => { assert.equal(error, reason); settled = true; });
    await entered.promise; abort.abort(reason); await Promise.resolve(); assert.equal(settled, false);
    callback(new Error('later EOF callback failure')); await work;
  });
}

test('refusal inspection waits for acknowledged stopped identity and refuses an active producer', async () => {
  const entered = Promise.withResolvers(); const release = Promise.withResolvers(); let inspectedFiles = false;
  const docker = async args => {
    if (args[0] === 'stop') { entered.resolve(); await release.promise; return ''; }
    if (args[0] === 'inspect') return JSON.stringify([{ Id: 'provider', State: { Running: false, ExitCode: 0 } }]);
    if (args.at(-1) === 'inspect') { inspectedFiles = true; return JSON.stringify({ incomplete: [] }); }
    return JSON.stringify(args.at(-1) === 'retire' ? { nativeDownloadsRetired: true } : {});
  };
  const work = runNativeRefusalScenario({ docker, fixtureId: 'fixture', providerId: 'provider' });
  await entered.promise; assert.equal(inspectedFiles, false); release.resolve();
  assert.equal((await work).providerStoppedBeforeInspection, true); assert.equal(inspectedFiles, true);
  inspectedFiles = false;
  await assert.rejects(runNativeRefusalScenario({ fixtureId: 'fixture', providerId: 'provider', docker: async args => {
    if (args[0] === 'inspect') return JSON.stringify([{ Id: 'provider', State: { Running: true, ExitCode: 0 } }]);
    if (args.at(-1) === 'inspect') inspectedFiles = true;
    return '{}';
  } }));
  assert.equal(inspectedFiles, false);
});
