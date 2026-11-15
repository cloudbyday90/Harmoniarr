/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { folderRetentionPolicy, summarizeFolderRetention } from './folder-retention-policy.js';

/** Retain complete chronological checkpoints even when a worker fails or is killed. */
export function decodeFolderRetentionOutput(output, owner, partial = false) {
  assert.ok(Buffer.byteLength(output) <= folderRetentionPolicy.maxReportBytes * 2, 'Retention protocol exceeds fixed bound');
  const lines = output.split('\n');
  if (partial) lines.pop(); // Only newline-acknowledged records survive uncertain final output.
  const rows = lines.filter(line => line.trim()).map(line => JSON.parse(line));
  assert.ok(rows.length <= folderRetentionPolicy.warmupCycles + folderRetentionPolicy.measuredCycles + 2);
  const checkpoints = [], cycles = []; let final;
  for (const row of rows) {
    assert.equal(row.owner, owner); assert.equal(final, undefined, 'Unexpected record after final envelope');
    if (row.phase === 'retention-checkpoint') {
      assert.equal(row.checkpoint.afterCycle, checkpoints.length);
      if (checkpoints.length === 0) assert.equal(row.cycle, null);
      else { assert.equal(row.cycle.cycle, checkpoints.length); cycles.push(row.cycle); }
      checkpoints.push(row.checkpoint);
    } else { assert.equal(row.phase, 'retention'); final = row; }
  }
  if (partial) return { status: 'incomplete', checkpoints, cycles };
  assert.ok(final); summarizeFolderRetention(final.result);
  assert.deepEqual(final.result.checkpoints, checkpoints); assert.deepEqual(final.result.cycles, cycles);
  return final;
}
