import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHeartbeatOverview } from '../../src/server/heartbeat/heartbeat-overview.js';

test('buildHeartbeatOverview renders setup-required as a non-error setup state', () => {
  assert.deepEqual(buildHeartbeatOverview({
    key: 'libraryDiscovery',
    label: 'Discovery dispatch',
    messages: {
      setupRequired: 'Configure Soulseek (slskd) in Settings to enable automatic discovery searches.',
    },
    heartbeatState: {
      lastErrorMessage: null,
      lastOutcome: 'skipped',
      lastPauseCode: 'slskd_not_configured',
      lastPauseMessage: 'Configure Soulseek (slskd) in Settings to enable downloads and discovery searches.',
      lastPauseProvider: 'slskd',
      lastSkipReason: 'setup_required',
      lastTickAt: '2026-05-01T12:00:00.000Z',
      lastTriggeredAt: null,
      nextRetryAt: null,
    },
  }), {
    intervalLabel: null,
    intervalMs: null,
    key: 'libraryDiscovery',
    label: 'Discovery dispatch',
    lastErrorMessage: null,
    lastPauseProvider: 'slskd',
    lastSkipReason: 'setup_required',
    lastTickAt: '2026-05-01T12:00:00.000Z',
    lastTriggeredAt: null,
    message: 'Configure Soulseek (slskd) in Settings to enable downloads and discovery searches.',
    mode: null,
    nextRetryAt: null,
    source: null,
    state: {
      lastErrorMessage: null,
      lastOutcome: 'skipped',
      lastPauseCode: 'slskd_not_configured',
      lastPauseMessage: 'Configure Soulseek (slskd) in Settings to enable downloads and discovery searches.',
      lastPauseProvider: 'slskd',
      lastSkipReason: 'setup_required',
      lastTickAt: '2026-05-01T12:00:00.000Z',
      lastTriggeredAt: null,
      nextRetryAt: null,
    },
    status: 'setup_required',
  });
});
