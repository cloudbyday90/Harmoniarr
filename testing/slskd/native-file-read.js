/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { nativeTransferFiles } from './native-file-data.js';

const identity = stat => [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs, stat.nlink];

/** Shared bounded descriptor/path read for declared full and partial fixture files. */
export async function inspectNativeBytes(root, file, { parts, minBytes, maxBytes, digestForLength }) {
  if (!nativeTransferFiles.includes(file) || !Array.isArray(parts) || parts.length < 2 || parts.length > 3
    || parts.some(part => !/^[a-zA-Z0-9.-]+$/u.test(part) || part === '..' || part === '.')
    || !Number.isSafeInteger(minBytes) || !Number.isSafeInteger(maxBytes)
    || minBytes < 1 || maxBytes < minBytes || maxBytes > file.size) throw new TypeError('Invalid owned native read');
  const ownedRoot = await realpath(root);
  const path = resolve(ownedRoot, ...parts);
  assert.ok(path.startsWith(ownedRoot + sep));
  for (let count = 1; count < parts.length; count++) {
    const parent = resolve(ownedRoot, ...parts.slice(0, count));
    assert.equal((await lstat(parent)).isSymbolicLink(), false); assert.equal(await realpath(parent), parent);
  }
  const opening = await lstat(path, { bigint: true });
  assert.equal(opening.isFile(), true); assert.equal(opening.isSymbolicLink(), false);
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  let failed = false; let failure; let result;
  try {
    const before = await handle.stat({ bigint: true });
    assert.deepEqual(identity(before), identity(opening));
    assert.ok(before.size >= BigInt(minBytes) && before.size <= BigInt(maxBytes)); assert.equal(before.nlink, 1n);
    const length = Number(before.size);
    const digest = createHash('sha256'); const buffer = Buffer.alloc(16_384);
    let offset = 0;
    while (offset < length) {
      const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, length - offset), offset);
      assert.ok(bytesRead > 0, 'Native file ended early');
      digest.update(buffer.subarray(0, bytesRead)); offset += bytesRead;
    }
    assert.equal((await handle.read(buffer, 0, 1, offset)).bytesRead, 0);
    assert.deepEqual(identity(await handle.stat({ bigint: true })), identity(before));
    assert.deepEqual(identity(await lstat(path, { bigint: true })), identity(before));
    assert.equal(await realpath(path), path);
    const sha256 = digest.digest('hex'); assert.equal(sha256, digestForLength(length));
    result = { filename: file.filename, size: offset, sha256, device: String(before.dev), inode: String(before.ino), identityStable: true };
  } catch (error) { failed = true; failure = error; }
  try { await handle.close(); } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
  return result;
}
