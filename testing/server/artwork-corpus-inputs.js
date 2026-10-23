/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createDeflate, crc32 } from 'node:zlib';
import sharp from 'sharp';

export const artworkCorpusCases = Object.freeze([
  { id: 'rgb8-png-noise', width: 1024, height: 1024, channels: 3, bits: 8, format: 'png', noise: true },
  { id: 'rgba8-png-noise', width: 1024, height: 1024, channels: 4, bits: 8, format: 'png', noise: true },
  { id: 'gray16-png-noise', width: 1024, height: 1024, channels: 1, bits: 16, format: 'png', noise: true },
  { id: 'rgba16-png-noise', width: 1024, height: 1024, channels: 4, bits: 16, format: 'png', noise: true },
  { id: 'rgb8-jpeg-noise', width: 1024, height: 1024, channels: 3, bits: 8, format: 'jpeg', noise: true },
  { id: 'rgb8-webp-noise', width: 512, height: 512, channels: 3, bits: 8, format: 'webp', noise: true },
  { id: 'rgba16-png-policy-refusal', width: 8192, height: 8192, channels: 4, bits: 16, format: 'png', noise: false, refuse: true },
].map(value => Object.freeze(value)));

function randomSamples() {
  let state = 0x6d2b79f5;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0; };
}
function chunk(type, data) {
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length); result.write(type, 4, 'ascii'); data.copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4); return result;
}

/** A bounded, synthetic PNG encoder: real 16-bit samples, filter zero and CRCs. */
export async function createArtworkCorpusInput(spec) {
  if (!artworkCorpusCases.includes(spec)) throw new TypeError('Use an owned bounded artwork corpus case');
  const next = randomSamples(); const bytes = spec.bits / 8;
  function row() {
    const result = Buffer.alloc(1 + spec.width * spec.channels * bytes);
    for (let sample = 0; sample < spec.width * spec.channels; sample++) {
      const value = spec.noise ? next() : (sample % 256) * 251 + 17;
      if (bytes === 2) result.writeUInt16BE(value & 65535, 1 + sample * 2);
      else result[1 + sample] = value & 255;
    }
    return result;
  }
  const repeated = spec.noise ? null : row();
  function* rows() { for (let y = 0; y < spec.height; y++) yield repeated ?? row(); }
  if (spec.format !== 'png') {
    const raw = Buffer.concat([...rows()].map(value => value.subarray(1)));
    const image = sharp(raw, { raw: { width: spec.width, height: spec.height, channels: spec.channels } });
    return spec.format === 'jpeg' ? image.withExif({ IFD0: { Artist: 'Harmoniarr synthetic corpus' } }).jpeg({ quality: 90 }).toBuffer()
      : image.webp({ quality: 90, effort: 4 }).toBuffer();
  }
  const compressed = []; let size = 0;
  await pipeline(Readable.from(rows(), { objectMode: false }), createDeflate({ level: 1 }), async source => {
    for await (const part of source) {
      size += part.length;
      if (size > 20 * 1024 * 1024) throw new Error('Artwork corpus fixture exceeds its compressed budget');
      compressed.push(part);
    }
  });
  const header = Buffer.alloc(13); header.writeUInt32BE(spec.width); header.writeUInt32BE(spec.height, 4);
  header[8] = spec.bits; header[9] = ({ 1: 0, 3: 2, 4: 6 })[spec.channels];
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', Buffer.concat(compressed, size)), chunk('IEND', Buffer.alloc(0))]);
}
