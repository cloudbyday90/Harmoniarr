import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMetadataRefreshHeartbeatConfig } from '../../src/server/metadata/metadata-refresh-heartbeat-config.js';

test('resolveMetadataRefreshHeartbeatConfig returns the default heartbeat cadence', () => {
  const config = resolveMetadataRefreshHeartbeatConfig({ env: {} });

  assert.deepEqual(config, {
    intervalLabel: '15 minutes',
    intervalMs: 900000,
    mode: 'automatic',
    source: 'default',
  });
});

test('resolveMetadataRefreshHeartbeatConfig accepts an environment override', () => {
  const config = resolveMetadataRefreshHeartbeatConfig({
    env: {
      HARMONIARR_METADATA_REFRESH_HEARTBEAT_MS: '1800000',
    },
  });

  assert.deepEqual(config, {
    intervalLabel: '30 minutes',
    intervalMs: 1800000,
    mode: 'automatic',
    source: 'environment',
  });
});

test('resolveMetadataRefreshHeartbeatConfig rejects invalid environment values', () => {
  assert.throws(
    () => resolveMetadataRefreshHeartbeatConfig({
      env: {
        HARMONIARR_METADATA_REFRESH_HEARTBEAT_MS: '200',
      },
    }),
    /Invalid HARMONIARR_METADATA_REFRESH_HEARTBEAT_MS value: 200/,
  );
});