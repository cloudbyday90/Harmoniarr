/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from '../../src/server/app.js';
import { createSystemModule } from '../../src/server/system-module.js';
import { createBackupRestoreApplyService } from '../../src/server/recovery/backup-restore-apply-service.js';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { createImportCandidateApplyOperationService } from '../../src/server/import-candidates/import-candidate-apply-operation-service.js';
import { replaceImportApplyRunItems, listImportApplyRunItems } from '../../src/server/import-candidates/import-candidate-apply-repository.js';
import { createOperationRunStore } from '../../src/server/operation-run-store.js';
import { persistSettings } from '../../src/server/settings.js';
import { createControlPlaneRedactionService } from '../../src/server/control-plane-redaction-service.js';
import { createSessionHttpClient } from '../../src/shared/http-session-client.js';
import { getPool, closePool } from '../../src/server/database.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();

test('actual filesystem failures persist safe restore/import explanations and survive root changes in authenticated diagnostics', { timeout: 60_000 }, async t => {
  t.after(closePool);
  const application = createApp({ clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json',
    createSystemModule: options => createSystemModule({ ...options, dependencyHealthService: { getDependencyHealth: async () => [] } }),
  });
  const server = createServer(application.app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const client = createSessionHttpClient(`http://127.0.0.1:${server.address().port}`);
  const workdir = await mkdtemp('/tmp/structured-failure-');
  try {
    const routes = ['/api/v1/system/diagnostics/recovery-state', '/api/v1/system/diagnostics/queue-state', '/api/v1/system/diagnostics/export'];
    for (const route of routes) assert.equal((await client.requestJson(route)).response.status, 401);
    assert.equal((await client.requestJson('/api/v1/bootstrap/admin', { method: 'POST',
      json: { username: 'structured-admin', password: 'StructuredFixture123!' } })).response.status, 201);
    const privateRoot = '/opaque-private-音乐 Room', sourcePath = `${privateRoot}/Backup Name.json`;
    await persistSettings([{ namespace: 'paths', settingKey: 'music', value: privateRoot }]);
    const locks = createMaintenanceLockService();
    const restore = createBackupRestoreApplyService({ acquireMaintenanceLock: locks.acquireMaintenanceLock,
      releaseMaintenanceLock: locks.releaseMaintenanceLock,
      getBackupArtifactById: async () => ({ id: 'fixture-backup', storagePath: sourcePath }),
      getBackupRestorePreview: async () => ({ canApplyRestore: true }),
    });
    await assert.rejects(restore.startBackupRestoreApply({ backupArtifactId: 'fixture-backup' }), error => {
      assert.equal(error.code, 'ENOENT'); assert.doesNotMatch(error.message, /opaque-private|Backup Name/u); return true;
    });
    const run = (await getPool().query("SELECT * FROM operation_runs WHERE operation_type='backup_restore_apply'")).rows[0];
    assert.equal(run.status, 'failed'); assert.equal(run.summary.filesystemFailure.code, 'ENOENT');
    assert.equal(run.summary.filesystemFailure.sourcePath, sourcePath); assert.doesNotMatch(run.error_message, /opaque-private|Backup Name/u);
    const audit = (await getPool().query("SELECT details FROM audit_events WHERE event_type='backup_restore_failed'")).rows[0].details;
    assert.deepEqual(audit.filesystemFailure, run.summary.filesystemFailure);
    assert.equal((await locks.listActiveMaintenanceLocks()).length, 0);
    await persistSettings([{ namespace: 'paths', settingKey: 'music', value: '/replacement-root' }]);
    for (const route of routes) {
      const result = await client.requestJson(route); assert.equal(result.response.status, 200);
      assert.equal(result.response.headers.get('cache-control'), 'no-store');
      const text = JSON.stringify(result.payload); assert.doesNotMatch(text, /opaque-private|Backup Name/u);
      assert.match(text, /ENOENT/u); assert.match(text, /REDACTED_PATH/u); assert.ok(text.includes(run.id));
    }
    const source = join(workdir, 'Song Name.flac'), blocked = join(workdir, 'blocked');
    await writeFile(source, 'preserved-source'); await writeFile(blocked, 'parent-is-file');
    const candidate = (await getPool().query(`INSERT INTO import_candidates
      (source_provider,source_search_id,source_response_key,username,folder_path,raw_payload,normalized_payload,discovered_at)
      VALUES ('slskd','fixture-search','fixture-key','fixture-user',$1,'{}','{}',NOW()) RETURNING id`, [workdir])).rows[0];
    const file = (await getPool().query(`INSERT INTO import_candidate_files
      (import_candidate_id,source_file_index,filename,folder_path) VALUES ($1,0,'Song Name.flac',$2) RETURNING id`, [candidate.id, workdir])).rows[0];
    const importRun = await createOperationRunStore({ operationType: 'import_candidate_apply' }).createOperationRun({ status: 'running' });
    const result = await createImportCandidateApplyOperationService({ assertTrackScopeCurrent: async () => null }).applyImportCandidatePreview({
      importCandidateId: candidate.id, operationRunId: importRun.id, applyPreview: {
        summary: { status: 'ready' }, preview: { source: { resolvedFolderPath: workdir }, staging: { root: workdir }, library: { root: workdir } },
        files: [{ fileId: file.id, filename: 'Song Name.flac', status: { code: 'ready' }, sourceFile: { path: source, sizeBytes: 16 },
          stagingTarget: { path: join(blocked, 'Song Name.flac'), exists: false }, libraryTarget: { path: join(workdir, 'library.flac') } }],
      },
    });
    assert.equal(result.summary.failedFileCount, 1); const operation = result.fileOperations[0];
    assert.ok(['EEXIST', 'ENOTDIR'].includes(operation.filesystemFailure.code));
    assert.equal(operation.filesystemFailure.operation, 'import_file_stage');
    assert.doesNotMatch(operation.errorMessage, /structured-failure-|Song Name|blocked/u);
    assert.equal(await readFile(source, 'utf8'), 'preserved-source'); assert.equal(await readFile(blocked, 'utf8'), 'parent-is-file');
    const row = (await getPool().query('SELECT * FROM import_operations WHERE operation_run_id=$1', [importRun.id])).rows[0];
    assert.equal(row.error_message, operation.errorMessage); assert.equal(row.source_path, source); assert.equal(row.status, 'failed');
    await replaceImportApplyRunItems(importRun.id, [{ importCandidateId: candidate.id, position: 1, itemStatus: 'apply_failed',
      statusMessage: 'Library add failed.', applySnapshot: { fileOperations: result.fileOperations } }]);
    const [item] = await listImportApplyRunItems(importRun.id);
    assert.deepEqual(item.applySnapshot.fileOperations[0].filesystemFailure, operation.filesystemFailure);
    const redacted = createControlPlaneRedactionService({ settings: { paths: { music: '/replacement-root' } } }).redactValue(item.applySnapshot.fileOperations[0].filesystemFailure);
    assert.equal(redacted.sourcePath, '[REDACTED_PATH]'); assert.equal(redacted.destinationPath, '[REDACTED_PATH]');
    assert.equal(redacted.message, operation.errorMessage);
    t.diagnostic(JSON.stringify({ actualReadFailure: true, actualImportFailure: true, restoreRunAndAudit: true,
      importRowAndSnapshot: true, pathsMaskedAfterSettingsChange: true, lockReleased: true, sourcePreserved: true, authenticatedRoutes: 3 }));
  } finally {
    await application.systemModule.runtimeResourceMonitor.stop(); server.closeIdleConnections();
    await new Promise(resolve => { server.close(resolve); }); await rm(workdir, { recursive: true, force: true });
  }
});
