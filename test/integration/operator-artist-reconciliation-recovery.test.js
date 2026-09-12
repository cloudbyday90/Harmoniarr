/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0. See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createOperatorArtistReconciliationRunStore } from '../../src/server/metadata/operator-artist-reconciliation-run-store.js';
import { createOperatorArtistSaveStateStore } from '../../src/server/metadata/operator-artist-save-state-store.js';
import { createOperatorArtistReconciliationRecoveryStore } from '../../src/server/metadata/operator-artist-reconciliation-recovery-store.js';
import { createOperatorArtistReconciliationRecoverySweepService } from '../../src/server/metadata/operator-artist-reconciliation-recovery-sweep-service.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

const operationTypes = ['operator_artist_reconciliation'];

test('durable artist recovery is bounded, deduplicated, cancellation-aware, and audited in PostgreSQL', { timeout: 90_000 }, async (t) => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const { rows: users } = await pool.query("INSERT INTO app_users (username,password_hash,role) VALUES ('recovery-operator','test-only-hash','admin') RETURNING id");
    const appUserId = users[0].id;
    const runStore = createOperatorArtistReconciliationRunStore({ getPoolFn });
    const recoveryStore = createOperatorArtistReconciliationRecoveryStore({ getPoolFn });
    async function seedFailure({ old = true, cancelled = false } = {}) {
      const metadata = await seedMetadataReleaseFixture({ queryable: pool });
      const metadataArtistId = metadata.metadataArtistId;
      const { rows: snapshots } = await pool.query(`INSERT INTO operator_artist_reconciliation_snapshot
        (app_user_id,metadata_artist_id,snapshot_revision,snapshot_payload) VALUES ($1,$2,1,'{}'::jsonb) RETURNING id`,
      [appUserId, metadataArtistId]);
      const run = await runStore.createOperationRun({ appUserId, metadataArtistId,
        artistName: 'Recovery artist', snapshotId: snapshots[0].id, snapshotRevision: 1 });
      await pool.query(`UPDATE operation_runs SET status='failed', finished_at=NOW() - ($2::integer * INTERVAL '1 second'),
        cancel_requested_at=CASE WHEN $3 THEN NOW() ELSE NULL END WHERE id=$1`, [run.id, old ? 120 : 0, cancelled]);
      return { runId: run.id, appUserId, metadataArtistId, snapshotId: snapshots[0].id };
    }

    await t.test('cooldown and cancellation prevent recovery', async () => {
      await seedFailure({ old: false });
      await seedFailure({ cancelled: true });
      assert.deepEqual(await recoveryStore.listCandidates(), []);
    });

    await t.test('concurrent recovery and process restart create only one durable recovery', async () => {
      const candidate = await seedFailure();
      const outcomes = await Promise.all([recoveryStore.recoverCandidate(candidate), recoveryStore.recoverCandidate(candidate)]);
      assert.equal(outcomes.filter((outcome) => outcome.recovered).length, 1);
      const winner = outcomes.find((outcome) => outcome.recovered).run;
      const restarted = createOperatorArtistReconciliationRecoverySweepService({
        recoveryStore: createOperatorArtistReconciliationRecoveryStore({ getPoolFn }),
      });
      assert.equal((await restarted.recoverFailedRuns({ operationTypes })).recoveredCount, 0);
      const { rows: audits } = await pool.query('SELECT actor_type, details FROM audit_events WHERE entity_id=$1', [winner.id]);
      assert.equal(audits.length, 1);
      assert.equal(audits[0].actor_type, 'system');
      assert.equal(audits[0].details.recoveredFromRunId, candidate.runId);
      await pool.query("UPDATE operation_runs SET status='failed',finished_at=NOW()-INTERVAL '120 seconds' WHERE id=$1", [winner.id]);
      assert.equal((await recoveryStore.recoverCandidate({ ...candidate, runId: winner.id })).recovered, false);
      assert.deepEqual(await recoveryStore.listCandidates(), []);
    });

    await t.test('a manual retry queued after scanning is not replaced by recovery', async () => {
      const candidate = await seedFailure();
      assert.ok((await recoveryStore.listCandidates()).some((entry) => entry.runId === candidate.runId));
      const manual = await runStore.queueLatestSnapshotRun({ ...candidate, artistName: 'Recovery artist',
        snapshotRevision: 1, triggerSource: 'manual_retry' });
      assert.equal((await recoveryStore.recoverCandidate(candidate)).recovered, false);
      const { rows } = await pool.query('SELECT summary FROM operation_runs WHERE id=$1', [manual.run.id]);
      assert.equal(rows[0].summary.triggerSource, 'manual_retry');
    });

    await t.test('audit failure rolls back the recovery enqueue and permits a later sweep', async () => {
      const candidate = await seedFailure();
      const brokenAuditStore = createOperatorArtistReconciliationRecoveryStore({ getPoolFn,
        recordAuditEventFn: async () => { throw new Error('Audit unavailable'); } });
      await assert.rejects(brokenAuditStore.recoverCandidate(candidate), /Audit unavailable/u);
      const { rows } = await pool.query("SELECT id FROM operation_runs WHERE status='pending' AND summary->>'metadataArtistId'=$1", [candidate.metadataArtistId]);
      assert.deepEqual(rows, []);
      assert.equal((await recoveryStore.recoverCandidate(candidate)).recovered, true);
    });

    await t.test('a busy artist save lock cannot stall unrelated recovery work', async () => {
      const busy = await seedFailure();
      const free = await seedFailure();
      const holder = await pool.connect();
      try {
        await holder.query('BEGIN');
        await createOperatorArtistSaveStateStore().lockOperatorArtistSave({ ...busy, client: holder });
        const startedAt = Date.now();
        assert.deepEqual(await recoveryStore.recoverCandidate(busy), { recovered: false, reason: 'lock_busy' });
        assert.ok(Date.now() - startedAt < 5_000, 'Lock contention must end without releasing the holder');
        assert.equal((await recoveryStore.recoverCandidate(free)).recovered, true);
      } finally {
        await holder.query('ROLLBACK');
        holder.release();
      }
      assert.equal((await recoveryStore.recoverCandidate(busy)).recovered, true);
    });

    await t.test('equivalent UUID spellings preserve active manual work and prevent recovery', async () => {
      const spellings = [
        (id) => `{${id.toUpperCase()}}`,
        (id) => id.replaceAll('-', ''),
        (id) => id.replaceAll('-', '').match(/.{4}/gu).join('-'),
      ];
      for (const spell of spellings) {
        const candidate = await seedFailure();
        assert.ok((await recoveryStore.listCandidates()).some((entry) => entry.runId === candidate.runId));
        const manual = await runStore.queueLatestSnapshotRun({
          appUserId: spell(appUserId), metadataArtistId: spell(candidate.metadataArtistId),
          artistName: 'Recovery artist', snapshotId: candidate.snapshotId,
          snapshotRevision: 1, triggerSource: 'manual_retry',
        });
        const before = (await pool.query('SELECT id, status, summary FROM operation_runs ORDER BY id')).rows;
        assert.equal((await recoveryStore.listCandidates()).some((entry) => entry.runId === candidate.runId), false);
        assert.deepEqual(await recoveryStore.recoverCandidate(candidate), { recovered: false });
        assert.deepEqual((await pool.query('SELECT id, status, summary FROM operation_runs ORDER BY id')).rows, before);
        assert.equal(before.find((run) => run.id === manual.run.id).summary.triggerSource, 'manual_retry');
      }
    });

    await t.test('legacy failed UUID spellings resolve to canonical recovery ownership', async () => {
      const candidate = await seedFailure();
      await pool.query('UPDATE operation_runs SET summary = summary || $2::jsonb WHERE id = $1', [
        candidate.runId, JSON.stringify({ appUserId: `{${appUserId.toUpperCase()}}`,
          metadataArtistId: candidate.metadataArtistId.replaceAll('-', '') }),
      ]);
      const listed = (await recoveryStore.listCandidates()).find((entry) => entry.runId === candidate.runId);
      assert.deepEqual(listed, { runId: candidate.runId, appUserId, metadataArtistId: candidate.metadataArtistId });
      const result = await recoveryStore.recoverCandidate(listed);
      assert.equal(result.recovered, true);
      assert.equal(result.run.appUserId, appUserId);
      assert.equal(result.run.metadataArtistId, candidate.metadataArtistId);
      assert.equal((await recoveryStore.recoverCandidate(listed)).recovered, false);
    });

    await t.test('malformed summary UUIDs cannot abort scanning or a valid recovery', async () => {
      const candidate = await seedFailure();
      const malformed = [];
      for (const identity of [
        { appUserId: 'not-a-user-uuid', metadataArtistId: candidate.metadataArtistId },
        { appUserId, metadataArtistId: 'not-an-artist-uuid' },
      ]) {
        const run = await runStore.createOperationRun({ ...identity, artistName: 'Malformed legacy work',
          snapshotId: candidate.snapshotId, snapshotRevision: 1, status: 'failed' });
        await pool.query("UPDATE operation_runs SET finished_at = NOW() - INTERVAL '120 seconds' WHERE id = $1", [run.id]);
        malformed.push(run.id);
      }
      const before = (await pool.query('SELECT id, status, summary FROM operation_runs WHERE id = ANY($1::uuid[]) ORDER BY id', [malformed])).rows;
      assert.ok((await recoveryStore.listCandidates()).some((entry) => entry.runId === candidate.runId));
      assert.equal((await recoveryStore.recoverCandidate(candidate)).recovered, true);
      assert.deepEqual((await pool.query('SELECT id, status, summary FROM operation_runs WHERE id = ANY($1::uuid[]) ORDER BY id', [malformed])).rows, before);
    });

    await t.test('disabled operators and missing snapshots are ineligible', async () => {
      const candidate = await seedFailure();
      await pool.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [appUserId]);
      assert.deepEqual(await recoveryStore.listCandidates(), []);
      assert.equal((await recoveryStore.recoverCandidate(candidate)).recovered, false);
      await pool.query('UPDATE app_users SET is_disabled=FALSE WHERE id=$1', [appUserId]);
      await pool.query('DELETE FROM operator_artist_reconciliation_snapshot WHERE id=$1', [candidate.snapshotId]);
      assert.equal((await recoveryStore.recoverCandidate(candidate)).recovered, false);
      assert.deepEqual(await recoveryStore.listCandidates(), []);
    });
  } });
});
