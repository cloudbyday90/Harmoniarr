/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import sharp from 'sharp';
import { webpArtworkInputs } from './webp-artwork-corpus.js';
import { createWebpCorpusPixels } from './webp-artwork-corpus-pixels.js';
import { readPinnedArtworkFile } from './artwork-pinned-file.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

/** Offline preparation only: original downloads are separately pinned and read-only. */
export async function prepareWebpArtworkCorpus({ root, sourcesRoot, signal }) {
  if (![root, sourcesRoot].every(path => typeof path === 'string' && isAbsolute(path))) throw new TypeError('Use absolute fresh output and source directories');
  signal?.throwIfAborted(); assert.equal(sharp.versions.sharp, '0.35.5'); assert.equal(sharp.versions.vips, '8.18.7');
  await mkdir(root, { mode: 0o700 }); const cache = sharp.cache(); const concurrency = sharp.concurrency();
  sharp.cache(false); sharp.concurrency(1);
  return withWorkerTaskCleanup(async () => {
    const inputs = [];
    for (const spec of webpArtworkInputs) {
      signal?.throwIfAborted(); let image;
      if (spec.source) {
        const original = await readPinnedArtworkFile({ ...spec.source, root: sourcesRoot, signal });
        image = sharp(original, { limitInputPixels: 8192 ** 2, failOn: 'warning' }).rotate()
          .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).toColourspace('srgb').removeAlpha();
      } else {
        const { data, ...raw } = createWebpCorpusPixels(spec.id); image = sharp(data, { raw });
      }
      const data = await image.withExif({ IFD0: { Artist: 'Harmoniarr WebP artwork corpus' } })
        .webp({ lossless: true, effort: 4 }).timeout({ seconds: 10 }).toBuffer();
      await writeFile(join(root, spec.fileName), data, { flag: 'wx', signal });
      await readPinnedArtworkFile({ root, ...spec, signal });
      const metadata = await sharp(data).metadata();
      assert.deepEqual([metadata.width, metadata.height, metadata.channels, metadata.depth], [spec.width, spec.height, 3, 'uchar']);
      inputs.push({ id: spec.id, inputBytes: data.length, sha256: spec.sha256 });
    }
    const evidence = { versions: sharp.versions, inputs, networkRequired: false, reference: 'lossless prepared decoded RGB8, not original camera pixels' };
    await writeFile(join(root, 'preparation.json'), JSON.stringify(evidence, null, 2), { flag: 'wx', signal }); return evidence;
  }, () => { sharp.cache({ memory: cache.memory.max, files: cache.files.max, items: cache.items.max }); sharp.concurrency(concurrency); });
}
