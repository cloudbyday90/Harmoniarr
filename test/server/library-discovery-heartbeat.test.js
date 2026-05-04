import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryDiscoveryHeartbeatState } from '../../src/server/library/library-discovery-heartbeat-state.js';
import {
  createLibraryDiscoveryHeartbeat,
  shouldStartLibraryDiscoveryHeartbeatRun,
} from '../../src/server/library/library-discovery-heartbeat.js';

test('shouldStartLibraryDiscoveryHeartbeatRun starts when ready requests exist', () => {
  assert.equal(shouldStartLibraryDiscoveryHeartbeatRun({
    activeRun: null,
    now: new Date('2026-04-30T14:00:00.000Z'),
    snapshot: {
      lastEvaluatedAt: '2026-04-30T13:50:00.000Z',
      nextEligibleAt: '2026-04-30T18:00:00.000Z',
      requestCounts: {
        ready: 2,
        totalRequests: 4,
      },
    },
  }), true);
});

test('shouldStartLibraryDiscoveryHeartbeatRun skips when requests are not due and evaluation is fresh', () => {
  assert.equal(shouldStartLibraryDiscoveryHeartbeatRun({
    activeRun: null,
    intervalMs: 15 * 60 * 1000,
    now: new Date('2026-04-30T14:00:00.000Z'),
    snapshot: {
      lastEvaluatedAt: '2026-04-30T13:55:00.000Z',
      nextEligibleAt: '2026-04-30T18:00:00.000Z',
      requestCounts: {
        ready: 0,
        totalRequests: 4,
      },
    },
  }), false);
});

test('createLibraryDiscoveryHeartbeat starts a due discovery run and configures an unref interval', async () => {
  let recordedDelay = null;
  let intervalHandler = null;
  const clearIntervalCalls = [];
  let startCallCount = 0;
  const libraryDiscoveryHeartbeatState = createLibraryDiscoveryHeartbeatState();
  const firstRunStarted = new Promise((resolve) => {
    const heartbeat = createLibraryDiscoveryHeartbeat({
      clearIntervalFn: (handle) => {
        clearIntervalCalls.push(handle);
      },
      getActiveRun: async () => null,
      getDiscoverySnapshot: async () => ({
        lastEvaluatedAt: null,
        nextEligibleAt: null,
        requestCounts: {
          blocked: 0,
          cooldown: 0,
          ready: 0,
          totalRequests: 0,
        },
      }),
      getNow: () => new Date('2026-04-30T14:00:00.000Z'),
      intervalMs: 900000,
      libraryDiscoveryHeartbeatState,
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
      startLibraryDiscoveryRun: async ({ triggerSource }) => {
        startCallCount += 1;
        assert.equal(triggerSource, 'heartbeat');
        resolve(heartbeat);
        return { accepted: true };
      },
    });

    heartbeat.start();
  });

  const heartbeat = await firstRunStarted;
  await Promise.resolve();

  assert.equal(recordedDelay, 900000);
  assert.equal(intervalHandler.unrefCalled, true);
  assert.equal(startCallCount, 1);
  assert.deepEqual(libraryDiscoveryHeartbeatState.getHeartbeatState(), {
    lastErrorMessage: null,
    lastOutcome: 'started',
    lastPauseCode: null,
    lastPauseMessage: null,
    lastPauseProvider: null,
    lastSkipReason: null,
    lastTickAt: '2026-04-30T14:00:00.000Z',
    lastTriggeredAt: '2026-04-30T14:00:00.000Z',
    nextRetryAt: null,
  });

  heartbeat.stop();

  assert.equal(clearIntervalCalls.length, 1);
  assert.equal(clearIntervalCalls[0], intervalHandler);
});

test('createLibraryDiscoveryHeartbeat swallows concurrent-run conflicts and surfaces other errors through onError', async () => {
  const errors = [];
  const conflictState = createLibraryDiscoveryHeartbeatState();
  const conflictHeartbeat = createLibraryDiscoveryHeartbeat({
    getActiveRun: async () => null,
    getDiscoverySnapshot: async () => ({
      lastEvaluatedAt: null,
      nextEligibleAt: null,
      requestCounts: {
        blocked: 0,
        cooldown: 0,
        ready: 1,
        totalRequests: 1,
      },
    }),
    getNow: () => new Date('2026-04-30T14:00:00.000Z'),
    libraryDiscoveryHeartbeatState: conflictState,
    onError: (error) => {
      errors.push(error.message);
    },
    startLibraryDiscoveryRun: async () => {
      const error = new Error('A library discovery dispatch is already running or queued');
      error.code = 'library_discovery_in_progress';
      throw error;
    },
  });

  const conflictResult = await conflictHeartbeat.tick();

  assert.deepEqual(conflictResult, {
    reason: 'run_in_progress',
    skipped: true,
  });
  assert.deepEqual(errors, []);
  assert.equal(conflictState.getHeartbeatState().lastSkipReason, 'run_in_progress');

  const failingState = createLibraryDiscoveryHeartbeatState();
  const failingHeartbeat = createLibraryDiscoveryHeartbeat({
    getActiveRun: async () => null,
    getDiscoverySnapshot: async () => ({
      lastEvaluatedAt: null,
      nextEligibleAt: null,
      requestCounts: {
        blocked: 0,
        cooldown: 0,
        ready: 1,
        totalRequests: 1,
      },
    }),
    getNow: () => new Date('2026-04-30T14:00:00.000Z'),
    libraryDiscoveryHeartbeatState: failingState,
    onError: (error) => {
      errors.push(error.message);
    },
    startLibraryDiscoveryRun: async () => {
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

test('createLibraryDiscoveryHeartbeat pauses while a conflicting maintenance lock is active', async () => {
  const libraryDiscoveryHeartbeatState = createLibraryDiscoveryHeartbeatState();
  const heartbeat = createLibraryDiscoveryHeartbeat({
    getActiveRun: async () => {
      throw new Error('active run lookup should not run while paused');
    },
    getNow: () => new Date('2026-04-30T14:00:00.000Z'),
    heartbeatPauseService: {
      resolveHeartbeatReadiness: async () => ({
        allowed: false,
        nextRetryAt: '2026-04-30T14:05:00.000Z',
        pauseCode: 'recovery_lock_conflict',
        pauseMessage: 'Discovery dispatch is paused while the maintenance maintenance lock is active.',
        pauseProvider: 'maintenance',
      }),
    },
    libraryDiscoveryHeartbeatState,
  });

  const result = await heartbeat.tick();

  assert.deepEqual(result, {
    nextRetryAt: '2026-04-30T14:05:00.000Z',
    provider: 'maintenance',
    reason: 'paused',
    skipped: true,
  });
  assert.deepEqual(libraryDiscoveryHeartbeatState.getHeartbeatState(), {
    lastErrorMessage: null,
    lastOutcome: 'skipped',
    lastPauseCode: 'recovery_lock_conflict',
    lastPauseMessage: 'Discovery dispatch is paused while the maintenance maintenance lock is active.',
    lastPauseProvider: 'maintenance',
    lastSkipReason: 'paused',
    lastTickAt: '2026-04-30T14:00:00.000Z',
    lastTriggeredAt: null,
    nextRetryAt: '2026-04-30T14:05:00.000Z',
  });
});