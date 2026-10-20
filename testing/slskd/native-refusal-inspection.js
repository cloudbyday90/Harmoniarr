/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { statfs } from 'node:fs/promises';
import { nativeRefusalPlans } from './native-refusal-policy.js';
import { nativePeer } from './fixture-data.js';
import { inspectNativePartial } from './native-partial-inspection.js';
import { assertNativeFileTree } from './native-completed-files.js';

export async function inspectRetiredNativeRefusalFiles() {
  await assertNativeFileTree([]);
  await assertNativeFileTree(nativeRefusalPlans.map(plan => ({ filename: nativePeer + '\\' + plan.partial.file.filename })), '/incomplete', 2);
  const incomplete = [];
  for (const plan of nativeRefusalPlans) incomplete.push({ kind: plan.kind, ...await inspectNativePartial('/incomplete', plan.partial) });
  for (const root of ['/downloads', '/incomplete']) {
    const filesystem = await statfs(root, { bigint: true });
    assert.equal(filesystem.type, 0x01021994n); assert.equal(filesystem.bsize * filesystem.blocks, 4194304n);
  }
  return { incomplete, completedFilesAbsent: true, exactTreesVerified: true, actualTmpfsBytesPerVolume: 4194304 };
}
