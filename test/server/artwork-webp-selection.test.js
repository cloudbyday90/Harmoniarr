/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { canReserveArtworkWebpSelection, shouldSelectArtworkWebpOutput } from '../../src/server/artwork/artwork-webp-selection-policy.js';
import { artworkWorkerMemoryEstimate, ARTWORK_WORKER_DATA_LIMIT } from '../../src/server/artwork/artwork-worker-memory.js';
import { decodedArtworkMemoryReservation, initialArtworkMemoryReservation } from '../../src/server/artwork/artwork-memory-reservation.js';
import { createArtworkIngestionAdmission } from '../../src/server/artwork/artwork-ingestion-admission.js';
import { createArtworkSessionCollector, artworkWorkerMetadata } from '../../src/server/artwork/artwork-worker-session-protocol.js';
import { createArtworkWorkerService } from '../../src/server/artwork/artwork-worker-service.js';
import { transformArtworkBuffer } from '../../src/server/artwork/artwork-image-transform.js';
import { isArtworkWorkerError } from '../../src/server/artwork/artwork-worker-protocol.js';

const metadata = { format: 'webp', width: 64, height: 32, channels: 3, depth: 'uchar', space: 'srgb', hasProfile: false, hasAlpha: false };
// Structural header fixture only. Native tests use complete pinned bitstreams.
const input = Buffer.from('5249464612000000574542505650384c050000002f3fc0070000', 'hex');
const frame = value => Buffer.from(`${JSON.stringify(value)}\n`);

test('selection requires decoder-confirmed opaque sRGB and matching bounded lossless facts', () => {
  assert.equal(shouldSelectArtworkWebpOutput(input, metadata), true);
  for (const delta of [{ format: 'jpeg' }, { width: 1025 }, { depth: 'ushort' }, { channels: 4 }, { hasAlpha: true }, { hasAlpha: undefined }, { hasProfile: true }, { hasProfile: undefined }, { space: 'cmyk' }, { orientation: 6 }, { pages: 2 }, { autoOrient: { width: 32, height: 64 } }, { width: 63 }]) assert.equal(shouldSelectArtworkWebpOutput(input, { ...metadata, ...delta }), false);
  assert.equal(shouldSelectArtworkWebpOutput(Buffer.alloc(1024 ** 2 + 1), metadata), false);
  assert.equal(shouldSelectArtworkWebpOutput(Buffer.from('unrecognized'), metadata), false);
  assert.equal(canReserveArtworkWebpSelection({ ...metadata, width: 1024, height: 1024 }, 1024 ** 2), true);
  assert.equal(canReserveArtworkWebpSelection(metadata, 1024 ** 2 + 1), false);
});
test('selected jobs cover the full child envelope and do not shrink the parent reservation', () => {
  const selected = { ...metadata, webpSelection: true };
  assert.equal(artworkWorkerMemoryEstimate(selected, input.length), ARTWORK_WORKER_DATA_LIMIT);
  assert.equal(decodedArtworkMemoryReservation(selected, input.length), initialArtworkMemoryReservation(input.length));
  assert.ok(decodedArtworkMemoryReservation(metadata, input.length) < initialArtworkMemoryReservation(input.length));
  for (const bad of [{ ...selected, width: 1025 }, { ...selected, depth: 'unknown' }, { ...selected, webpSelection: false }]) assert.throws(() => artworkWorkerMemoryEstimate(bad, input.length), { code: 'artwork_worker_memory' });
});
test('selection metadata waits for grant and chooses its sanitizer only after admission', async () => {
  const granted = Promise.withResolvers(); const seen = [];
  const pending = transformArtworkBuffer({ buffer: input, maxDimensionPixels: 8192, onMetadata: async value => { assert.equal(value.webpSelection, true); seen.push('metadata'); await granted.promise; } }, {
    inspectArtworkBufferFn: async () => metadata,
    sanitizeArtworkBufferFn: async options => { assert.equal(options.webpSelection, true); seen.push('rewrite'); return { data: Buffer.from('output'), info: { width: 64, height: 32 } }; },
    sharpStatsFn: async () => ({ dominant: null }),
  });
  await new Promise(resolve => { setImmediate(resolve); }); assert.deepEqual(seen, ['metadata']); granted.resolve(); await pending; assert.deepEqual(seen, ['metadata', 'rewrite']);
});
test('full selection reservations serialize queued work through the publication hold', async () => {
  const gate = createArtworkIngestionAdmission(); const held = Promise.withResolvers(); const ready = Promise.withResolvers(); let second = false;
  const first = gate.run(async reservation => { reservation.onMetadata({ ...metadata, webpSelection: true }); ready.resolve(); await held.promise; }, { inputBytes: input.length });
  await ready.promise; const next = gate.run(() => { second = true; }, { inputBytes: input.length });
  await new Promise(resolve => { setImmediate(resolve); }); assert.equal(second, false); assert.equal(gate.getState().queued, 1);
  assert.equal(gate.getMemoryState().reservedBytes, initialArtworkMemoryReservation(input.length));
  held.resolve(); await Promise.all([first, next]); assert.equal(second, true); assert.equal(gate.getMemoryState().reservedBytes, 0);
});
test('selection metadata accepts only explicit true on bounded WebP geometry', () => {
  const header = artworkWorkerMetadata({ ...metadata, webpSelection: true }); let observed;
  createArtworkSessionCollector(8192, value => { observed = value; }).push(frame(header)); assert.deepEqual(observed, header);
  for (const delta of [{ webpSelection: false }, { webpSelection: 'true' }, { format: 'jpeg' }, { width: 1025 }, { channels: 4 }, { extra: true }]) assert.throws(() => createArtworkSessionCollector(8192, () => assert.fail('No grant')).push(frame({ ...header, ...delta })), isArtworkWorkerError);
  assert.throws(() => artworkWorkerMetadata({ ...metadata, webpSelection: false }), isArtworkWorkerError);
});
test('parent refuses a selection claim exceeding the actual input-byte cap before grant', async () => {
  let killed = false; let granted = false;
  const worker = createArtworkWorkerService({ spawnFn: () => {
    const child = new EventEmitter(); child.stdin = new PassThrough(); child.stdout = new PassThrough();
    child.kill = () => { killed = true; queueMicrotask(() => child.emit('close', null, 'SIGKILL')); };
    queueMicrotask(() => child.stdout.write(frame(artworkWorkerMetadata({ ...metadata, webpSelection: true })))); return child;
  } });
  await assert.rejects(worker.processArtworkBuffer({ buffer: Buffer.alloc(1024 ** 2 + 1), maxBytes: 2 * 1024 ** 2, onMetadata: () => { granted = true; } }), isArtworkWorkerError);
  assert.equal(killed, true); assert.equal(granted, false);
});
