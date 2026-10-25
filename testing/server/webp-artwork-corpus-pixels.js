/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const glyphs = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
};

/** Opaque RGB8 artwork with no platform fonts, SVG renderer or random seed. */
export function createWebpCorpusPixels(id) {
  if (!['cover-type', 'cover-gradient'].includes(id)) throw new TypeError('Select fixed synthetic cover');
  const width = 1024; const height = 1024; const data = Buffer.alloc(width * height * 3);
  const pixel = (x, y, color) => { const offset = (y * width + x) * 3; data[offset] = color[0]; data[offset + 1] = color[1]; data[offset + 2] = color[2]; };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const color = id === 'cover-gradient' ? [Math.floor(x * 255 / 1023), Math.floor(y * 255 / 1023), Math.floor((x + y) * 255 / 2046)]
      : y < 128 ? [234, 74, 54] : y > 760 && (x + y) % 64 < 8 ? [234, 74, 54] : [16, 24, 40];
    pixel(x, y, color);
  }
  if (id === 'cover-type') for (const [text, top, scale] of [['HARMONIARR', 220, 14], ['NIGHT', 400, 18], ['SIGNALS', 580, 14]]) {
    for (let letter = 0; letter < text.length; letter++) for (let row = 0; row < 7; row++) for (let col = 0; col < 5; col++) {
      if (glyphs[text[letter]][row][col] !== '1') continue;
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) pixel(60 + letter * 6 * scale + col * scale + dx, top + row * scale + dy, [248, 246, 235]);
    }
  }
  return { data, width, height, channels: 3 };
}
