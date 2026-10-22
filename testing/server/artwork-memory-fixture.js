/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { finished } from 'node:stream/promises';
import sharp from 'sharp';
import { ARTWORK_WORKER_DATA_LIMIT, assertArtworkWorkerMemoryLimit } from '../../src/server/artwork/artwork-worker-memory.js';
import { transformArtworkBuffer } from '../../src/server/artwork/artwork-image-transform.js';

await assertArtworkWorkerMemoryLimit();
sharp.cache(false); sharp.concurrency(1);
const report = value => process.stderr.write(`${JSON.stringify(value)}\n`);
const limits = await readFile('/proc/self/limits', 'utf8');
assert.match(limits, new RegExp(`^Max data size\\s+${ARTWORK_WORKER_DATA_LIMIT}\\s+${ARTWORK_WORKER_DATA_LIMIT}\\s+bytes`, 'mu'));
let size = 0; const chunks = [];
for await (const chunk of process.stdin) { size += chunk.length; assert.ok(size <= Number(process.argv[2])); chunks.push(chunk); }
const { data, ...projection } = await transformArtworkBuffer({ buffer: Buffer.concat(chunks, size), maxBytes: Number(process.argv[2]), maxDimensionPixels: Number(process.argv[3]) });
report({ kind: 'processed', dataLimitBytes: ARTWORK_WORKER_DATA_LIMIT, maxRssKiB: process.resourceUsage().maxRSS });
process.stdout.write(`${JSON.stringify({ ...projection, size: data.length })}\n`);
process.stdout.end(data); await finished(process.stdout);
if (process.argv[4] === 'allocate') {
  // Real external Buffer allocations, retained and touched. This is an allocation
  // control after valid output, not a reproduced image-decoder vulnerability.
  const retained = []; let allocated = 0; let refused = false;
  try {
    while (allocated < 2 * ARTWORK_WORKER_DATA_LIMIT) {
      retained.push(Buffer.alloc(16 * 1024 * 1024, 1)); allocated += retained.at(-1).length;
    }
  } catch (error) { assert.ok(error instanceof RangeError); refused = true; }
  assert.equal(refused, true, 'Kernel DATA limit must refuse actual allocations');
  report({ kind: 'allocation-refused', allocatedBytes: allocated, dataLimitBytes: ARTWORK_WORKER_DATA_LIMIT,
    retainedBuffers: retained.length, maxRssKiB: process.resourceUsage().maxRSS });
  process.exitCode = 7;
}
