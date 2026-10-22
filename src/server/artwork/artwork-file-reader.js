/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { createApiError } from '../auth.js';
import { artworkInputByteLimit } from './artwork-image-content-policy.js';

const ownedErrors = new WeakSet();
function fileError(code) {
  const error = createApiError(400, code, code === 'artwork_file_too_large'
    ? 'Artwork file exceeds the configured byte limit' : 'Artwork file could not be read within the image policy');
  ownedErrors.add(error); return error;
}

/** Inspect/read the same regular-file handle, never allocate an unbounded readFile. */
export async function readArtworkFile(filePath, { maxBytes, openFn = open } = {}) {
  const limit = artworkInputByteLimit({ maxOriginalFileSizeBytes: maxBytes });
  let handle; let failed = false; let failure; let result;
  try {
    handle = await openFn(filePath, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
    const info = await handle.stat();
    if (!info.isFile() || !Number.isSafeInteger(info.size) || info.size < 0) throw fileError('artwork_file_unavailable');
    if (info.size > limit) throw fileError('artwork_file_too_large');
    const scratch = Buffer.allocUnsafe(Math.min(65_536, limit + 1)); const chunks = []; let total = 0;
    for (;;) {
      const length = Math.min(scratch.length, limit - total + 1);
      const { bytesRead } = await handle.read(scratch, 0, length, null);
      if (!Number.isInteger(bytesRead) || bytesRead < 0 || bytesRead > length) throw fileError('artwork_file_unavailable');
      if (!bytesRead) break;
      total += bytesRead;
      if (total > limit) throw fileError('artwork_file_too_large');
      chunks.push(Buffer.from(scratch.subarray(0, bytesRead)));
    }
    result = Buffer.concat(chunks, total);
  } catch (error) {
    failed = true;
    failure = ownedErrors.has(error) ? error : fileError('artwork_file_unavailable');
  }
  try { await handle?.close(); } catch { if (!failed) { failed = true; failure = fileError('artwork_file_unavailable'); } }
  if (failed) throw failure;
  return result;
}
