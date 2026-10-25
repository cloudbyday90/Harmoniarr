/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export function rawNoiseBytes(width, height) {
  if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= 8192)) throw new TypeError('Invalid bounded TIFF geometry');
  return width * height * 3;
}
/** Minimal uncompressed RGB8 TIFF, with independent sixteen-row strips. */
function header(width, height) {
  const rawBytes = rawNoiseBytes(width, height); const strips = Math.ceil(height / 16);
  const bits = 134; const offsets = bits + 6; const counts = offsets + strips * 4; const pixels = counts + strips * 4;
  const result = Buffer.alloc(pixels); result.write('II'); result.writeUInt16LE(42, 2); result.writeUInt32LE(8, 4); result.writeUInt16LE(10, 8);
  const tags = [[256,4,1,width],[257,4,1,height],[258,3,3,bits],[259,3,1,1],[262,3,1,2],
    [273,4,strips,strips === 1 ? pixels : offsets],[277,3,1,3],[278,4,1,16],[279,4,strips,strips === 1 ? rawBytes : counts],[284,3,1,1]];
  for (let i = 0; i < tags.length; i++) {
    const [tag, type, count, value] = tags[i]; const at = 10 + i * 12;
    result.writeUInt16LE(tag, at); result.writeUInt16LE(type, at + 2); result.writeUInt32LE(count, at + 4); result.writeUInt32LE(value, at + 8);
  }
  for (let c = 0; c < 3; c++) result.writeUInt16LE(8, bits + c * 2);
  for (let i = 0; i < strips; i++) {
    result.writeUInt32LE(pixels + i * 16 * width * 3, offsets + i * 4);
    result.writeUInt32LE(Math.min(16, height - i * 16) * width * 3, counts + i * 4);
  }
  return result;
}
/** Lazy fixed-seed rows; no full raw JavaScript bitmap or row list. */
export function* deterministicTiffRows(width, height) {
  let state = 0x6d2b79f5; yield header(width, height);
  for (let y = 0; y < height; y++) {
    const row = Buffer.allocUnsafe(width * 3);
    for (let x = 0; x < row.length; x++) { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; row[x] = state & 255; }
    yield row;
  }
}
