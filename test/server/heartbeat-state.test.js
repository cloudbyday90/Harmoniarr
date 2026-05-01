import assert from 'node:assert/strict';
import test from 'node:test';
import { createHeartbeatState } from '../../src/server/heartbeat/heartbeat-state.js';

test('createHeartbeatState records the shared heartbeat outcome fields', () => {
  const heartbeatState = createHeartbeatState();

  heartbeatState.recordHeartbeatOutcome({
    occurredAt: '2026-05-01T10:00:00.000Z',
    outcome: 'started',
  });

  assert.deepEqual(heartbeatState.getHeartbeatState(), {
    lastErrorMessage: null,
    lastOutcome: 'started',
    lastSkipReason: null,
    lastTickAt: '2026-05-01T10:00:00.000Z',
    lastTriggeredAt: '2026-05-01T10:00:00.000Z',
  });
});

test('createHeartbeatState supports module-specific extra state normalization and updates', () => {
  const heartbeatState = createHeartbeatState({
    initialState: {
      lastTransitionCount: null,
    },
    normalizeExtraState: (state) => ({
      lastTransitionCount: Number.isInteger(state.lastTransitionCount) ? state.lastTransitionCount : 0,
    }),
    resolveExtraStateForOutcome: ({ details }) => ({
      lastTransitionCount: Number.isInteger(details.transitionCount) ? details.transitionCount : 0,
    }),
  });

  heartbeatState.recordHeartbeatOutcome({
    occurredAt: '2026-05-01T10:01:00.000Z',
    outcome: 'started',
    transitionCount: 3,
  });

  assert.deepEqual(heartbeatState.getHeartbeatState(), {
    lastErrorMessage: null,
    lastOutcome: 'started',
    lastSkipReason: null,
    lastTickAt: '2026-05-01T10:01:00.000Z',
    lastTransitionCount: 3,
    lastTriggeredAt: '2026-05-01T10:01:00.000Z',
  });

  heartbeatState.recordHeartbeatOutcome({
    occurredAt: '2026-05-01T10:02:00.000Z',
    outcome: 'skipped',
    skipReason: 'not_due',
  });

  assert.deepEqual(heartbeatState.getHeartbeatState(), {
    lastErrorMessage: null,
    lastOutcome: 'skipped',
    lastSkipReason: 'not_due',
    lastTickAt: '2026-05-01T10:02:00.000Z',
    lastTransitionCount: 0,
    lastTriggeredAt: '2026-05-01T10:01:00.000Z',
  });
});