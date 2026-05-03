import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { createLibraryOrganizeApplyService } from '../../src/server/library/library-organize-apply-service.js';

test('startLibraryOrganizeApplyRun queues a run when organize preview requires changes', async (t) => {
  const createOperationRun = t.mock.fn(async () => ({
    id: 'organize-run-1',
    status: 'pending',
  }));
  const buildLibraryOrganizePreview = t.mock.fn(async () => ({
    counts: {
      renameRequiredCount: 2,
    },
  }));

  const service = createLibraryOrganizeApplyService({
    buildLibraryOrganizePreview,
    createOperationRun,
    getActiveRun: async () => null,
    recordAuditEventFn: async () => {},
  });

  const result = await service.startLibraryOrganizeApplyRun({ triggeredByUserId: 'user-2' });

  assert.equal(result.accepted, true);
  assert.deepEqual(createOperationRun.mock.calls[0].arguments, [{
    plannedRenameCount: 2,
    status: 'pending',
    triggeredByUserId: 'user-2',
  }]);
});

test('startLibraryOrganizeApplyRun rejects when organize preview has no required changes', async () => {
  const service = createLibraryOrganizeApplyService({
    buildLibraryOrganizePreview: async () => ({
      counts: {
        renameRequiredCount: 0,
      },
    }),
  });

  await assert.rejects(
    () => service.startLibraryOrganizeApplyRun(),
    (error) => error.code === 'library_organize_apply_not_ready',
  );
});

test('startLibraryOrganizeApplyRun rejects when maintenance lock blocks unsafe writes', async () => {
  const service = createLibraryOrganizeApplyService({
    assertMaintenanceWriteAllowed: async () => {
      throw createApiError(409, 'recovery_lock_conflict', 'A conflicting maintenance lock prevents library organize apply');
    },
  });

  await assert.rejects(
    () => service.startLibraryOrganizeApplyRun(),
    (error) => error.code === 'recovery_lock_conflict',
  );
});
