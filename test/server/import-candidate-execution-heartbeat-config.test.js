import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveImportCandidateExecutionHeartbeatConfig } from '../../src/server/import-candidates/import-candidate-execution-heartbeat-config.js';

test('resolveImportCandidateExecutionHeartbeatConfig returns the default cadence', () => {
  const config = resolveImportCandidateExecutionHeartbeatConfig({
    env: {},
  });

  assert.deepEqual(config, {
    intervalLabel: '1 minute',
    intervalMs: 60000,
    mode: 'automatic',
    source: 'default',
  });
});

test('resolveImportCandidateExecutionHeartbeatConfig accepts an environment override', () => {
  const config = resolveImportCandidateExecutionHeartbeatConfig({
    env: {
      HARMONIARR_IMPORT_EXECUTION_RECONCILIATION_HEARTBEAT_MS: '30000',
    },
  });

  assert.deepEqual(config, {
    intervalLabel: '30 seconds',
    intervalMs: 30000,
    mode: 'automatic',
    source: 'environment',
  });
});

test('resolveImportCandidateExecutionHeartbeatConfig rejects invalid values', () => {
  assert.throws(
    () => resolveImportCandidateExecutionHeartbeatConfig({
      env: {
        HARMONIARR_IMPORT_EXECUTION_RECONCILIATION_HEARTBEAT_MS: '0',
      },
    }),
    /Invalid HARMONIARR_IMPORT_EXECUTION_RECONCILIATION_HEARTBEAT_MS value/,
  );
});