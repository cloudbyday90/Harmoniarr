/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { lstat, mkdir, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { nativeAudioFiles, nativeAudioDigest } from './native-audio-data.js';
import { inspectDeclaredNativeBytes } from './native-file-read.js';

/** Export only into an isolated, exclusively owned scenario workspace after producer retirement. */
export async function exportNativeAudioFile({ docker, fixtureId, downloadsRoot, file, native }) {
  assert.ok(nativeAudioFiles.includes(file));
  assert.equal(native.filename, file.filename);
  assert.equal(native.size, file.size);
  assert.equal(native.identityStable, true);
  assert.equal(native.sha256, nativeAudioDigest(file));
  const rootStat = await lstat(downloadsRoot);
  assert.equal(rootStat.isDirectory(), true);
  assert.equal(rootStat.isSymbolicLink(), false);
  const root = await realpath(downloadsRoot);
  const parts = file.filename.split('\\');
  const parent = join(root, parts[0]);
  await mkdir(parent, { recursive: true });
  assert.equal((await lstat(parent)).isSymbolicLink(), false);
  assert.equal(await realpath(parent), parent);
  const path = join(parent, parts[1]);
  await assert.rejects(lstat(path), { code: 'ENOENT' }, 'Export must not overwrite an existing entry');
  await docker(['cp', fixtureId + ':/downloads/' + parts.join('/'), path]);
  const result = await inspectDeclaredNativeBytes(root, file, {
    parts, minBytes: file.size, maxBytes: file.size, digestForLength: () => native.sha256,
  });
  return { filename: result.filename, size: result.size, sha256: result.sha256, identityStable: true };
}
