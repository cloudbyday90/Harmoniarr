/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { lstat, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';
import { refuseOperatorTrackFiles } from './operator-track-file-policy.js';

export async function fingerprintOperatorTrackFile(filePath, { libraryRoot = null } = {}) {
  let canonical;
  const assertPrivate = async () => {
    if (!libraryRoot) return;
    const root = await realpath(libraryRoot); const file = await realpath(filePath);
    const delta = relative(root, file);
    if (!delta || delta === '..' || delta.startsWith(`..${sep}`) || isAbsolute(delta)
      || (await lstat(filePath)).isSymbolicLink() || (canonical && canonical !== file)) throw refuseOperatorTrackFiles();
    canonical = file;
  };
  await assertPrivate();
  const before = await stat(filePath);
  if (!before.isFile()) throw new Error('Track evidence requires a regular file');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  const after = await stat(filePath);
  await assertPrivate();
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino) throw new Error('Track changed while collecting evidence');
  return { sizeBytes: after.size, sha256: hash.digest('hex') };
}
