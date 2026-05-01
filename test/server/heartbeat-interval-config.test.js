import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveHeartbeatIntervalConfig } from '../../src/server/heartbeat/heartbeat-interval-config.js';

test('resolveHeartbeatIntervalConfig uses the fallback interval when the environment variable is absent', () => {
  const config = resolveHeartbeatIntervalConfig({
    env: {},
    envKey: 'HARMONIARR_EXAMPLE_HEARTBEAT_MS',
    fallbackIntervalMs: 5000,
  });

  assert.deepEqual(config, {
    intervalLabel: '5 seconds',
    intervalMs: 5000,
    mode: 'automatic',
    source: 'default',
  });
});

test('resolveHeartbeatIntervalConfig accepts a valid environment override', () => {
  const config = resolveHeartbeatIntervalConfig({
    env: {
      HARMONIARR_EXAMPLE_HEARTBEAT_MS: '7200000',
    },
    envKey: 'HARMONIARR_EXAMPLE_HEARTBEAT_MS',
    fallbackIntervalMs: 5000,
  });

  assert.deepEqual(config, {
    intervalLabel: '2 hours',
    intervalMs: 7200000,
    mode: 'automatic',
    source: 'environment',
  });
});

test('resolveHeartbeatIntervalConfig rejects invalid environment values', () => {
  assert.throws(
    () => resolveHeartbeatIntervalConfig({
      env: {
        HARMONIARR_EXAMPLE_HEARTBEAT_MS: '999',
      },
      envKey: 'HARMONIARR_EXAMPLE_HEARTBEAT_MS',
      fallbackIntervalMs: 5000,
    }),
    /Invalid HARMONIARR_EXAMPLE_HEARTBEAT_MS value: 999/,
  );
});

test('resolveHeartbeatIntervalConfig rejects invalid fallback intervals', () => {
  assert.throws(
    () => resolveHeartbeatIntervalConfig({
      env: {},
      envKey: 'HARMONIARR_EXAMPLE_HEARTBEAT_MS',
      fallbackIntervalMs: 999,
    }),
    /fallbackIntervalMs must be an integer greater than or equal to 1000/,
  );
});

test('resolveHeartbeatIntervalConfig requires an env key', () => {
  assert.throws(
    () => resolveHeartbeatIntervalConfig({
      env: {},
      fallbackIntervalMs: 5000,
    }),
    /envKey is required/,
  );
});