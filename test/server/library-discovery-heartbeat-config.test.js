import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLibraryDiscoveryHeartbeatConfig } from '../../src/server/library/library-discovery-heartbeat-config.js';

test('resolveLibraryDiscoveryHeartbeatConfig returns the default heartbeat cadence', () => {
  const config = resolveLibraryDiscoveryHeartbeatConfig({
    env: {},
  });

  assert.deepEqual(config, {
    intervalLabel: '15 minutes',
    intervalMs: 900000,
    mode: 'automatic',
    source: 'default',
  });
});

test('resolveLibraryDiscoveryHeartbeatConfig accepts an environment override', () => {
  const config = resolveLibraryDiscoveryHeartbeatConfig({
    env: {
      HARMONIARR_LIBRARY_DISCOVERY_HEARTBEAT_MS: '1800000',
    },
  });

  assert.deepEqual(config, {
    intervalLabel: '30 minutes',
    intervalMs: 1800000,
    mode: 'automatic',
    source: 'environment',
  });
});

test('resolveLibraryDiscoveryHeartbeatConfig rejects invalid environment values', () => {
  assert.throws(
    () => resolveLibraryDiscoveryHeartbeatConfig({
      env: {
        HARMONIARR_LIBRARY_DISCOVERY_HEARTBEAT_MS: '200',
      },
    }),
    /Invalid HARMONIARR_LIBRARY_DISCOVERY_HEARTBEAT_MS value: 200/,
  );
});