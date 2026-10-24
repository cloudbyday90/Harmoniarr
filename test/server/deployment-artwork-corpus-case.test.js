/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { selectDeploymentArtworkCase, prepareDeploymentArtworkCase } from '../../testing/server/deployment-artwork-corpus-case.js';

test('native corpus selection refuses missing/foreign selectors before image generation', async () => {
  for (const value of [undefined, null, '', {}, 'unbounded-custom-image']) {
    assert.throws(() => selectDeploymentArtworkCase(value), TypeError);
    await assert.rejects(prepareDeploymentArtworkCase(value), TypeError);
  }
  assert.equal(selectDeploymentArtworkCase('rgba16-png-policy-refusal').refuse, true);
});
test('corpus verification accepts canonical eight-bit pixels and refuses altered pixels or retained metadata', async () => {
  const png = await prepareDeploymentArtworkCase('rgba16-png-noise');
  assert.equal(png.evidence.inputBits, 16); assert.equal(png.evidence.channels, 4);
  await png.verifyOutput(await sharp(png.image).png().toBuffer());
  await assert.rejects(png.verifyOutput(await sharp(png.image).negate().png().toBuffer()), /canonical decoded/u);
  const jpeg = await prepareDeploymentArtworkCase('rgb8-jpeg-noise');
  await jpeg.verifyOutput(await sharp(jpeg.image).jpeg().toBuffer());
  await assert.rejects(jpeg.verifyOutput(jpeg.image));
});
