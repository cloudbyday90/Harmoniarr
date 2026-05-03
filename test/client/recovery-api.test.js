import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBackupExportDownloadUrl,
  deleteBackupExport,
  enterMaintenanceLock,
  fetchBackupExportById,
  fetchBackupExports,
  fetchBackupRestorePreview,
  fetchQueueDiagnostics,
  fetchRecoveryDiagnostics,
  releaseMaintenanceLock,
  startBackupExport,
  startBackupRestoreApply,
} from '../../src/client/lib/recovery-api.js';

function createJsonResponse({ ok = true, payload = { ok: true }, status = 200 } = {}) {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

test('recovery-api read routes use the shared api client contract', async (t) => {
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchBackupExports({ limit: 5 });
  await fetchBackupExportById('backup 1');
  await fetchBackupRestorePreview('backup 1');
  await fetchQueueDiagnostics({ runLimit: 10 });
  await fetchRecoveryDiagnostics({ auditLimit: 5, runLimit: 8 });

  assert.equal(globalThis.fetch.mock.callCount(), 5);
  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/recovery/backups?limit=5');
  assert.equal(globalThis.fetch.mock.calls[1].arguments[0], '/api/v1/recovery/backups/backup%201');
  assert.equal(globalThis.fetch.mock.calls[2].arguments[0], '/api/v1/recovery/backups/backup%201/restore-preview');
  assert.equal(globalThis.fetch.mock.calls[3].arguments[0], '/api/v1/system/diagnostics/queue-state?runLimit=10');
  assert.equal(globalThis.fetch.mock.calls[4].arguments[0], '/api/v1/system/diagnostics/recovery-state?auditLimit=5&runLimit=8');
});

test('recovery-api mutation routes include CSRF and idempotency headers', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-recovery' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await startBackupExport();
  await deleteBackupExport('backup 1');
  await startBackupRestoreApply('backup 1', { expectedPayloadSha256: 'sha-1' });
  await enterMaintenanceLock({
    expiresAt: '2026-05-03T12:00:00.000Z',
    lockType: 'maintenance',
    reason: 'Patch window',
  });
  await releaseMaintenanceLock('lock 1');

  assert.equal(globalThis.fetch.mock.callCount(), 5);

  const [createCall, deleteCall, restoreCall, enterLockCall, releaseLockCall] = globalThis.fetch.mock.calls;

  assert.equal(createCall.arguments[0], '/api/v1/recovery/backups');
  assert.equal(createCall.arguments[1].headers.get('X-CSRF-Token'), 'csrf-recovery');
  assert.match(createCall.arguments[1].headers.get('Idempotency-Key'), /^recovery-backups-create-/);

  assert.equal(deleteCall.arguments[0], '/api/v1/recovery/backups/backup%201');
  assert.equal(deleteCall.arguments[1].method, 'DELETE');
  assert.match(deleteCall.arguments[1].headers.get('Idempotency-Key'), /^recovery-backups-delete-/);

  assert.equal(restoreCall.arguments[0], '/api/v1/recovery/backups/backup%201/restore-apply');
  assert.equal(restoreCall.arguments[1].body, JSON.stringify({ expectedPayloadSha256: 'sha-1' }));
  assert.match(restoreCall.arguments[1].headers.get('Idempotency-Key'), /^recovery-backups-restore-apply-/);

  assert.equal(enterLockCall.arguments[0], '/api/v1/recovery/maintenance-locks');
  assert.equal(enterLockCall.arguments[1].body, JSON.stringify({
    expiresAt: '2026-05-03T12:00:00.000Z',
    lockType: 'maintenance',
    reason: 'Patch window',
  }));
  assert.match(enterLockCall.arguments[1].headers.get('Idempotency-Key'), /^recovery-maintenance-locks-enter-/);

  assert.equal(releaseLockCall.arguments[0], '/api/v1/recovery/maintenance-locks/lock%201/release');
  assert.equal(releaseLockCall.arguments[1].method, 'POST');
  assert.match(releaseLockCall.arguments[1].headers.get('Idempotency-Key'), /^recovery-maintenance-locks-release-/);
});

test('buildBackupExportDownloadUrl preserves encoded artifact ids', () => {
  assert.equal(
    buildBackupExportDownloadUrl('backup 1'),
    '/api/v1/recovery/backups/backup%201/download',
  );
});
