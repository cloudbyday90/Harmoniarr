/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectLosslessWebpContainer } from '../../testing/server/webp-lossless-container.js';
const chunk = (type, bytes) => { const header = Buffer.alloc(8); header.write(type, 'latin1'); header.writeUInt32LE(bytes.length, 4); return Buffer.concat([header, bytes, Buffer.alloc(bytes.length % 2)]); };
const image = (width = 64, height = 32, extraBits = 0) => { const data = Buffer.alloc(5); data[0] = 0x2f; data.writeUInt32LE(((width - 1) | ((height - 1) << 14) | extraBits) >>> 0, 1); return chunk('VP8L', data); };
const canvas = (flags = 8, width = 64, height = 32) => { const data = Buffer.alloc(10); data[0] = flags; data.writeUIntLE(width - 1, 4, 3); data.writeUIntLE(height - 1, 7, 3); return chunk('VP8X', data); };
const riff = (...chunks) => { const payload = Buffer.concat([Buffer.from('WEBP'), ...chunks]); const header = Buffer.alloc(8); header.write('RIFF'); header.writeUInt32LE(payload.length, 4); return Buffer.concat([header, payload]); };

test('simple lossless facts retain geometry without claiming bitstream decoding', () => {
  const facts = inspectLosslessWebpContainer(riff(image()));
  assert.deepEqual(facts, { encoding: 'lossless', width: 64, height: 32, alphaHint: false, extended: false, chunks: ['VP8L'], hasExif: false, hasXmp: false, hasIcc: false, bitstreamDecoded: false });
});
test('extended lossless metadata flags match actual ordered chunks and canvas', () => {
  const facts = inspectLosslessWebpContainer(riff(canvas(0x2c), chunk('ICCP', Buffer.from('icc')), image(), chunk('EXIF', Buffer.from('exif')), chunk('XMP ', Buffer.from('xmp'))));
  assert.equal(facts.extended, true); assert.equal(facts.hasIcc, true); assert.equal(facts.hasExif, true); assert.equal(facts.hasXmp, true);
});
test('every truncated prefix, trailing data and wrong RIFF framing is refused', () => {
  const valid = riff(image());
  for (let length = 0; length < valid.length; length++) assert.throws(() => inspectLosslessWebpContainer(valid.subarray(0, length)), TypeError);
  for (const bytes of [Buffer.concat([valid, Buffer.alloc(2)]), new Uint8Array(valid), Buffer.alloc(26)]) assert.throws(() => inspectLosslessWebpContainer(bytes), TypeError);
  const high = Buffer.from(valid); high[0] |= 0x80; assert.throws(() => inspectLosslessWebpContainer(high), TypeError);
});
test('chunk overflow, nonzero odd padding and high-bit FourCC aliases are refused', () => {
  const overflow = riff(image()); overflow.writeUInt32LE(0xffffffff, 16);
  const padding = riff(image()); padding[padding.length - 1] = 1;
  const high = riff(image()); high[12] |= 0x80;
  for (const bytes of [overflow, padding, high]) assert.throws(() => inspectLosslessWebpContainer(bytes), TypeError);
});
test('duplicate, lossy, animated, alpha and unknown chunks remain outside qualification', () => {
  for (const bytes of [riff(image(), image()), riff(chunk('VP8 ', Buffer.alloc(10))), riff(chunk('ANIM', Buffer.alloc(6)), image()), riff(chunk('ALPH', Buffer.alloc(4)), image()), riff(chunk('JUNK', Buffer.alloc(4)), image())]) assert.throws(() => inspectLosslessWebpContainer(bytes), TypeError);
});
test('VP8L signature, nonzero version, alpha hint and oversized geometry are refused', () => {
  const signature = riff(image()); signature[20] = 0;
  for (const bytes of [signature, riff(image(64, 32, 0x20000000)), riff(image(64, 32, 0x10000000)), riff(image(8193, 32))]) assert.throws(() => inspectLosslessWebpContainer(bytes), TypeError);
});
test('inconsistent flags, reserved fields, canvas and metadata order are refused', () => {
  const reserved = canvas(); reserved[9] = 1;
  for (const bytes of [riff(canvas(), image()), riff(canvas(0), image(), chunk('EXIF', Buffer.from('exif'))), riff(canvas(0x18), image(), chunk('EXIF', Buffer.from('exif'))), riff(canvas(0x09), image(), chunk('EXIF', Buffer.from('exif'))), riff(reserved, image(), chunk('EXIF', Buffer.from('exif'))), riff(canvas(8, 63), image(), chunk('EXIF', Buffer.from('exif'))), riff(image(), canvas(0)), riff(canvas(), chunk('EXIF', Buffer.from('exif')), image()), riff(image(), chunk('EXIF', Buffer.from('exif')))]) assert.throws(() => inspectLosslessWebpContainer(bytes), TypeError);
});
