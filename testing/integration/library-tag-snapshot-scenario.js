/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createJobLeaseStore } from '../../src/server/job-lease-store.js';
import { createOperationRunStore } from '../../src/server/operation-run-store.js';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../../src/server/recovery/maintenance-lock-write-guard-service.js';
import { executeLibraryScan } from '../../src/server/library/library-scan-executor.js';
import { createLibraryCatalogStore } from '../../src/server/library/library-catalog-store.js';
import { createLibraryScanCatalogueService } from '../../src/server/library/library-scan-catalogue-service.js';
import { createLibraryTagSnapshotStore } from '../../src/server/library/library-tag-snapshot-store.js';
import { createLibraryTagSnapshotService } from '../../src/server/library/library-tag-snapshot-service.js';
import { withFixtureWorkScope } from './fixture-work-scope.js';
import { withFixtureWorkspace } from './fixture-workspace.js';

export function taggedWav(title, samples = 800) {
  const chunk = (name, data) => {
    const header = Buffer.alloc(8); header.write(name); header.writeUInt32LE(data.length, 4);
    return Buffer.concat([header, data, ...(data.length % 2 ? [Buffer.alloc(1)] : [])]);
  };
  const format = Buffer.alloc(16);
  format.writeUInt16LE(1); format.writeUInt16LE(1, 2); format.writeUInt32LE(8000, 4);
  format.writeUInt32LE(16000, 8); format.writeUInt16LE(2, 12); format.writeUInt16LE(16, 14);
  const body = Buffer.concat([chunk('fmt ', format),
    chunk('LIST', Buffer.concat([Buffer.from('INFO'), chunk('INAM', Buffer.from(`${title}\0`))])),
    chunk('data', Buffer.alloc(samples * 2))]);
  const header = Buffer.alloc(12); header.write('RIFF'); header.writeUInt32LE(body.length + 4, 4); header.write('WAVE', 8);
  return Buffer.concat([header, body]);
}

export async function observeTagFixtureFiles(root) {
  const files = [];
  const summary = await executeLibraryScan({ libraryRoot: root, onFile: async (file) => { files.push(file); } });
  return { files, summary };
}

export async function snapshotTagFixture(context) {
  return { files: (await context.pool.query('SELECT * FROM library_files ORDER BY id')).rows,
    history: (await context.pool.query('SELECT * FROM file_tag_snapshots ORDER BY id')).rows };
}

export async function withLibraryTagSnapshotScenario(runtime, testContext, callback, {
  signal = testContext.signal, workspaceOptions = {},
} = {}) {
  return runtime.runIsolatedDatabase(async ({ getPoolFn, databaseName }) => {
    await applyPendingMigrations({ getPoolFn });
    return withFixtureWorkspace({ prefix: 'harmoniarr-tag-snapshot-', ...workspaceOptions }, ({ requestedRoot, rootPath }) =>
      withFixtureWorkScope({ signal }, async (scope) => {
        const pool = getPoolFn(); const path = join(rootPath, '01-original.wav');
        await writeFile(path, taggedWav('Original title'));
        const catalog = createLibraryCatalogStore({ getPoolFn });
        const initial = await observeTagFixtureFiles(requestedRoot);
        const seeded = await catalog.recordLibraryFiles({ libraryRootPath: initial.summary.libraryRoot, files: initial.files });
        const file = seeded.files[0];
        const makeRuns = (ownerInstanceId, operationType = 'library_scan') => createOperationRunStore({ getPoolFn,
          operationType, leaseJobType: operationType,
          createJobLeaseStoreFn: () => createJobLeaseStore({ getPoolFn, ownerInstanceId, leaseDurationMs: 60_000 }) });
        const a = makeRuns('tag-original'); const b = makeRuns('tag-replacement');
        const run = await a.createOperationRun({ status: 'pending', summary: { libraryRoot: requestedRoot } });
        const maintenance = createMaintenanceLockService({ getPoolFn });
        const guard = createMaintenanceLockWriteGuardService({ listActiveMaintenanceLocks: maintenance.listActiveMaintenanceLocks });
        const withTransaction = createDatabaseTransactionRunner({ getPoolFn });
        const assertMaintenanceWriteAllowed = ({ queryable }) => guard.assertNoActiveWriteLocks({ queryable });
        const scanCatalogue = createLibraryScanCatalogueService({ recordLibraryFiles: catalog.recordLibraryFiles,
          withTransaction, assertMaintenanceWriteAllowed });
        const rawTags = createLibraryTagSnapshotStore({ getPoolFn });
        const createTagOwner = (writeLibraryFileTagSnapshot = rawTags.writeLibraryFileTagSnapshot) => createLibraryTagSnapshotService({
          writeLibraryFileTagSnapshot, withTransaction, assertMaintenanceWriteAllowed });
        return callback({ getPoolFn, pool, databaseName, scope, requestedRoot, rootPath, path, file, rootId: seeded.libraryRootId,
          a, b, run, maintenance, withTransaction, makeRuns, catalog, scanCatalogue, rawTags, createTagOwner,
          tagOwner: createTagOwner() });
      }));
  }, { signal });
}
