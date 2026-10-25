/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { artworkCorpusCases, createArtworkCorpusInput } from './artwork-corpus-inputs.js';
import { maximumArtworkCases, createMaximumArtworkInput } from './artwork-maximum-inputs.js';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function selectDeploymentArtworkCase(id) {
  const spec = [...artworkCorpusCases, ...maximumArtworkCases].find(item => item.id === id);
  if (!spec) throw new TypeError('Select an owned deployment artwork case');
  return spec;
}
/** Reuse the fixed corpus; large refusal cases never decode pixels in the parent. */
export async function prepareDeploymentArtworkCase(id, { signal } = {}) {
  const spec = selectDeploymentArtworkCase(id);
  const generated = spec.boundedOutcome ? await createMaximumArtworkInput(spec, { signal }) : { image: await createArtworkCorpusInput(spec) };
  const { image } = generated;
  const metadata = await sharp(image, { limitInputPixels: 8192 ** 2 }).metadata();
  assert.equal(metadata.width, spec.width); assert.equal(metadata.height, spec.height); assert.equal(metadata.channels, spec.channels);
  assert.equal(metadata.depth, spec.bits === 16 ? 'ushort' : 'uchar');
  if (spec.format === 'png') assert.equal(metadata.bitsPerSample, spec.bits);
  if (spec.format === 'jpeg') assert.ok(metadata.exif?.length);
  if (spec.noise && spec.format === 'png') assert.ok(image.length > spec.width * spec.height * spec.channels * spec.bits / 8);
  let canonicalPixels;
  return { spec, image, contentType: `image/${spec.format}`,
    evidence: { id: spec.id, width: spec.width, height: spec.height, inputBits: spec.bits, channels: spec.channels,
      inputBytes: image.length, expectedRefusal: Boolean(spec.refuse), ...(generated.generation ? { generation: generated.generation, boundedOutcome: true } : {}) },
    async verifyOutput(output) {
      assert.ok(!spec.refuse, 'Capacity refusal cannot publish output');
      const rewritten = await sharp(output).metadata();
      assert.equal(rewritten.format, spec.format); assert.equal(rewritten.width, spec.width); assert.equal(rewritten.height, spec.height);
      assert.equal(rewritten.depth, 'uchar'); assert.equal(rewritten.hasAlpha, spec.channels === 4);
      for (const field of ['exif', 'icc', 'xmp']) assert.equal(rewritten[field], undefined);
      if (spec.format === 'png') {
        assert.equal(rewritten.bitsPerSample, 8);
        canonicalPixels ??= sharp(image).raw().toBuffer().then(hash);
        assert.equal(hash(await sharp(output).raw().toBuffer()), await canonicalPixels, 'Preserve canonical decoded eight-bit pixels');
      }
    },
  };
}
