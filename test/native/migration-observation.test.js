/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createApp } from '/app/server-dist/app.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { closePool, getPool } from '/app/server-dist/database.js';
import { getMigrationStatus } from '/app/server-dist/migrations.js';
import { readMigrationStatus } from '/app/server-dist/schema-migration-status-service.js';
import { createBackupEncryptionService } from '/app/server-dist/recovery/backup-encryption-service.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { createMigrationObservationGuard, createMigrationObservationSystemModule } from '../../testing/server/migration-observation-fixture.js';

await requireDeploymentMemoryProfile();
test('prepared migration observation supports concurrent HTTP reads and explicit backup commands without schema writes', { timeout: 90_000 }, async t => {
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const anchor = await mkdtemp('/app/data/migration-observation-');
  process.env.HARMONIARR_BACKUPS = join(anchor, 'backups'); await mkdir(process.env.HARMONIARR_BACKUPS, { mode: 0o700 });
  const pool = getPool(), encryption = createBackupEncryptionService();
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json', createSystemModule: createMigrationObservationSystemModule });
  const client = createSessionHttpClient('http://127.0.0.1:3000'); let runtime, guard, renamed = false, pendingFilename;
  const onboarding = () => client.requestJson('/api/v1/system/onboarding');
  const preview = id => client.requestJson(`/api/v1/recovery/backups/${id}/restore-preview`);
  const createBackup = key => client.requestJson('/api/v1/recovery/backups', { method: 'POST', headers: { 'idempotency-key': key } });
  const databaseStep = result => result.payload.steps.find(step => step.id === 'database');
  const assertRead = result => { assert.equal(result.response.status, 200); assert.equal(result.response.headers.get('cache-control'), 'no-store'); };
  const artifactCount = async () => (await pool.query('SELECT count(*)::int AS count FROM backup_artifacts')).rows[0].count;
  async function verifyBackup(result, level) {
    assert.equal(result.response.status, 202); assert.equal(result.payload.accepted, true);
    const artifact = result.payload.backupArtifact;
    const row = (await pool.query('SELECT storage_path,payload_sha256,migration_level FROM backup_artifacts WHERE id=$1', [artifact.id])).rows[0];
    assert.equal(artifact.encrypted, true); assert.equal(row.migration_level, level);
    const plaintext = encryption.decryptBackupPayload(await readFile(row.storage_path, 'utf8'));
    assert.equal(createHash('sha256').update(plaintext).digest('hex'), row.payload_sha256);
    assert.equal(JSON.parse(plaintext).schema.migrationLevel, level);
    return artifact.id;
  }
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    assert.equal((await onboarding()).response.status, 401);
    assert.equal((await preview('00000000-0000-4000-8000-000000000000')).response.status, 401);
    assert.equal((await client.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: 'observation-admin', password: 'ObservationFixture123!' } })).response.status, 201);
    const initialLogLevel = (await client.requestJson('/api/v1/settings')).payload.settings.system.logLevel;
    guard = await createMigrationObservationGuard(pool); const catalogBefore = await guard.getCatalogIdentity(); assert.ok(catalogBefore);
    await assert.rejects(getMigrationStatus(), error => error.code === '25006');
    const reader = await pool.connect();
    try {
      await reader.query('BEGIN READ ONLY');
      assert.deepEqual(await readMigrationStatus({ queryable: reader }), { available: 115, applied: 115, pending: [] });
    } finally { try { await reader.query('ROLLBACK'); } finally { reader.release(); } }
    assert.equal((await client.requestJson('/api/v1/recovery/backups', { method: 'POST', csrf: false })).response.status, 403);
    assert.equal(await artifactCount(), 0);
    const first = await createBackup('observation-first'); const firstId = await verifyBackup(first, 'applied:115');
    const initial = await preview(firstId); assertRead(initial); assert.equal(initial.payload.canApplyRestore, true);
    const current = await onboarding(); assertRead(current); assert.equal(databaseStep(current).status, 'complete');
    for (let batch = 0; batch < 2; batch++) {
      const work = Array.from({ length: 10 }, (_, index) => index % 2 ? onboarding() : preview(firstId));
      if (batch === 0) work.push(createBackup('observation-second'));
      const results = await Promise.all(work);
      for (const [index, result] of results.slice(0, 10).entries()) {
        assertRead(result);
        if (index % 2) assert.equal(databaseStep(result).status, 'complete');
        else { assert.equal(result.payload.canApplyRestore, true); assert.equal(result.payload.compatibility.currentMigrationLevel, 'applied:115'); }
      }
      if (batch === 0) await verifyBackup(results[10], 'applied:115');
    }
    const replay = await createBackup('observation-first'); assert.equal(replay.response.status, 202); assert.equal(replay.payload.backupArtifact.id, firstId);
    assert.equal(await artifactCount(), 2);
    pendingFilename = (await pool.query("UPDATE schema_migrations SET status='running' WHERE filename=(SELECT filename FROM schema_migrations ORDER BY filename LIMIT 1) RETURNING filename")).rows[0].filename;
    const attention = await onboarding(); assertRead(attention); assert.equal(databaseStep(attention).status, 'attention');
    const incompatible = await preview(firstId); assertRead(incompatible); assert.equal(incompatible.payload.canApplyRestore, false);
    assert.equal(incompatible.payload.compatibility.currentMigrationLevel, 'pending:1');
    await verifyBackup(await createBackup('observation-pending'), 'pending:1');
    await pool.query("UPDATE schema_migrations SET status='applied' WHERE filename=$1", [pendingFilename]); pendingFilename = null;
    assert.equal((await client.requestJson('/api/v1/settings', { method: 'PUT', json: { system: { logLevel: 'debug' } } })).response.status, 200);
    const applied = await client.requestJson(`/api/v1/recovery/backups/${firstId}/restore-apply`, { method: 'POST',
      headers: { 'idempotency-key': 'observation-restore-apply' }, json: { expectedPayloadSha256: first.payload.backupArtifact.payloadSha256 } });
    assert.equal(applied.response.status, 202); assert.equal(applied.payload.run.status, 'completed');
    assert.equal((await client.requestJson('/api/v1/settings')).payload.settings.system.logLevel, initialLogLevel);
    await pool.query("UPDATE app_users SET role='requester' WHERE username='observation-admin'");
    assert.equal((await onboarding()).response.status, 403); assert.equal((await preview(firstId)).response.status, 403);
    assert.equal((await createBackup('observation-requester')).response.status, 403);
    await pool.query("UPDATE app_users SET role='admin' WHERE username='observation-admin'");
    await guard.setEnabled(false); await pool.query('ALTER TABLE schema_migrations RENAME TO fixture_observation_missing_migrations'); renamed = true; await guard.setEnabled(true);
    await assert.rejects(readMigrationStatus(), error => error.code === '42P01');
    const unavailable = await onboarding(); assertRead(unavailable); assert.equal(databaseStep(unavailable).status, 'unavailable');
    assert.equal(databaseStep(unavailable).message, 'Database migration status is unavailable. Refresh to try again.');
    assert.equal(unavailable.payload.summary.status, 'attention');
    assert.equal(unavailable.payload.summary.issueCount, current.payload.summary.issueCount + 1);
    assert.doesNotMatch(JSON.stringify(databaseStep(unavailable)), /42P01|fixture_|SELECT|migration_status_unavailable|1 migration/u);
    assert.equal((await preview(firstId)).response.status, 500);
    assert.equal((await createBackup('observation-missing-schema')).response.status, 500); assert.equal(await artifactCount(), 3);
    await guard.setEnabled(false); await pool.query('ALTER TABLE fixture_observation_missing_migrations RENAME TO schema_migrations'); renamed = false; await guard.setEnabled(true);
    const restored = await onboarding(); assertRead(restored); assert.equal(databaseStep(restored).status, 'complete');
    assert.deepEqual(await guard.getCatalogIdentity(), catalogBefore);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='backup_export_created'")).rows[0].count, 3);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM backup_artifact_file_operations WHERE status<>'completed'")).rows[0].count, 0);
    t.diagnostic(JSON.stringify({ schemaWriteGuardVerified: true, readOnlyTransaction: true, concurrentReads: 20, overlappingBackup: true,
      encryptedFilesAndManifestsVerified: 3, idempotentReplay: true, pendingMigrationRefusal: true, missingSchemaNotRepaired: true,
      administratorOnly: true, csrfRequired: true, noStore: true, catalogIdentityUnchanged: true, auditAndJournalVerified: true,
      restoreAppliedWithoutSchemaWrites: true, unavailableMigrationDistinct: true }));
  }, async () => {
    if (guard) await guard.setEnabled(false);
    if (renamed) await pool.query('ALTER TABLE fixture_observation_missing_migrations RENAME TO schema_migrations');
    if (pendingFilename) await pool.query("UPDATE schema_migrations SET status='applied' WHERE filename=$1", [pendingFilename]);
    if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
      runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); });
      await drainApplicationWorkerOwners(app); await closePool();
    } }); else await closePool();
    await rm(anchor, { recursive: true, force: true });
  });
});
