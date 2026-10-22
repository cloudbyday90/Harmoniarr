/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { crc32 } from 'node:zlib';
import sharp from 'sharp';

/** Exact maximum bytes with real ancillary CRCs; not pixel-complexity stress. */
export async function maximumByteArtworkPng(maxBytes) {
  const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).png().toBuffer();
  const input = Buffer.alloc(maxBytes); png.copy(input, 0, 0, png.length - 12);
  let offset = png.length - 12;
  const count = Math.ceil((maxBytes - png.length) / (1024 * 1024 + 12));
  let remaining = maxBytes - png.length - count * 12;
  for (let index = 0; index < count; index++) {
    const length = Math.min(1024 * 1024, remaining); remaining -= length;
    input.writeUInt32BE(length, offset); input.write('haRm', offset + 4, 'ascii');
    input.writeUInt32BE(crc32(input.subarray(offset + 4, offset + 8 + length)), offset + 8 + length);
    offset += length + 12;
  }
  assert.equal(offset, maxBytes - 12); png.copy(input, offset, png.length - 12);
  return { input, png };
}
