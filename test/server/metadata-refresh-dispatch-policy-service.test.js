import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataRefreshDispatchPolicyService } from '../../src/server/metadata/metadata-refresh-dispatch-policy-service.js';

test('createMetadataRefreshDispatchPolicyService pauses dispatch when MusicBrainz is throttling', () => {
  const service = createMetadataRefreshDispatchPolicyService();

  assert.deepEqual(service.resolveDispatchReadiness({
    dependencyStatuses: [{
      provider: 'musicbrainz',
      status: 'degraded',
      code: 'musicbrainz_unavailable',
      message: 'MusicBrainz is throttling requests',
      details: {
        retryAfterMs: 3000,
        throttled: true,
      },
    }],
    now: '2026-05-01T14:00:00.000Z',
  }), {
    allowed: false,
    pauseCode: 'musicbrainz_unavailable',
    pauseMessage: 'MusicBrainz is throttling requests',
    nextRetryAt: '2026-05-01T14:00:03.000Z',
    provider: 'musicbrainz',
  });
});

test('createMetadataRefreshDispatchPolicyService allows dispatch when MusicBrainz is healthy or unknown', () => {
  const service = createMetadataRefreshDispatchPolicyService();

  assert.deepEqual(service.resolveDispatchReadiness({ dependencyStatuses: [] }), {
    allowed: true,
  });
  assert.deepEqual(service.resolveDispatchReadiness({
    dependencyStatuses: [{
      provider: 'musicbrainz',
      status: 'healthy',
    }],
  }), {
    allowed: true,
  });
});