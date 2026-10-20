/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createHash } from 'node:crypto';

export const nativeTransferFiles = Object.freeze([65553, 131089, 98311, 24581].map((size, index) =>
  Object.freeze({ filename: 'NativeBytes\\file-' + (index + 1) + '.bin', size, seed: index + 1 })));

export function nativeFileChunk(file, offset, length) {
  if (!nativeTransferFiles.includes(file) || !Number.isSafeInteger(offset) || !Number.isSafeInteger(length)
    || offset < 0 || length < 1 || length > 16_384 || offset + length > file.size) throw new TypeError('Unowned fixture byte range');
  return Buffer.from(Array.from({ length }, (_, index) => ((offset + index) * 31 + file.seed) & 255));
}

export function nativeFileDigest(file, length = file.size) {
  if (!nativeTransferFiles.includes(file)) throw new TypeError('An owned native file is required');
  if (!Number.isSafeInteger(length) || length < 1 || length > file.size) throw new TypeError('Invalid fixture digest length');
  const digest = createHash('sha256');
  for (let offset = 0; offset < length; offset += 16_384) {
    digest.update(nativeFileChunk(file, offset, Math.min(16_384, length - offset)));
  }
  return digest.digest('hex');
}
