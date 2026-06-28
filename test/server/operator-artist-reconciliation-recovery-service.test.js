import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOperatorArtistReconciliationRecoveryService,
  shouldRecoverFailedOperatorArtistReconciliation,
} from '../../src/server/metadata/operator-artist-reconciliation-recovery-service.js';

test('shouldRecoverFailedOperatorArtistReconciliation allows one failed-run recovery with a saved snapshot', () => {
  assert.equal(shouldRecoverFailedOperatorArtistReconciliation({
    latestRun: { id: 'run-1', status: 'failed', triggerSource: 'save' },
    latestSnapshot: { id: 'snapshot-1' },
    pendingRun: null,
    runningRun: null,
  }), true);
});

test('shouldRecoverFailedOperatorArtistReconciliation blocks active and already recovered runs', () => {
  assert.equal(shouldRecoverFailedOperatorArtistReconciliation({
    latestRun: { id: 'run-1', status: 'failed', triggerSource: 'save' },
    latestSnapshot: { id: 'snapshot-1' },
    pendingRun: { id: 'run-pending' },
  }), false);
  assert.equal(shouldRecoverFailedOperatorArtistReconciliation({
    latestRun: { id: 'run-1', status: 'failed', triggerSource: 'failure_recovery' },
    latestSnapshot: { id: 'snapshot-1' },
  }), false);
  assert.equal(shouldRecoverFailedOperatorArtistReconciliation({
    latestRun: { id: 'run-1', status: 'completed', triggerSource: 'save' },
    latestSnapshot: { id: 'snapshot-1' },
  }), false);
});

test('recoverFailedOperatorArtistReconciliation queues failure recovery through the shared reconciliation service', async (t) => {
  const queueOperatorArtistReconciliation = t.mock.fn(async (input) => ({
    accepted: true,
    queuedBehindRun: false,
    run: { id: 'run-recovery', status: 'pending', triggerSource: input.triggerSource },
  }));
  const service = createOperatorArtistReconciliationRecoveryService({
    queueOperatorArtistReconciliation,
  });

  const result = await service.recoverFailedOperatorArtistReconciliation({
    appUserId: 'user-1',
    latestRun: { id: 'run-1', status: 'failed', triggerSource: 'save' },
    latestSnapshot: { id: 'snapshot-1' },
    metadataArtistId: 'artist-1',
  });

  assert.deepEqual(queueOperatorArtistReconciliation.mock.calls[0].arguments[0], {
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    triggerSource: 'failure_recovery',
  });
  assert.deepEqual(result, {
    attempted: true,
    errorMessage: null,
    queuedBehindRun: false,
    run: { id: 'run-recovery', status: 'pending', triggerSource: 'failure_recovery' },
    status: 'queued',
  });
});

test('recoverFailedOperatorArtistReconciliation returns failed recovery state without throwing', async () => {
  const service = createOperatorArtistReconciliationRecoveryService({
    queueOperatorArtistReconciliation: async () => {
      throw new Error('database offline');
    },
  });

  const result = await service.recoverFailedOperatorArtistReconciliation({
    appUserId: 'user-1',
    latestRun: { id: 'run-1', status: 'failed', triggerSource: 'save' },
    latestSnapshot: { id: 'snapshot-1' },
    metadataArtistId: 'artist-1',
  });

  assert.deepEqual(result, {
    attempted: true,
    errorMessage: 'database offline',
    run: null,
    status: 'failed',
  });
});

