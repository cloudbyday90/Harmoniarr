import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveImportCandidateExecutionMissingTransferConfig } from '../../src/server/import-candidates/import-candidate-execution-missing-transfer-config.js';

test('resolveImportCandidateExecutionMissingTransferConfig returns the default grace window', () => {
  const config = resolveImportCandidateExecutionMissingTransferConfig({
    env: {},
  });

  assert.deepEqual(config, {
    gracePeriodLabel: '5 minutes',
    gracePeriodMs: 300000,
    mode: 'grace_window',
    source: 'default',
  });
});

test('resolveImportCandidateExecutionMissingTransferConfig accepts an environment override', () => {
  const config = resolveImportCandidateExecutionMissingTransferConfig({
    env: {
      HARMONIARR_IMPORT_EXECUTION_MISSING_TRANSFER_GRACE_MS: '30000',
    },
  });

  assert.deepEqual(config, {
    gracePeriodLabel: '30 seconds',
    gracePeriodMs: 30000,
    mode: 'grace_window',
    source: 'environment',
  });
});

test('resolveImportCandidateExecutionMissingTransferConfig rejects invalid values', () => {
  assert.throws(
    () => resolveImportCandidateExecutionMissingTransferConfig({
      env: {
        HARMONIARR_IMPORT_EXECUTION_MISSING_TRANSFER_GRACE_MS: '0',
      },
    }),
    /Invalid HARMONIARR_IMPORT_EXECUTION_MISSING_TRANSFER_GRACE_MS value/,
  );
});