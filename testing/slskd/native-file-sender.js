/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { nativeFileChunk, nativeTransferFiles } from './native-file-data.js';

/** Pipeline applies backpressure and awaits write callbacks; receipt/file proof remains separate. */
export async function sendNativeFile(socket, file) {
  return writeNativeFilePrefix(socket, file, file.size);
}

export async function writeNativeFilePrefix(socket, file, length) {
  if (!nativeTransferFiles.includes(file)) throw new TypeError('An owned native file is required');
  if (!Number.isSafeInteger(length) || length < 1 || length > file.size) throw new TypeError('Invalid fixture send length');
  function* chunks() {
    for (let offset = 0; offset < length; offset += 16_384) {
      yield nativeFileChunk(file, offset, Math.min(16_384, length - offset));
    }
  }
  // The downloader closes its socket after reading the declared length.
  await pipeline(Readable.from(chunks(), { objectMode: false, highWaterMark: 16_384 }), socket, { end: false });
}
