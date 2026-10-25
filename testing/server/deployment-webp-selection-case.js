/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { readPinnedArtworkFile } from './artwork-pinned-file.js';
import { selectWebpSelectionCase } from './webp-selection-cases.js';
import { measureRgb8Error } from './webp-quality-metrics.js';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

/** Preparation is outside the measured interval; all artifact bytes stay pinned. */
export async function prepareDeploymentWebpSelectionCase(id, { signal, verifyPublication } = {}) {
  const selected = selectWebpSelectionCase(id); const input = selected.input;
  const image = await readPinnedArtworkFile({ ...input, root: '/boundary-inputs', signal });
  const metadata = await sharp(image).metadata(); assert.equal(metadata.width, input.width); assert.equal(metadata.height, input.height);
  assert.equal(metadata.format, 'webp'); assert.equal(metadata.hasAlpha, false); assert.ok(metadata.exif?.length);
  const evidence = { id: input.id, inputSha256: input.sha256, inputBytes: image.length, outputBytes: selected.outputBytes,
    outputSha256: selected.outputSha256, lossless: selected.lossless, expectedRefusal: false, pixelError: null };
  return { spec: { id: input.id, width: input.width, height: input.height, format: 'webp', channels: 3, bits: 8 },
    image, contentType: 'image/webp', evidence, verifyPublication,
    async verifyOutput(output) {
      assert.equal(output.length, selected.outputBytes); assert.equal(hash(output), selected.outputSha256);
      const rewritten = await sharp(output).metadata();
      assert.equal(rewritten.format, 'webp'); assert.equal(rewritten.width, input.width); assert.equal(rewritten.height, input.height);
      for (const key of ['exif', 'icc', 'xmp']) assert.equal(rewritten[key], undefined);
      if (selected.lossless) {
        evidence.pixelError = measureRgb8Error(await sharp(image).raw().toBuffer(), await sharp(output).raw().toBuffer());
        assert.equal(evidence.pixelError.identical, true);
      }
    },
  };
}
