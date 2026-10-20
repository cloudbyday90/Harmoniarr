/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { Writable } from 'node:stream';
import { createHash } from 'node:crypto';
import { createNativeResumePolicy, nativeResumePlans } from '../../testing/slskd/native-resume-policy.js';
import { createPeerInput } from '../../testing/slskd/peer-input.js';
import { wireInteger, wireString } from '../../testing/slskd/wire-codec.js';
import { writeNativeFileRange } from '../../testing/slskd/native-file-sender.js';
import { nativeFileChunk, nativeFileDigest } from '../../testing/slskd/native-file-data.js';
import { sendNativeResume } from '../../testing/slskd/native-resume-transfer.js';
import { runNativeResumeScenario } from '../../testing/slskd/native-resume-runner.js';

function handshake(offset) {
  const body = Buffer.concat([Buffer.from([1]), wireString('owned'), wireString('F'), wireInteger(42)]);
  const raw = Buffer.alloc(12); raw.writeUInt32LE(42); raw.writeBigUInt64LE(offset, 4);
  return Buffer.concat([wireInteger(body.length), body, raw]);
}

test('resume parser preserves fragmented offsets and refuses them outside the explicit capability', () => {
  const expected = 32791n; const bytes = handshake(expected);
  for (let split = 0; split <= bytes.length; split++) {
    const calls = [];
    const input = createPeerInput({ username: 'owned', onInit() {}, onMessage() {},
      acceptOffset: (token, offset) => token === 42 && offset === expected, onTransfer: (...args) => calls.push(args) });
    input.push(bytes.subarray(0, split)); input.push(bytes.subarray(split)); input.end();
    assert.deepEqual(calls, [[42, Number(expected)]]);
    assert.throws(() => input.push(Buffer.from([0])), RangeError);
  }
  for (const offset of [expected, BigInt(Number.MAX_SAFE_INTEGER) + 1n]) {
    const input = createPeerInput({ username: 'owned', onInit() {}, onMessage() {}, onTransfer() { assert.fail('Unowned offset dispatched'); } });
    assert.throws(() => input.push(handshake(offset)), /Invalid transfer token or offset/u);
  }
});

test('resume capabilities require first send and actual close, refuse replays and bound total native invocations', () => {
  const policy = createNativeResumePolicy(); const filename = nativeResumePlans[0].file.filename;
  assert.throws(() => policy.reserve(1, '../unowned'));
  const first = policy.reserve(1, filename);
  assert.throws(() => policy.start(1, 0)); policy.claim(1);
  assert.throws(() => policy.claim(1)); assert.equal(policy.acceptOffset(1, 1n), false);
  policy.start(1, 0); assert.throws(() => policy.start(1, 0)); assert.throws(() => policy.reserve(2, filename));
  first.sent = true; assert.throws(() => policy.reserve(2, filename));
  first.closed = true;
  const second = policy.reserve(2, filename); policy.claim(2);
  for (const offset of [0n, 16383n, BigInt(second.plan.bytes + 1)]) assert.equal(policy.acceptOffset(2, offset), false);
  assert.equal(policy.acceptOffset(2, BigInt(second.plan.bytes)), true);
  policy.start(2, second.plan.bytes); second.sent = true; second.closed = true;
  assert.throws(() => policy.reserve(3, filename)); assert.throws(() => policy.reserve(1, nativeResumePlans[1].file.filename));
});

test('range sender emits exact nonzero suffixes, preserves backpressure and refuses invalid bounds before writes', async () => {
  const file = nativeResumePlans[1].file; const start = 32791; const chunks = []; const held = Promise.withResolvers(); let release;
  const target = new Writable({ highWaterMark: 1, write(chunk, encoding, callback) {
    chunks.push(Buffer.from(chunk)); if (chunks.length === 1) { release = callback; held.resolve(); } else callback();
  } });
  let done = false; const work = writeNativeFileRange(target, file, start).then(() => { done = true; });
  await held.promise; assert.equal(done, false); release(); await work;
  const bytes = Buffer.concat(chunks); const expected = [];
  for (let offset = start; offset < file.size; offset += 16384) expected.push(nativeFileChunk(file, offset, Math.min(16384, file.size - offset)));
  assert.deepEqual(bytes, Buffer.concat(expected)); assert.equal(target.writableEnded, false); target.destroy();
  for (const [invalidStart, invalidEnd] of [[-1, 2], [0, 0], [file.size, file.size], [0, file.size + 1], [0.1, 5]]) {
    await assert.rejects(writeNativeFileRange({ write() { assert.fail('Invalid range wrote bytes'); } }, file, invalidStart, invalidEnd), TypeError);
  }
});

