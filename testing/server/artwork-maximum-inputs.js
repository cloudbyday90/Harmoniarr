/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createWriteStream } from 'node:fs';
import { access, mkdtemp, rm, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import sharp from 'sharp';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import { deterministicTiffRows, rawNoiseBytes } from './artwork-noise-source.js';

export const maximumArtworkCases = Object.freeze(['jpeg', 'webp'].map(format => Object.freeze({
  id: `rgb8-${format}-maximum-noise`, width: 8192, height: 8192, channels: 3, bits: 8, format, noise: true, boundedOutcome: true,
})));
export async function withDeterministicTiff({ width, height, signal }, work) {
  const rawBytes = rawNoiseBytes(width, height); signal?.throwIfAborted();
  const parent = resolve(tmpdir()); const root = await mkdtemp(join(parent, 'harmoniarr-max-artwork-')); const path = join(root, 'input.tiff');
  const result = await withWorkerTaskCleanup(async () => {
    await pipeline(Readable.from(deterministicTiffRows(width, height), { objectMode: false, highWaterMark: 64 * 1024 }),
      createWriteStream(path, { flags: 'wx', highWaterMark: 64 * 1024 }), { signal });
    assert.equal((await stat(path)).size, rawBytes + 140 + Math.ceil(height / 16) * 8);
    return work({ path, rawBytes, rowBytes: width * 3 });
  }, async () => {
    assert.equal(dirname(root), parent); assert.ok(basename(root).startsWith('harmoniarr-max-artwork-'));
    await rm(root, { recursive: true, force: true });
  });
  await assert.rejects(access(root), error => error.code === 'ENOENT');
  return result;
}
/** The fixed encoder has separate fixture bounds; production deadlines stay intact. */
export async function createMaximumArtworkInput(spec, { signal } = {}) {
  if (!maximumArtworkCases.includes(spec)) throw new TypeError('Use a fixed maximum artwork case');
  const cache = sharp.cache(); const concurrency = sharp.concurrency(); sharp.cache(false); sharp.concurrency(1);
  return withWorkerTaskCleanup(() => withDeterministicTiff({ ...spec, signal }, async ({ path, rawBytes, rowBytes }) => {
    let encoder = sharp(path, { sequentialRead: true, limitInputPixels: 8192 ** 2 });
    encoder = spec.format === 'jpeg' ? encoder.withExif({ IFD0: { Artist: 'Harmoniarr synthetic maximum' } }).jpeg({ quality: 90 })
      : encoder.webp({ quality: 90, effort: 4 });
    encoder.timeout({ seconds: 60 }); const chunks = []; let bytes = 0;
    await pipeline(encoder, async source => {
      for await (const chunk of source) { bytes += chunk.length; if (bytes > 100 * 1024 ** 2) throw new RangeError('Maximum fixture exceeds encoded byte policy'); chunks.push(chunk); }
    }, { signal });
    assert.ok(bytes > 20 * 1024 ** 2, 'Require a substantial fixed noisy encoded input');
    return { image: chunks.length === 1 ? chunks[0] : Buffer.concat(chunks, bytes), generation: {
      source: 'row-streamed-tiff', rawBytes, rowBytes, streamHighWaterMark: 64 * 1024, encodedBytes: bytes,
      encoderConcurrency: 1, encoderCache: false, sourceRemovedBeforeWork: true,
    } };
  }), () => { sharp.cache({ memory: cache.memory.max, files: cache.files.max, items: cache.items.max }); sharp.concurrency(concurrency); });
}
