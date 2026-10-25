/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';
import test from 'node:test';
import { deterministicTiffRows } from '../../testing/server/artwork-noise-source.js';
import { withDeterministicTiff, createMaximumArtworkInput, maximumArtworkCases } from '../../testing/server/artwork-maximum-inputs.js';
import { assertOwnedMaximumArtworkRefusal, classifyMaximumArtworkWorkers } from '../../testing/server/deployment-artwork-bounded-outcome.js';
import { artworkWorkerError, artworkWorkerRefusal } from '../../src/server/artwork/artwork-worker-protocol.js';
import { createArtworkIngestionAdmission } from '../../src/server/artwork/artwork-ingestion-admission.js';

test('TIFF rows are lazy, deterministic and reject unsafe geometry or foreign maximum specs', async () => {
  const a = [...deterministicTiffRows(4, 3)]; const b = [...deterministicTiffRows(4, 3)];
  assert.deepEqual(a, b); assert.equal(a.length, 4); assert.equal(a[0].toString('ascii', 0, 2), 'II'); assert.equal(a[1].length, 12); assert.notDeepEqual(a[1], a[2]);
  for (const size of [0, -1, 1.5, 8193, Infinity]) assert.throws(() => [...deterministicTiffRows(size, 1)], TypeError);
  await assert.rejects(createMaximumArtworkInput({ width: 99999 }), TypeError);
  const cache = sharp.cache(); const concurrency = sharp.concurrency();
  await assert.rejects(createMaximumArtworkInput(maximumArtworkCases[0], { signal: AbortSignal.abort(null) }), error => error === null);
  const restored = sharp.cache(); assert.equal(sharp.concurrency(), concurrency);
  for (const key of ['memory', 'files', 'items']) assert.equal(restored[key].max, cache[key].max);
});
test('owned streamed TIFF is a real decodable file and retires after success or original Error/null', async () => {
  for (const original of [undefined, new Error('original'), null]) {
    let root;
    const work = withDeterministicTiff({ width: 4, height: 33 }, async ({ path, rawBytes, rowBytes }) => {
      root = dirname(path); assert.equal(rawBytes, 396); assert.equal(rowBytes, 12);
      const metadata = await sharp(path).metadata(); assert.equal(metadata.width, 4); assert.equal(metadata.height, 33); assert.equal(metadata.channels, 3);
      assert.equal((await readFile(path)).length, 560);
      assert.deepEqual(await sharp(path).raw().toBuffer(), Buffer.concat([...deterministicTiffRows(4, 33)].slice(1)));
      if (original !== undefined) throw original;
      return 'done';
    });
    if (original === undefined) assert.equal(await work, 'done'); else await assert.rejects(work, error => error === original);
    await assert.rejects(access(root), error => error.code === 'ENOENT');
  }
});
test('maximum outcome refuses unowned failures, malformed data and cancellation while keeping owned admission/worker refusal', async () => {
  for (const reason of ['memory', 'failed', 'timeout']) assert.doesNotThrow(() => assertOwnedMaximumArtworkRefusal(artworkWorkerError(reason)));
  assert.doesNotThrow(() => assertOwnedMaximumArtworkRefusal(artworkWorkerRefusal('artwork_output_too_large')));
  for (const error of [Object.assign(new Error('forged'), { code: 'artwork_worker_failed', status: 503 }),
    Object.assign(new Error('forged'), { code: 'artwork_ingestion_capacity', status: 503 }),
    artworkWorkerError('cancelled'), artworkWorkerRefusal('artwork_image_invalid'), null]) assert.throws(() => assertOwnedMaximumArtworkRefusal(error));
  const gate = createArtworkIngestionAdmission({ concurrency: 1, maxQueued: 0 }); const release = Promise.withResolvers();
  const active = gate.run(() => release.promise);
  try { await assert.rejects(gate.run(() => assert.fail('Refused task must not start')), error => { assertOwnedMaximumArtworkRefusal(error); return true; }); }
  finally { release.resolve(); await active; }
  assert.equal(gate.getMemoryState().reservedBytes, 0);
});

test('native abort containment remains distinct from graceful refusal and unexpected crashes fail', () => {
  const closed = signal => ({ closed: true, code: signal ? null : 1, signal });
  assert.deepEqual(classifyMaximumArtworkWorkers([closed('SIGABRT')], [{ code: 'artwork_worker_failed' }]),
    { containedNativeFailures: 1, timeoutTerminations: 0 });
  assert.deepEqual(classifyMaximumArtworkWorkers([closed(null)], [{ code: 'artwork_worker_memory' }]),
    { containedNativeFailures: 0, timeoutTerminations: 0 });
  assert.deepEqual(classifyMaximumArtworkWorkers([closed('SIGKILL')], [{ code: 'artwork_worker_timeout' }]),
    { containedNativeFailures: 0, timeoutTerminations: 1 });
  for (const signal of ['SIGABRT', 'SIGKILL', 'SIGSEGV']) assert.throws(() => classifyMaximumArtworkWorkers([closed(signal)], []));
  assert.throws(() => classifyMaximumArtworkWorkers([closed('SIGSEGV')], [{ code: 'artwork_worker_failed' }]));
});