for (const reason of [new Error('owned cancellation'), null]) {
  test('held prefix inspection drains cancellation and preserves ' + (reason === null ? 'null' : 'Error'), async () => {
    const entered = Promise.withResolvers(); const released = Promise.withResolvers(); const abort = new AbortController();
    const record = { plan: nativeResumePlans[1], attempt: 2 }; let settled = false;
    const work = sendNativeResume({ write() { assert.fail('Cancelled resume wrote'); } }, record, 32791, { signal: abort.signal,
      inspect: async () => { entered.resolve(); await released.promise; return { size: 32791 }; } }).then(
      () => assert.fail('Cancelled resume succeeded'), error => { assert.equal(error, reason); settled = true; });
    await entered.promise; abort.abort(reason); await Promise.resolve(); assert.equal(settled, false);
    released.resolve(); await work;
  });
}

test('resume refuses offset mismatch before sends and hashes the accepted prefix alongside exact suffix output', async () => {
  const plan = nativeResumePlans[0]; const offset = plan.bytes; const record = { plan, attempt: 2 };
  await assert.rejects(sendNativeResume({ write() { assert.fail('Mismatched prefix wrote'); } }, record, offset,
    { inspect: async () => ({ size: offset - 1 }) }), /actual verified incomplete file/u);
  let reads = 0; const controller = new AbortController(); controller.abort(null);
  await assert.rejects(sendNativeResume({}, record, offset, { signal: controller.signal, inspect: async () => { reads++; } }), error => error === null);
  assert.equal(reads, 0);
  const chunks = []; const target = new Writable({ write(chunk, encoding, callback) { chunks.push(chunk); callback(); } });
  const proof = await sendNativeResume(target, record, offset, { inspect: async () => ({
    size: offset, sha256: nativeFileDigest(plan.file, offset), identityStable: true }) });
  assert.equal(proof.offset, offset); assert.equal(proof.emittedBytes, 1); assert.equal(proof.prefixIdentityStable, true);
  assert.equal(createHash('sha256').update(Buffer.concat(chunks)).digest('hex'),
    createHash('sha256').update(nativeFileChunk(plan.file, offset, 1)).digest('hex')); target.destroy();
});

test('resume final inspection waits for acknowledged provider stop and refuses an active writer', async () => {
  const entered = Promise.withResolvers(); const release = Promise.withResolvers(); let inspectedFiles = false;
  const docker = async args => {
    if (args[0] === 'stop') { entered.resolve(); await release.promise; return ''; }
    if (args[0] === 'inspect') return JSON.stringify([{ Id: 'provider', State: { Running: false, ExitCode: 0 } }]);
    const phase = args.at(-1);
    if (phase === 'inspect') inspectedFiles = true;
    return JSON.stringify(phase === 'retire' ? { nativeDownloadsRetired: true } : {});
  };
  const work = runNativeResumeScenario({ docker, fixtureId: 'fixture', providerId: 'provider' });
  await entered.promise; assert.equal(inspectedFiles, false); release.resolve();
  assert.equal((await work).providerStoppedBeforeInspection, true); assert.equal(inspectedFiles, true);
  await assert.rejects(runNativeResumeScenario({ fixtureId: 'fixture', providerId: 'provider', docker: async args =>
    args[0] === 'inspect' ? JSON.stringify([{ Id: 'provider', State: { Running: true, ExitCode: 0 } }]) : '{}' }));
});
