/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { statfs } from 'node:fs/promises';
import { nativeResumePlans } from './native-resume-policy.js';
import { inspectCompletedNativeFiles, assertNativeFileTree } from './native-completed-files.js';

export async function inspectRetiredNativeResumeFiles() {
  const files = nativeResumePlans.map(plan => plan.file);
  const completed = await inspectCompletedNativeFiles(files);
  await assertNativeFileTree(files);
  await assertNativeFileTree([], '/incomplete', 2);
  for (const root of ['/downloads', '/incomplete']) {
    const fs = await statfs(root, { bigint: true });
    assert.equal(fs.type, 0x01021994n); assert.equal(fs.bsize * fs.blocks, 4194304n);
  }
  return { completed, incompleteFilesAbsent: true, exactTreesVerified: true, actualTmpfsBytesPerVolume: 4194304 };
}
