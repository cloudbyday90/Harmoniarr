/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { after, before, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { createScopedFixtureGate, startScopedFixtureWork, withFixtureWorkScope } from '../../testing/integration/fixture-work-scope.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createJobLeaseStore } from '../../src/server/job-lease-store.js';
import { createOperationRunStore } from '../../src/server/operation-run-store.js';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../../src/server/recovery/maintenance-lock-write-guard-service.js';
import { createLibraryCatalogStore } from '../../src/server/library/library-catalog-store.js';
import { createLibraryFileMatchStore } from '../../src/server/library/library-file-match-store.js';
import { createLibraryReleaseCoverageStore } from '../../src/server/library/library-release-coverage-store.js';
import { createLibraryReleaseReconciliationStore } from '../../src/server/library/library-release-reconciliation-store.js';
import { createLibraryReleaseReconciliationService } from '../../src/server/library/library-release-reconciliation-service.js';
import { mapReleaseCoverageRows } from '../../src/server/library/library-release-reconciliation-policy.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime; let unavailable;

async function scenario(t, work) {
  if (unavailable) { t.skip(unavailable); return; }
  await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn }); const pool = getPoolFn();
    const libraryRoot = resolve('.tmp', `release-lifecycle-${randomUUID()}`);
    const observed = await createLibraryCatalogStore({ getPoolFn }).recordLibraryFiles({ libraryRootPath: libraryRoot,
      files: [{ canonicalPath: join(libraryRoot, 'track.flac'), relativePath: 'track.flac', filename: 'track.flac',
        fileState: 'observed', extension: '.flac', sizeBytes: 100, modifiedAt: '2026-10-10T00:00:00.000Z' }] });
    const metadata = await seedMetadataReleaseFixture({ queryable: pool });
    await createLibraryFileMatchStore({ getPoolFn }).writeLibraryFileMatchBatch({ matches: [{
      libraryFileId: observed.files[0].id, metadataArtistId: metadata.metadataArtistId,
      metadataReleaseGroupId: metadata.metadataReleaseGroupId, metadataReleaseId: metadata.metadataReleaseId,
      metadataMediumId: metadata.metadataMediumId, metadataTrackId: metadata.metadataTrackId,
      metadataRecordingId: metadata.metadataRecordingId, matchStatus: 'matched', confidence: 'high',
      matchedBy: 'release-lifecycle-fixture', evidence: {},
    }] });
    const coverage = createLibraryReleaseCoverageStore();
    const raw = createLibraryReleaseReconciliationStore({ getPoolFn });
    await raw.replaceLibraryReleaseReconciliations({ reconciliations: mapReleaseCoverageRows(
      await coverage.loadLibraryReleaseCoverageRows({ queryable: pool })) });
    const runs = createOperationRunStore({ getPoolFn, operationType: 'library_scan', leaseJobType: 'library_scan',
      createJobLeaseStoreFn: () => createJobLeaseStore({ getPoolFn, ownerInstanceId: 'release-lifecycle-fixture', leaseDurationMs: 60_000 }) });
    const run = await runs.createOperationRun({ status: 'pending', summary: { libraryRoot } });
    const maintenance = createMaintenanceLockService({ getPoolFn });
    const guard = createMaintenanceLockWriteGuardService({ listActiveMaintenanceLocks: maintenance.listActiveMaintenanceLocks });
    const assertMaintenanceWriteAllowed = ({ queryable }) => guard.assertNoActiveWriteLocks({ queryable });
    const withTransaction = createDatabaseTransactionRunner({ getPoolFn });
    const snapshot = async () => (await pool.query('SELECT * FROM library_release_reconciliations ORDER BY metadata_release_id')).rows;
    const initial = await snapshot();
    await work({ pool, run, runs, coverage, raw, withTransaction, assertMaintenanceWriteAllowed, initial, snapshot,
      input: (lease) => ({ runId: run.id, expectedLease: lease, requestedLibraryRoot: libraryRoot,
        libraryRootPath: libraryRoot, libraryRootId: observed.libraryRootId }) });
  }, { signal: t.signal });
}

async function assertIdleAndReleased(c, lease) {
  const row = (await c.pool.query('SELECT released_at FROM job_leases WHERE lease_key=$1', [lease.leaseKey])).rows[0];
  assert.ok(row.released_at);
  assert.equal((await c.pool.query(`SELECT COUNT(*)::integer AS count FROM pg_stat_activity
    WHERE datname=current_database() AND state LIKE 'idle in transaction%'`)).rows[0].count, 0);
  assert.deepEqual(await c.snapshot(), c.initial);
}

