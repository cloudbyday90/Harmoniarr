import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateExecutionHeartbeatState } from '../../src/server/import-candidates/import-candidate-execution-heartbeat-state.js';
import {
  createImportCandidateExecutionHeartbeat,
  shouldRunImportCandidateExecutionHeartbeat,
} from '../../src/server/import-candidates/import-candidate-execution-heartbeat.js';

test('shouldRunImportCandidateExecutionHeartbeat requires actionable download-enqueue transfers', () => {
  assert.equal(shouldRunImportCandidateExecutionHeartbeat({
    executionSummary: {
      currentRun: {
        executionMode: 'download_enqueue',
        items: [{
          liveTransferSummary: {
            status: 'queued',
          },
        }],
      },
    },
  }), true);

  assert.equal(shouldRunImportCandidateExecutionHeartbeat({
    executionSummary: {
      currentRun: {
        executionMode: 'planning_only',
        items: [{
          liveTransferSummary: {
            status: 'queued',
          },
        }],
      },
    },
  }), false);

  assert.equal(shouldRunImportCandidateExecutionHeartbeat({
    executionSummary: {
      currentRun: {
        executionMode: 'download_enqueue',
        items: [{
          liveTransferSummary: {
            status: 'not_found',
          },
        }],
      },
    },
  }), false);

  assert.equal(shouldRunImportCandidateExecutionHeartbeat({
    executionSummary: {
      currentRun: {
        executionMode: 'download_enqueue',
        items: [{
          liveTransferSummary: {
            missingTransfer: {
              isPastGracePeriod: true,
            },
            status: 'not_found',
          },
        }],
      },
    },
  }), true);
});

test('createImportCandidateExecutionHeartbeat starts reconciliation and configures an unref interval', async () => {
  let recordedDelay = null;
  let intervalHandler = null;
  const clearIntervalCalls = [];
  const heartbeatState = createImportCandidateExecutionHeartbeatState();
  let reconcileCalls = 0;

  const firstRunStarted = new Promise((resolve) => {
    const heartbeat = createImportCandidateExecutionHeartbeat({
      buildImportCandidateExecutionSummary: async () => ({
        currentRun: {
          executionMode: 'download_enqueue',
          items: [{
            liveTransferSummary: {
              status: 'active',
            },
          }],
        },
      }),
      clearIntervalFn: (handle) => {
        clearIntervalCalls.push(handle);
      },
      getNow: () => new Date('2026-04-30T14:00:00.000Z'),
      importCandidateExecutionHeartbeatState: heartbeatState,
      intervalMs: 60000,
      reconcileImportCandidateExecutionState: async ({ executionSummary }) => {
        reconcileCalls += 1;
        assert.equal(executionSummary.currentRun.executionMode, 'download_enqueue');
        resolve(heartbeat);
        return {
          summary: {
            transitioned: 1,
          },
        };
      },
      setIntervalFn: (callback, delay) => {
        recordedDelay = delay;
        intervalHandler = {
          callback,
          unrefCalled: false,
          unref() {
            this.unrefCalled = true;
          },
        };
        return intervalHandler;
      },
    });

    heartbeat.start();
  });

  const heartbeat = await firstRunStarted;
  await Promise.resolve();

  assert.equal(recordedDelay, 60000);
  assert.equal(intervalHandler.unrefCalled, true);
  assert.equal(reconcileCalls, 1);
  assert.deepEqual(heartbeatState.getHeartbeatState(), {
    lastErrorMessage: null,
    lastOutcome: 'started',
    lastSkipReason: null,
    lastTickAt: '2026-04-30T14:00:00.000Z',
    lastTransitionCount: 1,
    lastTriggeredAt: '2026-04-30T14:00:00.000Z',
  });

  heartbeat.stop();

  assert.equal(clearIntervalCalls.length, 1);
  assert.equal(clearIntervalCalls[0], intervalHandler);
});

test('createImportCandidateExecutionHeartbeat skips when no actionable transfers exist and surfaces errors', async () => {
  const errors = [];
  const skippedState = createImportCandidateExecutionHeartbeatState();
  const skippedHeartbeat = createImportCandidateExecutionHeartbeat({
    buildImportCandidateExecutionSummary: async () => ({
      currentRun: {
        executionMode: 'download_enqueue',
        items: [{
          liveTransferSummary: {
            status: 'not_found',
          },
        }],
      },
    }),
    getNow: () => new Date('2026-04-30T14:00:00.000Z'),
    importCandidateExecutionHeartbeatState: skippedState,
  });

  const skippedResult = await skippedHeartbeat.tick();
  assert.deepEqual(skippedResult, {
    reason: 'not_due',
    skipped: true,
  });
  assert.equal(skippedState.getHeartbeatState().lastSkipReason, 'not_due');

  const failingState = createImportCandidateExecutionHeartbeatState();
  const failingHeartbeat = createImportCandidateExecutionHeartbeat({
    buildImportCandidateExecutionSummary: async () => ({
      currentRun: {
        executionMode: 'download_enqueue',
        items: [{
          liveTransferSummary: {
            status: 'completed',
          },
        }],
      },
    }),
    getNow: () => new Date('2026-04-30T14:00:00.000Z'),
    importCandidateExecutionHeartbeatState: failingState,
    onError: (error) => {
      errors.push(error.message);
    },
    reconcileImportCandidateExecutionState: async () => {
      throw new Error('slskd unavailable');
    },
  });

  const failureResult = await failingHeartbeat.tick();
  assert.deepEqual(failureResult, {
    reason: 'error',
    skipped: true,
  });
  assert.deepEqual(errors, ['slskd unavailable']);
  assert.equal(failingState.getHeartbeatState().lastOutcome, 'error');
});