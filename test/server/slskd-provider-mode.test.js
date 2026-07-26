import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasManagedSlskdDeployment,
  normalizeSlskdProviderMode,
  resolveSlskdProviderMode,
  resolveSlskdProviderModeDefault,
} from '../../src/server/integrations/slskd/slskd-provider-mode.js';

test('managed deployment detection uses the mounted API-key file contract', () => {
  assert.equal(hasManagedSlskdDeployment({ SLSKD_API_KEY_FILE: '/run/secrets/slskd_api_key' }), true);
  assert.equal(hasManagedSlskdDeployment({ SLSKD_API_KEY_FILE: '  ' }), false);
  assert.equal(resolveSlskdProviderModeDefault({ SLSKD_API_KEY_FILE: '/run/secrets/slskd_api_key' }), 'managed');
  assert.equal(resolveSlskdProviderModeDefault({}), 'external');
});

test('disabled mode overrides a detected managed deployment without removing deployment state', () => {
  assert.deepEqual(resolveSlskdProviderMode({
    env: { SLSKD_API_KEY_FILE: '/run/secrets/slskd_api_key' },
    providerMode: 'disabled',
  }), {
    managedDeploymentDetected: true,
    mode: 'disabled',
    modeLocked: false,
    requestedMode: 'disabled',
    state: 'disabled',
  });
});

test('managed deployment takes precedence over an old external settings choice', () => {
  assert.deepEqual(resolveSlskdProviderMode({
    env: { SLSKD_API_KEY_FILE: '/run/secrets/slskd_api_key' },
    providerMode: 'external',
  }), {
    managedDeploymentDetected: true,
    mode: 'managed',
    modeLocked: true,
    requestedMode: 'external',
    state: 'ready',
  });
});

test('managed mode without the deployment is explicit and cannot start a provider client', () => {
  assert.deepEqual(resolveSlskdProviderMode({ env: {}, providerMode: 'managed' }), {
    managedDeploymentDetected: false,
    mode: 'managed',
    modeLocked: false,
    requestedMode: 'managed',
    state: 'managed_deployment_missing',
  });
});

test('provider mode validation rejects unknown values', () => {
  assert.throws(
    () => normalizeSlskdProviderMode('automatic'),
    /slskd\.providerMode must be one of managed, external, disabled/,
  );
});
