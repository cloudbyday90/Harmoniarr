import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveTerminalTransferOutcome,
  evaluateImportBlockerRecovery,
  TERMINAL_MATCH_OUTCOME_CODES,
} from '../../src/server/import-candidates/import-candidate-terminal-recovery-policy.js';

test('derives timeout, generic failure, and disappeared-source terminal outcomes', () => {
  assert.equal(deriveTerminalTransferOutcome({
    liveTransferSummary: { status: 'failed' },
    liveTransfers: [{ state: 'Completed, Timed Out' }],
  }), TERMINAL_MATCH_OUTCOME_CODES.DOWNLOAD_TIMED_OUT);

  assert.equal(deriveTerminalTransferOutcome({
    liveTransferSummary: { status: 'failed' },
    liveTransfers: [{ exception: 'The peer disconnected unexpectedly.', state: 'Completed, Errored' }],
  }), TERMINAL_MATCH_OUTCOME_CODES.DOWNLOAD_FAILED);

  assert.equal(deriveTerminalTransferOutcome({
    liveTransferSummary: {
      missingTransfer: { isPastGracePeriod: true },
      status: 'not_found',
    },
  }), TERMINAL_MATCH_OUTCOME_CODES.SOURCE_DISAPPEARED);
});

test('allows automatic fallback only when a completed candidate source disappeared before import', () => {
  const recovery = evaluateImportBlockerRecovery({
    counts: {
      collisionCount: 0,
      lossyDecisionRequiredCount: 0,
      missingSourceCount: 2,
    },
    preview: { validation: { blockers: [] } },
    summary: { status: 'blocked' },
  });

  assert.deepEqual(recovery, {
    addBlockerCode: 'source_path_unavailable',
    canRecover: true,
    outcomeCode: TERMINAL_MATCH_OUTCOME_CODES.SOURCE_DISAPPEARED,
    requiresOperator: false,
  });
});

test('keeps collisions and validation blockers behind a manual import repair', () => {
  const collisionRecovery = evaluateImportBlockerRecovery({
    counts: {
      collisionCount: 1,
      lossyDecisionRequiredCount: 0,
      missingSourceCount: 0,
    },
    preview: { validation: { blockers: [] } },
    summary: { blockerCode: 'library_collision', status: 'blocked' },
  });
  const validationRecovery = evaluateImportBlockerRecovery({
    counts: {
      collisionCount: 0,
      lossyDecisionRequiredCount: 0,
      missingSourceCount: 1,
    },
    preview: { validation: { blockers: [{ code: 'unsafe_library_path' }] } },
    summary: { status: 'blocked' },
  });

  assert.deepEqual(collisionRecovery, {
    addBlockerCode: 'library_collision',
    canRecover: false,
    outcomeCode: TERMINAL_MATCH_OUTCOME_CODES.IMPORT_BLOCKED,
    requiresOperator: true,
  });
  assert.deepEqual(validationRecovery, {
    addBlockerCode: 'unsafe_add_plan',
    canRecover: false,
    outcomeCode: TERMINAL_MATCH_OUTCOME_CODES.IMPORT_BLOCKED,
    requiresOperator: true,
  });
});
