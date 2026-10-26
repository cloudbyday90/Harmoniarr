/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';

export async function waitForBackupStartupRecovery(pool, { timeoutMs = 30_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await pool.query(`SELECT status, summary FROM operation_runs
      WHERE operation_type='backup_artifact_recovery'
        AND (summary->>'backupRecoveryThrough')::timestamptz >= pg_postmaster_start_time()
      ORDER BY created_at DESC, id DESC LIMIT 1`);
    const run = result.rows[0];
    assert.notEqual(run?.status, 'failed', 'Production startup recovery must not fail');
    assert.notEqual(run?.status, 'cancelled', 'Production startup recovery must not be cancelled');
    if (run?.status === 'completed') return run;
    assert.ok(Date.now() < deadline, 'Production startup recovery must finish before qualification continues');
    await new Promise(resolve => { setTimeout(resolve, 25); });
  }
}
