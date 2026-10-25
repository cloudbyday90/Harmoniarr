/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';
import sharp from 'sharp';
import { createArtworkWorkerService } from '../../src/server/artwork/artwork-worker-service.js';
import { artworkWorkerMemoryEstimate, ARTWORK_WORKER_DATA_LIMIT } from '../../src/server/artwork/artwork-worker-memory.js';
import { artworkWorkerCgroup } from '../../testing/server/artwork-worker-cgroup.js';
import { readDeploymentMemory } from '../../testing/server/deployment-memory-observer.js';

const profile = await artworkWorkerCgroup({ memoryBytes: 3 * 1024 ** 3, cpus: 2, pids: 96 });
test('4096-square RGB WebP still rewrites, strips EXIF and retires its real worker', { timeout: 60_000 }, async t => {
  const before = await readDeploymentMemory();
  const input = await sharp({ create: { width: 4096, height: 4096, channels: 3, background: 'red' } })
    .withExif({ IFD0: { Artist: 'Harmoniarr synthetic WebP control' } }).webp({ quality: 90 }).timeout({ seconds: 10 }).toBuffer();
  const metadata = await sharp(input).metadata(); assert.ok(metadata.exif?.length); assert.equal(metadata.channels, 3);
  const estimate = artworkWorkerMemoryEstimate(metadata, input.length); assert.ok(estimate < ARTWORK_WORKER_DATA_LIMIT);
  const records = []; const worker = createArtworkWorkerService({ spawnFn: (...args) => {
    const child = spawn(...args); const record = { pid: child.pid, closed: false }; records.push(record);
    child.once('close', (code, signal) => Object.assign(record, { closed: true, code, signal })); return child;
  } });
  let grantMetadata;
  const result = await worker.processArtworkBuffer({ buffer: input, maxBytes: 100 * 1024 ** 2, maxDimensionPixels: 8192, signal: t.signal,
    onMetadata: value => { assert.equal(grantMetadata, undefined); grantMetadata = value; } });
  assert.deepEqual(grantMetadata, { stage: 'metadata', format: 'webp', width: 4096, height: 4096, channels: 3, depth: 'uchar' });
  assert.equal(artworkWorkerMemoryEstimate(grantMetadata, input.length), estimate);
  const output = await sharp(result.data).metadata(); assert.equal(output.format, 'webp'); assert.equal(output.width, 4096); assert.equal(output.height, 4096);
  for (const field of ['exif', 'icc', 'xmp']) assert.equal(output[field], undefined);
  assert.equal(records.length, 1); assert.equal(records[0].closed, true); assert.equal(records[0].code, 0); assert.equal(records[0].signal, null);
  assert.throws(() => process.kill(records[0].pid, 0), { code: 'ESRCH' });
  const after = await readDeploymentMemory(); assert.deepEqual(after.events, before.events);
  t.diagnostic(JSON.stringify({ inputBytes: input.length, outputBytes: result.data.length, outputSha256: createHash('sha256').update(result.data).digest('hex'),
    childEstimateBytes: estimate, dataLimitBytes: ARTWORK_WORKER_DATA_LIMIT, retiredChild: true, kernel: after, profileVersion: profile.version }));
});
