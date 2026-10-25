/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkWebpRewriteService } from '../../src/server/artwork/artwork-webp-rewrite-service.js';
import { isArtworkWorkerError, ARTWORK_WORKER_OUTPUT_LIMIT } from '../../src/server/artwork/artwork-worker-protocol.js';
const output = size => ({ data: Buffer.alloc(size), info: { format: 'webp', width: 64, height: 32, channels: 3 } });
const options = { buffer: Buffer.from('input'), maxDimensionPixels: 8192 };

test('sequential rewrites keep the baseline while comparing actual sizes and prefer lossless ties', async () => {
  for (const [baselineSize, candidateSize, expected] of [[10, 8, true], [8, 10, false], [8, 8, true]]) {
    const results = [output(baselineSize), output(candidateSize)]; const calls = []; let active = 0;
    const service = createArtworkWebpRewriteService({ now: () => 0, encodeFn: async request => { assert.equal(active++, 0); calls.push(request); await Promise.resolve(); active--; return results[calls.length - 1]; } });
    assert.equal(await service.rewrite(options), results[expected ? 1 : 0]); assert.deepEqual(calls.map(row => row.lossless), [false, true]);
  }
});
test('both encodes consume one deadline including elapsed queue and JavaScript time', async () => {
  let clock = 0; const seconds = [];
  const service = createArtworkWebpRewriteService({ now: () => clock, encodeFn: async request => { seconds.push(request.seconds); clock += request.lossless ? 1000 : 3500; return output(5); } });
  await service.rewrite(options); assert.deepEqual(seconds, [10, 6]);
});
test('insufficient remaining time or late completion cannot return a baseline or start a retry', async () => {
  for (const elapsed of [9001, 10000]) {
    let clock = 0; let calls = 0; const service = createArtworkWebpRewriteService({ now: () => clock, encodeFn: async () => { calls++; clock = elapsed; return output(5); } });
    await assert.rejects(service.rewrite(options), isArtworkWorkerError); assert.equal(calls, 1);
  }
  let clock = 0; let calls = 0; const late = createArtworkWebpRewriteService({ now: () => clock, encodeFn: async () => { if (++calls === 2) clock = 10000; return output(5); } });
  await assert.rejects(late.rewrite(options), isArtworkWorkerError); assert.equal(calls, 2);
});
test('either native failure remains an owned capacity error with no private details', async () => {
  for (const failAt of [1, 2]) {
    let calls = 0; const service = createArtworkWebpRewriteService({ now: () => 0, encodeFn: async () => { if (++calls === failAt) throw new Error('private native detail'); return output(5); } });
    await assert.rejects(service.rewrite(options), error => isArtworkWorkerError(error) && error.status === 503 && !error.message.includes('private') && !error.cause);
    assert.equal(calls, failAt);
  }
});
test('empty, excessive, mismatched and unsupported native results cannot be selected', async () => {
  const huge = output(1); Object.defineProperty(huge.data, 'length', { value: ARTWORK_WORKER_OUTPUT_LIMIT + 1 });
  for (const invalid of [output(0), huge, { ...output(1), info: { format: 'png', width: 64, height: 32, channels: 3 } }, { ...output(1), info: { format: 'webp', width: 1025, height: 32, channels: 3 } }, { ...output(1), info: { format: 'webp', width: 63, height: 32, channels: 3 } }]) {
    let calls = 0; const service = createArtworkWebpRewriteService({ now: () => 0, encodeFn: async () => ++calls === 1 ? output(5) : invalid });
    await assert.rejects(service.rewrite(options), isArtworkWorkerError);
  }
});
test('invalid inputs, dependency clocks and backward time cannot silently disable the deadline', async () => {
  assert.throws(() => createArtworkWebpRewriteService({ encodeFn: null }), TypeError);
  for (const now of [() => NaN, (() => { let calls = 0; return () => ++calls === 1 ? 10 : 0; })()]) await assert.rejects(createArtworkWebpRewriteService({ now, encodeFn: async () => assert.fail('No encode') }).rewrite(options), isArtworkWorkerError);
  await assert.rejects(createArtworkWebpRewriteService().rewrite({ buffer: Buffer.alloc(1024 ** 2 + 1) }), isArtworkWorkerError);
});
