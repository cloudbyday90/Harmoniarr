/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

/** Exact public fixture bytes, not a digest supplied by an arbitrary payload. */
export async function readPinnedArtworkFile({ root, fileName, inputBytes, sha256, signal }, { openFileFn = open } = {}) {
  if (typeof root !== 'string' || !isAbsolute(root) || !/^[a-z0-9-]+\.(?:jpg|webp)$/u.test(fileName)
    || !Number.isSafeInteger(inputBytes) || inputBytes < 1 || inputBytes > 14 * 1024 ** 2 || !/^[a-f0-9]{64}$/u.test(sha256)) {
    throw new TypeError('Invalid pinned artwork fixture');
  }
  signal?.throwIfAborted(); const directory = await lstat(root); assert.ok(directory.isDirectory() && !directory.isSymbolicLink());
  const path = join(root, fileName); const entry = await lstat(path); assert.ok(entry.isFile() && !entry.isSymbolicLink());
  const file = await openFileFn(path, constants.O_RDONLY | (process.platform === 'linux' ? constants.O_NOFOLLOW : 0));
  return withWorkerTaskCleanup(async () => {
    const before = await file.stat(); assert.ok(before.isFile()); assert.equal(before.size, inputBytes);
    const buffer = Buffer.alloc(inputBytes); let offset = 0;
    while (offset < buffer.length) {
      signal?.throwIfAborted(); const { bytesRead } = await file.read(buffer, offset, buffer.length - offset, offset);
      assert.ok(bytesRead > 0, 'Pinned artwork ended early'); offset += bytesRead;
    }
    signal?.throwIfAborted(); assert.equal((await file.read(Buffer.alloc(1), 0, 1, inputBytes)).bytesRead, 0, 'Pinned artwork grew');
    assert.equal((await file.stat()).size, inputBytes); assert.equal(createHash('sha256').update(buffer).digest('hex'), sha256);
    return buffer;
  }, () => file.close());
}