suite('Release fixture owned work settles before lease and database cleanup', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) { if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailable = toIntegrationRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('a real coverage SQL failure refuses readiness and drains rollback before exact lease release', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    let lease; let queryFailure; let writes = 0; let settled = false;
    await assert.rejects(withFixtureWorkScope({ signal: t.signal }, async (scope) => {
      lease = await c.runs.acquireLease({ runId: c.run.id });
      scope.onAfterDrain(async () => { assert.equal(settled, true);
        await c.runs.releaseLease({ runId: c.run.id, expectedLease: lease, status: 'completed' }); });
      assert.equal(await c.runs.markRunStarted({ runId: c.run.id, expectedLease: lease }), true);
      const ready = createScopedFixtureGate(scope);
      const owner = createLibraryReleaseReconciliationService({ withTransaction: c.withTransaction,
        assertMaintenanceWriteAllowed: c.assertMaintenanceWriteAllowed,
        coverageStore: { loadLibraryReleaseCoverageRows: async ({ queryable }) => {
          await c.coverage.loadLibraryReleaseCoverageRows({ queryable });
          try { await queryable.query('SELECT 1/0'); } catch (error) { queryFailure = error; throw error; }
          ready.release();
        } },
        libraryReleaseReconciliationStore: { replaceLibraryReleaseReconciliations: async (input) => {
          writes += 1; return c.raw.replaceLibraryReleaseReconciliations(input);
        } },
      });
      const operation = startScopedFixtureWork(scope, () => owner.reconcileLibraryReleases(c.input(lease)))
        .finally(() => { settled = true; });
      await waitForFixtureReady({ ready: ready.promise, operation, signal: scope.signal });
      assert.fail('An unsuccessful coverage query cannot reach readiness');
    }), (error) => error === queryFailure && error.code === '22012');
    assert.equal(writes, 0); await assertIdleAndReleased(c, lease);
  }));

  test('held cancellation rolls back owned projection work before lease finalizers can contend on its locks', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const cancelled = new Error('Controlled release fixture cancellation'); const controller = new AbortController();
    const order = []; let lease; let writes = 0; let settled = false;
    await assert.rejects(withFixtureWorkScope({ signal: AbortSignal.any([t.signal, controller.signal]) }, async (scope) => {
      lease = await c.runs.acquireLease({ runId: c.run.id });
      // Register before the held gate: an early FIFO lease release would wait on this transaction's row locks.
      scope.onAfterDrain(async () => { assert.equal(settled, true);
        await c.runs.releaseLease({ runId: c.run.id, expectedLease: lease, status: 'completed' }); order.push('lease_released'); });
      assert.equal(await c.runs.markRunStarted({ runId: c.run.id, expectedLease: lease }), true);
      const entered = createScopedFixtureGate(scope); const resume = createScopedFixtureGate(scope);
      const owner = createLibraryReleaseReconciliationService({ withTransaction: c.withTransaction,
        assertMaintenanceWriteAllowed: c.assertMaintenanceWriteAllowed,
        coverageStore: { loadLibraryReleaseCoverageRows: async (input) => {
          const rows = await c.coverage.loadLibraryReleaseCoverageRows(input);
          entered.release((await input.queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
          await resume.promise; return rows;
        } },
        libraryReleaseReconciliationStore: { replaceLibraryReleaseReconciliations: async (input) => {
          writes += 1; return c.raw.replaceLibraryReleaseReconciliations(input);
        } },
      });
      const operation = startScopedFixtureWork(scope, () => owner.reconcileLibraryReleases(c.input(lease)))
        .finally(() => { settled = true; order.push('work_settled'); });
      const pid = await waitForFixtureReady({ ready: entered.promise, operation, signal: scope.signal });
      assert.ok((await c.pool.query("SELECT 1 FROM pg_locks WHERE pid=$1 AND locktype='advisory' AND granted", [pid])).rowCount);
      controller.abort(cancelled); await operation;
    }), (error) => error === cancelled);
    assert.deepEqual(order, ['work_settled', 'lease_released']);
    assert.equal(writes, 0); await assertIdleAndReleased(c, lease);
  }));
});
