/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const fail = () => { throw new TypeError('Unsupported or inconsistent opaque lossless WebP layout'); };
const supported = new Set(['VP8X', 'ICCP', 'VP8L', 'EXIF', 'XMP ']);

/** Narrow structural facts only; native decoding remains mandatory. */
export function inspectOpaqueLosslessWebpContainer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 26 || buffer.length > 100 * 1024 ** 2
    || buffer.toString('latin1', 0, 4) !== 'RIFF' || buffer.toString('latin1', 8, 12) !== 'WEBP'
    || buffer.readUInt32LE(4) + 8 !== buffer.length || buffer.length % 2) fail();
  const chunks = []; const seen = new Set(); let offset = 12; let canvas = null; let image = null; let flags = 0;
  while (offset < buffer.length) {
    if (chunks.length >= 128 || offset + 8 > buffer.length) fail();
    const type = buffer.toString('latin1', offset, offset + 4); const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8; const end = start + size; const next = end + size % 2;
    if (!supported.has(type) || seen.has(type) || next > buffer.length || (size % 2 && buffer[end] !== 0)) fail();
    if (type === 'VP8X') {
      if (offset !== 12 || size !== 10) fail(); flags = buffer[start];
      if ((flags & ~0x2c) || buffer.readUIntLE(start + 1, 3) !== 0) fail();
      canvas = { width: buffer.readUIntLE(start + 4, 3) + 1, height: buffer.readUIntLE(start + 7, 3) + 1 };
    } else if (type === 'VP8L') {
      if (size < 5 || buffer[start] !== 0x2f || (chunks.length && !canvas)) fail();
      const bits = buffer.readUInt32LE(start + 1);
      if (bits >>> 29 || bits & 0x10000000) fail(); // Alpha hints are outside this opaque qualification scope.
      image = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    } else if (!canvas || (type === 'ICCP' ? image !== null : image === null)) fail();
    seen.add(type); chunks.push(type); offset = next;
  }
  if (!image || image.width > 8192 || image.height > 8192 || (canvas && (canvas.width !== image.width || canvas.height !== image.height))) fail();
  for (const [type, flag] of [['ICCP', 0x20], ['EXIF', 0x08], ['XMP ', 0x04]]) if (seen.has(type) !== Boolean(flags & flag)) fail();
  return { encoding: 'lossless', ...image, alphaHint: false, extended: canvas !== null, chunks,
    hasExif: seen.has('EXIF'), hasXmp: seen.has('XMP '), hasIcc: seen.has('ICCP'), bitstreamDecoded: false };
}
