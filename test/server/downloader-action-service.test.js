import assert from 'node:assert/strict';
import test from 'node:test';
import { createDownloaderActionService } from '../../src/server/downloader/downloader-action-service.js';

function createActiveTransfer(overrides = {}) {
  return {
    id: 'transfer-1',
    state: 'InProgress',
    username: 'source-user',
    ...overrides,
  };
}

function createActionService(t, overrides = {}) {
  const cancelDownload = t.mock.fn(async ({ id, remove, username }) => ({
    action: remove ? 'remove' : 'cancel',
    id,
    ok: true,
    provider: 'slskd',
    sourceUser: username,
  }));
  const clearCompletedDownloads = t.mock.fn(async () => ({
    action: 'clear_completed',
    ok: true,
    provider: 'slskd',
  }));
  const getDownload = t.mock.fn(async () => createActiveTransfer());
  const recordAuditEventFn = t.mock.fn(async () => {});

  return {
    cancelDownload,
    clearCompletedDownloads,
    getDownload,
    recordAuditEventFn,
    service: createDownloaderActionService({
      cancelDownload,
      clearCompletedDownloads,
      getDownload,
      getRequestMetadataFn: () => ({
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      }),
      recordAuditEventFn,
      ...overrides,
    }),
  };
}

test('createDownloaderActionService cancels active transfers after re-reading provider state', async (t) => {
  const { cancelDownload, getDownload, recordAuditEventFn, service } = createActionService(t);

  const result = await service.requestTransferAction({
    action: ' cancel ',
    actorUserId: 'admin-1',
    id: ' transfer-1 ',
    request: { headers: {}, socket: {} },
    username: ' source-user ',
  });

  assert.deepEqual(getDownload.mock.calls[0].arguments, [{
    id: 'transfer-1',
    username: 'source-user',
  }]);
  assert.deepEqual(cancelDownload.mock.calls[0].arguments, [{
    id: 'transfer-1',
    remove: false,
    username: 'source-user',
  }]);
  assert.equal(result.action, 'cancel');
  assert.equal(result.state.code, 'active');
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'downloader_transfer_cancel');
});

test('createDownloaderActionService removes terminal transfers', async (t) => {
  const getDownload = t.mock.fn(async () => createActiveTransfer({ exception: 'Remote transfer failed', state: 'Completed, Errored' }));
  const { cancelDownload, service } = createActionService(t, { getDownload });

  const result = await service.requestTransferAction({
    action: 'remove',
    actorUserId: 'admin-1',
    id: 'transfer-2',
    username: 'source-user',
  });

  assert.deepEqual(cancelDownload.mock.calls[0].arguments, [{
    id: 'transfer-2',
    remove: true,
    username: 'source-user',
  }]);
  assert.equal(result.action, 'remove');
  assert.equal(result.state.code, 'failed');
});

test('createDownloaderActionService rejects unsupported and disallowed transfer actions', async (t) => {
  const { cancelDownload, service } = createActionService(t);

  await assert.rejects(
    () => service.requestTransferAction({
      action: 'retry',
      actorUserId: 'admin-1',
      id: 'transfer-1',
      username: 'source-user',
    }),
    (error) => error.status === 400 && error.code === 'downloader_action_not_supported',
  );
  await assert.rejects(
    () => service.requestTransferAction({
      action: 'remove',
      actorUserId: 'admin-1',
      id: 'transfer-1',
      username: 'source-user',
    }),
    (error) => error.status === 409 && error.code === 'downloader_action_not_allowed',
  );
  assert.equal(cancelDownload.mock.callCount(), 0);
});

test('createDownloaderActionService clears completed downloads and records audit', async (t) => {
  const { clearCompletedDownloads, recordAuditEventFn, service } = createActionService(t);

  const result = await service.clearCompleted({
    actorUserId: 'admin-1',
  });

  assert.equal(clearCompletedDownloads.mock.callCount(), 1);
  assert.deepEqual(result, {
    action: 'clear_completed',
    ok: true,
    provider: 'slskd',
  });
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'downloader_completed_cleared');
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].entityType, 'downloader_queue');
});

test('createDownloaderActionService validates required dependencies', () => {
  assert.throws(
    () => createDownloaderActionService(),
    /requires getDownload/,
  );
  assert.throws(
    () => createDownloaderActionService({ getDownload: async () => {} }),
    /requires cancelDownload/,
  );
  assert.throws(
    () => createDownloaderActionService({ cancelDownload: async () => {}, getDownload: async () => {} }),
    /requires clearCompletedDownloads/,
  );
});
