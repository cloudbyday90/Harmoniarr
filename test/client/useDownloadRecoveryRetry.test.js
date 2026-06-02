import assert from 'node:assert/strict';
import test from 'node:test';

import { useDownloadRecoveryRetry } from '../../src/client/composables/useDownloadRecoveryRetry.js';

function createToast(t) {
  return {
    error: t.mock.fn(),
    info: t.mock.fn(),
    success: t.mock.fn(),
  };
}

test('useDownloadRecoveryRetry queues retry and clears retrying state on success', async (t) => {
  const toast = createToast(t);
  const retryDownloadRecoveryDiscoveryRequest = t.mock.fn(async ({ metadataReleaseId }) => ({
    accepted: true,
    dispatchAlreadyActive: false,
    metadataReleaseId,
  }));
  const retry = useDownloadRecoveryRetry({ retryDownloadRecoveryDiscoveryRequest, toast });

  const result = await retry.retryDownloadRecovery({ metadataReleaseId: 'release-1' });

  assert.equal(retryDownloadRecoveryDiscoveryRequest.mock.callCount(), 1);
  assert.deepEqual(retryDownloadRecoveryDiscoveryRequest.mock.calls[0].arguments[0], {
    metadataReleaseId: 'release-1',
  });
  assert.equal(toast.success.mock.callCount(), 1);
  assert.equal(toast.success.mock.calls[0].arguments[0], 'Recovery retry queued.');
  assert.equal(retry.isRetrying('release-1'), false);
  assert.equal(result.ok, true);
});

test('useDownloadRecoveryRetry shows an info toast when discovery is already active', async (t) => {
  const toast = createToast(t);
  const retry = useDownloadRecoveryRetry({
    retryDownloadRecoveryDiscoveryRequest: async () => ({
      accepted: true,
      dispatchAlreadyActive: true,
    }),
    toast,
  });

  const result = await retry.retryDownloadRecovery('release-1');

  assert.equal(result.ok, true);
  assert.equal(toast.info.mock.callCount(), 1);
  assert.equal(toast.success.mock.callCount(), 0);
});

test('useDownloadRecoveryRetry skips missing metadata release ids', async (t) => {
  const toast = createToast(t);
  const retryDownloadRecoveryDiscoveryRequest = t.mock.fn(async () => ({ accepted: true }));
  const retry = useDownloadRecoveryRetry({ retryDownloadRecoveryDiscoveryRequest, toast });

  const result = await retry.retryDownloadRecovery({});

  assert.deepEqual(result, { ok: false, skipped: true });
  assert.equal(retryDownloadRecoveryDiscoveryRequest.mock.callCount(), 0);
  assert.equal(toast.error.mock.callCount(), 1);
  assert.equal(retry.errorMessage.value, 'Cannot retry recovery without a metadata release id.');
});

test('useDownloadRecoveryRetry records API errors and clears retrying state', async (t) => {
  const toast = createToast(t);
  const apiError = new Error('Retry not available');
  const retry = useDownloadRecoveryRetry({
    retryDownloadRecoveryDiscoveryRequest: async () => {
      throw apiError;
    },
    toast,
  });

  const result = await retry.retryDownloadRecovery({ metadataReleaseId: 'release-1' });

  assert.equal(result.ok, false);
  assert.equal(result.error, apiError);
  assert.equal(retry.errorMessage.value, 'Retry not available');
  assert.equal(retry.isRetrying('release-1'), false);
  assert.equal(toast.error.mock.callCount(), 1);
});
