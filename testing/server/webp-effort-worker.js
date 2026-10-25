/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { finished } from 'node:stream/promises';
import sharp from 'sharp';
import { createArtworkWorkerSession } from '../../src/server/artwork/artwork-worker-session.js';
import { assertArtworkWorkerMemoryLimit } from '../../src/server/artwork/artwork-worker-memory.js';
import { artworkSharpInputOptions } from '../../src/server/artwork/artwork-image-content-policy.js';
import { ARTWORK_WORKER_OUTPUT_LIMIT } from '../../src/server/artwork/artwork-worker-protocol.js';
import { selectWebpEffortCase, webpEffortInput } from './webp-effort-cases.js';

// Test-only encoder comparison. No application admission/publication authority.
sharp.cache(false); sharp.concurrency(1);
let started = null; let encodeMs = null; let outcome = 'failed'; let outputBytes = 0;
try {
  assert.equal(process.platform, 'linux'); await assertArtworkWorkerMemoryLimit();
  const spec = selectWebpEffortCase(Number(process.argv[5]), process.argv[6]);
  const input = spec.input ?? webpEffortInput;
  const maxBytes = Number(process.argv[2]); const maxDimensionPixels = Number(process.argv[3]);
  assert.equal(maxBytes, ARTWORK_WORKER_OUTPUT_LIMIT); assert.equal(maxDimensionPixels, 8192);
  const session = createArtworkWorkerSession({ inputBytes: Number(process.argv[4]), maxBytes });
  const buffer = await session.readInput(); assert.equal(buffer.length, input.inputBytes);
  assert.equal(createHash('sha256').update(buffer).digest('hex'), input.sha256);
  const options = artworkSharpInputOptions(maxDimensionPixels); const metadata = await sharp(buffer, options).metadata();
  assert.equal(metadata.width, input.width); assert.equal(metadata.height, input.height); assert.equal(metadata.channels, 3); assert.ok(metadata.exif?.length);
  await session.requestGrant({ format: 'webp', width: spec.width, height: spec.height, channels: 3, depth: 'uchar' });
  let image = sharp(buffer, options).rotate(); if (spec.crop) image = image.extract(spec.crop);
  started = performance.now();
  const { data, info } = await image.webp({ quality: spec.quality, effort: spec.effort }).timeout({ seconds: 10 }).toBuffer({ resolveWithObject: true });
  encodeMs = performance.now() - started; assert.ok(data.length > 0 && data.length <= ARTWORK_WORKER_OUTPUT_LIMIT);
  assert.equal(info.width, spec.width); assert.equal(info.height, spec.height);
  outcome = 'success'; outputBytes = data.length;
  process.stdout.write(`${JSON.stringify({ format: 'webp', width: info.width, height: info.height, dominant: null, size: data.length })}\n`);
  process.stdout.end(data); await finished(process.stdout);
} catch {
  encodeMs ??= started === null ? null : performance.now() - started;
  process.exitCode = 1; process.stdout.end('{"failure":"failed"}\n'); await finished(process.stdout).catch(() => {});
} finally {
  process.stderr.write(`${JSON.stringify({ comparison: true, outcome, started: started !== null, encodeMs,
    outputBytes, maxRssKiB: process.resourceUsage().maxRSS })}\n`);
  process.stdin.destroy();
}
