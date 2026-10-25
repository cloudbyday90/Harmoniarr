/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import sharp from 'sharp';
import { boundaryArtworkCases } from './artwork-boundary-cases.js';
import { withDeterministicTiff } from './artwork-maximum-inputs.js';
import { readPinnedArtworkFile } from './artwork-pinned-file.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

/** Explicit opt-in preparation; creates a fresh directory and never replaces it. */
export async function prepareBoundaryArtworkInputs({ root, signal }) {
  if (typeof root !== 'string' || !isAbsolute(root)) throw new TypeError('Use an absolute fresh fixture directory');
  signal?.throwIfAborted(); assert.equal(sharp.versions.sharp, '0.35.5'); assert.equal(sharp.versions.vips, '8.18.7');
  await mkdir(root, { mode: 0o700 });
  const cache = sharp.cache(); const concurrency = sharp.concurrency(); sharp.cache(false); sharp.concurrency(1);
  const inputs = await withWorkerTaskCleanup(() => withDeterministicTiff({ width: 8192, height: 8192, signal }, async ({ path }) => {
    const result = [];
    for (const spec of boundaryArtworkCases) {
      signal?.throwIfAborted(); let image = sharp(path, { sequentialRead: true, limitInputPixels: 8192 ** 2 });
      image = spec.format === 'jpeg' ? image.withExif({ IFD0: { Artist: 'Harmoniarr synthetic admitted' } }).jpeg({ quality: spec.quality })
        : image.webp({ quality: spec.quality, effort: 4 });
      const info = await image.timeout({ seconds: 60 }).toFile(join(root, spec.fileName));
      await readPinnedArtworkFile({ root, ...spec, signal });
      result.push({ id: spec.id, inputBytes: spec.inputBytes, sha256: spec.sha256, quality: spec.quality, info });
    }
    return result;
  }), () => { sharp.cache({ memory: cache.memory.max, files: cache.files.max, items: cache.items.max }); sharp.concurrency(concurrency); });
  const evidence = { versions: sharp.versions, inputs, rawSourceRemoved: true, encoderCache: false, encoderConcurrency: 1 };
  await writeFile(join(root, 'preparation.json'), JSON.stringify(evidence, null, 2), { flag: 'wx', signal });
  return evidence;
}
