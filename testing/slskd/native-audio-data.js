/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createHash } from 'node:crypto';

const sampleRate = 44100; const frames = sampleRate * 2; const headerSize = 44;
export const nativeAudioFiles = Object.freeze(['valid', 'corrupt'].map(kind => Object.freeze({
  kind, filename: (kind === 'valid' ? 'NativeAudioValid' : 'NativeAudioCorrupt') + '\\01-Controlled.wav', size: headerSize + frames * 4,
})));

function wavHeader() {
  const bytes = Buffer.alloc(headerSize);
  bytes.write('RIFF'); bytes.writeUInt32LE(headerSize + frames * 4 - 8, 4); bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(2, 22); bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 4, 28); bytes.writeUInt16LE(4, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(frames * 4, 40); return bytes;
}

export function nativeAudioChunk(file, offset, length) {
  if (!nativeAudioFiles.includes(file) || !Number.isSafeInteger(offset) || !Number.isSafeInteger(length)
    || offset < 0 || length < 1 || length > 16384 || offset + length > file.size) throw new TypeError('Unowned native audio range');
  const bytes = Buffer.alloc(length); if (file.kind === 'corrupt') return bytes;
  const header = wavHeader();
  for (let index = 0; index < length; index++) {
    const position = offset + index;
    if (position < headerSize) bytes[index] = header[position];
    else {
      const sample = ((Math.floor((position - headerSize) / 4) % 441) * 128 - 28160) & 0xffff;
      bytes[index] = (position - headerSize) % 2 === 0 ? sample & 255 : sample >>> 8;
    }
  }
  return bytes;
}

export function nativeAudioDigest(file) {
  if (!nativeAudioFiles.includes(file)) throw new TypeError('An owned audio file is required');
  const digest = createHash('sha256');
  for (let offset = 0; offset < file.size; offset += 16384) digest.update(nativeAudioChunk(file, offset, Math.min(16384, file.size - offset)));
  return digest.digest('hex');
}
