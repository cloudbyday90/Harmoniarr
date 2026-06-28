import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryDiscoveryDispatchPolicyService } from '../../src/server/library/library-discovery-dispatch-policy-service.js';

test('library discovery dispatch policy skips setup-required slskd state without alerting', () => {
  const service = createLibraryDiscoveryDispatchPolicyService();

  assert.deepEqual(service.resolveDispatchReadiness({
    dependencyStatuses: [{
      provider: 'slskd',
      status: 'disabled',
      code: 'slskd_not_configured',
      message: 'Configure Soulseek (slskd) in Settings to enable downloads and discovery searches.',
    }],
  }), {
    allowed: false,
    message: 'Configure Soulseek (slskd) in Settings to enable downloads and discovery searches.',
    pauseCode: 'slskd_not_configured',
    provider: 'slskd',
    reason: 'setup_required',
  });
});

test('library discovery dispatch policy pauses unavailable slskd state', () => {
  const service = createLibraryDiscoveryDispatchPolicyService();

  assert.deepEqual(service.resolveDispatchReadiness({
    dependencyStatuses: [{
      provider: 'slskd',
      status: 'unavailable',
      code: 'slskd_unavailable',
      message: 'slskd is temporarily unavailable',
    }],
  }), {
    allowed: false,
    pauseCode: 'slskd_unavailable',
    pauseMessage: 'slskd is temporarily unavailable',
    provider: 'slskd',
    reason: 'paused',
  });
});

test('library discovery dispatch policy allows healthy or unknown slskd state', () => {
  const service = createLibraryDiscoveryDispatchPolicyService();

  assert.deepEqual(service.resolveDispatchReadiness({ dependencyStatuses: [] }), {
    allowed: true,
  });
  assert.deepEqual(service.resolveDispatchReadiness({
    dependencyStatuses: [{
      provider: 'slskd',
      status: 'healthy',
    }],
  }), {
    allowed: true,
  });
});
