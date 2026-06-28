import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataRefreshDispatchPolicyService } from '../../src/server/metadata/metadata-refresh-dispatch-policy-service.js';
import { createMetadataRefreshHeartbeat } from '../../src/server/metadata/metadata-refresh-heartbeat.js';
import { createMetadataRefreshHeartbeatState } from '../../src/server/metadata/metadata-refresh-heartbeat-state.js';

test('createMetadataRefreshHeartbeat queues one due artist and configures an unref interval', async () => {
  let recordedDelay = null;
  let intervalHandler = null;
  const clearIntervalCalls = [];
  let startCallCount = 0;
  const metadataRefreshHeartbeatState = createMetadataRefreshHeartbeatState();
  const firstRunStarted = new Promise((resolve) => {
    const heartbeat = createMetadataRefreshHeartbeat({
      clearIntervalFn: (handle) => {
        clearIntervalCalls.push(handle);
      },
      getNow: () => new Date('2026-05-01T14:00:00.000Z'),
      intervalMs: 900000,
      metadataRefreshHeartbeatState,
      metadataRefreshSchedulerService: {
        getNextDueArtist: async () => ({
          artistName: 'Autechre',
          metadataArtistId: 'artist-1',
        }),
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
      startMetadataArtistRefresh: async ({ metadataArtistId, triggerSource }) => {
        startCallCount += 1;
        assert.equal(metadataArtistId, 'artist-1');
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
  assert.deepEqual(metadataRefreshHeartbeatState.getHeartbeatState(), {
    lastErrorMessage: null,
    lastOutcome: 'started',
    lastPauseCode: null,
    lastPauseMessage: null,
    lastPauseProvider: null,
    lastSkipReason: null,
    lastTickAt: '2026-05-01T14:00:00.000Z',
    lastTriggeredAt: '2026-05-01T14:00:00.000Z',
    nextRetryAt: null,
  });

  heartbeat.stop();

  assert.equal(clearIntervalCalls.length, 1);
  assert.equal(clearIntervalCalls[0], intervalHandler);
});

test('createMetadataRefreshHeartbeat skips when nothing is due and swallows in-progress conflicts', async () => {
  const metadataRefreshHeartbeatState = createMetadataRefreshHeartbeatState();
  let dependencyHealthCallCount = 0;
  const heartbeat = createMetadataRefreshHeartbeat({
    getDependencyHealth: async () => {
      dependencyHealthCallCount += 1;
      throw new Error('dependency health should not run when no artist is due');
    },
    getNow: () => new Date('2026-05-01T14:00:00.000Z'),
    metadataRefreshHeartbeatState,
    metadataRefreshSchedulerService: {
      getNextDueArtist: async () => null,
    },
    startMetadataArtistRefresh: async () => {
      throw new Error('should not start');
    },
  });

  const result = await heartbeat.tick();

  assert.deepEqual(result, {
    reason: 'not_due',
    skipped: true,
  });
  assert.equal(dependencyHealthCallCount, 0);

  const conflictState = createMetadataRefreshHeartbeatState();
  const conflictHeartbeat = createMetadataRefreshHeartbeat({
    getNow: () => new Date('2026-05-01T14:00:00.000Z'),
    metadataRefreshHeartbeatState: conflictState,
    metadataRefreshSchedulerService: {
      getNextDueArtist: async () => ({ metadataArtistId: 'artist-1' }),
    },
    startMetadataArtistRefresh: async () => {
      const error = new Error('A metadata refresh is already running or queued for this artist');
      error.code = 'metadata_artist_refresh_in_progress';
      throw error;
    },
  });

  const conflictResult = await conflictHeartbeat.tick();

  assert.deepEqual(conflictResult, {
    reason: 'run_in_progress',
    skipped: true,
  });
  assert.equal(conflictState.getHeartbeatState().lastSkipReason, 'run_in_progress');
});

test('createMetadataRefreshHeartbeat pauses dispatch when provider health blocks MusicBrainz work', async () => {
  const metadataRefreshHeartbeatState = createMetadataRefreshHeartbeatState();
  let schedulerCallCount = 0;
  const heartbeat = createMetadataRefreshHeartbeat({
    getDependencyHealth: async () => [{
      provider: 'musicbrainz',
      status: 'degraded',
      code: 'musicbrainz_unavailable',
      message: 'MusicBrainz is throttling requests',
      details: {
        retryAfterMs: 5000,
        throttled: true,
      },
    }],
    getNow: () => new Date('2026-05-01T14:00:00.000Z'),
    metadataRefreshDispatchPolicyService: createMetadataRefreshDispatchPolicyService(),
    metadataRefreshHeartbeatState,
    metadataRefreshSchedulerService: {
      getNextDueArtist: async () => {
        schedulerCallCount += 1;
        return {
          artistName: 'Autechre',
          metadataArtistId: 'artist-1',
        };
      },
    },
    startMetadataArtistRefresh: async () => {
      throw new Error('refresh should not start while paused');
    },
  });

  const result = await heartbeat.tick();

  assert.deepEqual(result, {
    nextRetryAt: '2026-05-01T14:00:05.000Z',
    provider: 'musicbrainz',
    reason: 'paused',
    skipped: true,
  });
  assert.equal(schedulerCallCount, 1);
  assert.deepEqual(metadataRefreshHeartbeatState.getHeartbeatState(), {
    lastErrorMessage: null,
    lastOutcome: 'skipped',
    lastPauseCode: 'musicbrainz_unavailable',
    lastPauseMessage: 'MusicBrainz is throttling requests',
    lastPauseProvider: 'musicbrainz',
    lastSkipReason: 'paused',
    lastTickAt: '2026-05-01T14:00:00.000Z',
    lastTriggeredAt: null,
    nextRetryAt: '2026-05-01T14:00:05.000Z',
  });
});

test('createMetadataRefreshHeartbeat pauses before dependency checks when a conflicting maintenance lock is active', async () => {
  const metadataRefreshHeartbeatState = createMetadataRefreshHeartbeatState();
  const heartbeat = createMetadataRefreshHeartbeat({
    getDependencyHealth: async () => {
      throw new Error('dependency health should not run while paused');
    },
    getNow: () => new Date('2026-05-01T14:00:00.000Z'),
    heartbeatPauseService: {
      resolveHeartbeatReadiness: async () => ({
        allowed: false,
        nextRetryAt: '2026-05-01T14:05:00.000Z',
        pauseCode: 'recovery_lock_conflict',
        pauseMessage: 'Metadata refresh is paused while the restore maintenance lock is active.',
        pauseProvider: 'restore',
      }),
    },
    metadataRefreshHeartbeatState,
    metadataRefreshSchedulerService: {
      getNextDueArtist: async () => {
        throw new Error('scheduler lookup should not run while paused');
      },
    },
  });

  const result = await heartbeat.tick();

  assert.deepEqual(result, {
    nextRetryAt: '2026-05-01T14:05:00.000Z',
    provider: 'restore',
    reason: 'paused',
    skipped: true,
  });
  assert.deepEqual(metadataRefreshHeartbeatState.getHeartbeatState(), {
    lastErrorMessage: null,
    lastOutcome: 'skipped',
    lastPauseCode: 'recovery_lock_conflict',
    lastPauseMessage: 'Metadata refresh is paused while the restore maintenance lock is active.',
    lastPauseProvider: 'restore',
    lastSkipReason: 'paused',
    lastTickAt: '2026-05-01T14:00:00.000Z',
    lastTriggeredAt: null,
    nextRetryAt: '2026-05-01T14:05:00.000Z',
  });
});
