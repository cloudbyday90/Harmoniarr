/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createJobLeaseStore } from '../../src/server/job-lease-store.js';
import { createOperationRunStore } from '../../src/server/operation-run-store.js';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../../src/server/recovery/maintenance-lock-write-guard-service.js';
import { executeLibraryScan } from '../../src/server/library/library-scan-executor.js';
import { createLibraryCatalogStore } from '../../src/server/library/library-catalog-store.js';
import { createLibraryScanCatalogueService } from '../../src/server/library/library-scan-catalogue-service.js';
import { prepareLibraryTestSchema } from './library-test-schema-preparation.js';
import { withFixtureWorkScope } from './fixture-work-scope.js';
import { withFixtureWorkspace } from './fixture-workspace.js';

export async function observeCatalogueFixtureFiles(libraryRoot) {
  const files = [];
  const summary = await executeLibraryScan({ libraryRoot, onFile: async (file) => { files.push(file); } });
  return { files, summary };
}

export async function snapshotCatalogueFixture(context) {
  return { root: (await context.pool.query('SELECT * FROM library_roots ORDER BY id')).rows,
    files: (await context.pool.query('SELECT * FROM library_files ORDER BY id')).rows };
}

/** Fresh filesystem and seed state stay outside the migrated template source. */
export async function withLibraryScanCatalogueScenario(runtime, testContext, callback, {
  empty = false, signal = testContext.signal, workspaceOptions = {},
} = {}) {
  return runtime.runIsolatedDatabase(async ({ getPoolFn, databaseName, phaseObserver }) => {
    await prepareLibraryTestSchema({ getPoolFn, phaseObserver, signal });
    return withFixtureWorkspace({ prefix: 'harmoniarr-scan-catalogue-', ...workspaceOptions }, async ({ requestedRoot, rootPath }) => {
      const fixture = await phaseObserver.measure('fixture_seed', async () => {
        const pool = getPoolFn();
        const stable = join(rootPath, 'stable.flac');
        const old = join(rootPath, 'old.flac');
        const newFile = join(rootPath, 'new.flac');
        const cover = join(rootPath, 'cover.jpg');
        const oldBytes = Buffer.from('Old observed bytes');
        const replacementBytes = Buffer.from('Current replacement bytes are longer');
        const catalog = createLibraryCatalogStore({ getPoolFn });
        let seed;
        if (!empty) {
          await writeFile(stable, oldBytes); await writeFile(old, oldBytes); await writeFile(cover, 'ignored cover fixture');
          const observed = await observeCatalogueFixtureFiles(requestedRoot);
          seed = await catalog.recordLibraryFiles({ libraryRootPath: observed.summary.libraryRoot, files: observed.files });
          await pool.query(`UPDATE library_files SET tag_payload='{"title":"Retained tag"}'::jsonb,
            tag_extracted_size_bytes=size_bytes,tag_extracted_modified_at=modified_at WHERE canonical_path=$1`, [stable]);
        }
        const makeRuns = (ownerInstanceId, operationType = 'library_scan') => createOperationRunStore({ getPoolFn,
          operationType, leaseJobType: operationType,
          createJobLeaseStoreFn: () => createJobLeaseStore({ getPoolFn, ownerInstanceId, leaseDurationMs: 60_000 }),
        });
        const a = makeRuns('scan-original'); const b = makeRuns('scan-replacement');
        const run = await a.createOperationRun({ status: 'pending', summary: { libraryRoot: requestedRoot } });
        const maintenance = createMaintenanceLockService({ getPoolFn });
        const guard = createMaintenanceLockWriteGuardService({ listActiveMaintenanceLocks: maintenance.listActiveMaintenanceLocks });
        const withTransaction = createDatabaseTransactionRunner({ getPoolFn });
        const createOwner = (recordLibraryFiles = catalog.recordLibraryFiles) => createLibraryScanCatalogueService({
          recordLibraryFiles, withTransaction,
          assertMaintenanceWriteAllowed: ({ queryable }) => guard.assertNoActiveWriteLocks({ queryable }),
        });
        return { getPoolFn, pool, databaseName, rootPath, requestedRoot, stable, old, newFile, cover, oldBytes,
          replacementBytes, seed, catalog, a, b, run, maintenance, guard, withTransaction, makeRuns, createOwner,
          owner: createOwner() };
      });
      return phaseObserver.measure('scenario_work', () => withFixtureWorkScope({ signal },
        (scope) => callback({ ...fixture, scope })));
    });
  }, { signal });
}
