/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { statfs } from 'node:fs/promises';
import { inspectNativeBytes } from './native-file-read.js';
import { nativeFileDigest } from './native-file-data.js';
import { nativePeer } from './fixture-data.js';
import { nativePartialPlans } from './native-partial-plan.js';
import { inspectCompletedNativeFiles, assertNativeFileTree } from './native-completed-files.js';

export async function inspectNativePartial(root, plan) {
  if (!nativePartialPlans.includes(plan) || plan.kind === 'complete') throw new TypeError('An owned partial plan is required');
  return inspectNativeBytes(root, plan.file, { parts: [nativePeer, ...plan.file.filename.split('\\')],
    minBytes: plan.kind === 'eof' ? plan.bytes : 16_384, maxBytes: plan.bytes,
    digestForLength: length => nativeFileDigest(plan.file, length) });
}

export async function inspectRetiredNativePartialFiles() {
  const completed = await inspectCompletedNativeFiles([nativePartialPlans[0].file]);
  const failed = nativePartialPlans.slice(1);
  await assertNativeFileTree([nativePartialPlans[0].file]);
  await assertNativeFileTree(failed.map(plan => ({ filename: nativePeer + '\\' + plan.file.filename })), '/incomplete', 2);
  const incomplete = [];
  for (const plan of failed) incomplete.push({ kind: plan.kind, ...await inspectNativePartial('/incomplete', plan) });
  for (const root of ['/downloads', '/incomplete']) {
    const filesystem = await statfs(root, { bigint: true });
    assert.equal(filesystem.type, 0x01021994n);
    assert.equal(filesystem.bsize * filesystem.blocks, 4n * 1024n * 1024n);
  }
  return { completed, incomplete, failedCompletedFilesAbsent: true, exactTreesVerified: true, actualTmpfsBytesPerVolume: 4194304 };
}
