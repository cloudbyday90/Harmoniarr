/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { getPool, closePool } from '/app/server-dist/database.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { backupRecoveryInterruptionCases } from '../../testing/server/backup-recovery-interruption-plan.js';
import { runBackupRecoveryInterruptionScenario } from '../../testing/server/backup-recovery-interruption-scenario.js';

await requireDeploymentMemoryProfile();
test('recovery worker interruption preserves actual journal state, authority and owned drainage', { timeout: 240_000 }, async t => {
  const results = [];
  await withWorkerTaskCleanup(async () => {
    for (const caseName of backupRecoveryInterruptionCases) results.push(await runBackupRecoveryInterruptionScenario({ pool: getPool(), caseName, signal: t.signal }));
    assert.equal(results.length, 7); t.diagnostic(JSON.stringify({ cases: results }));
  }, closePool);
});
