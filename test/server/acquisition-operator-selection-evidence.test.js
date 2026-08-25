import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMusicQueueOperatorSelectionEvidence } from '../../src/server/acquisition/acquisition-operator-selection-evidence.js';

test('Music Queue exposes only allowlisted manual selection evidence', () => {
  assert.deepEqual(
    buildMusicQueueOperatorSelectionEvidence({
      evidence: {
        selectionOrigin: 'MANUAL_EDITION',
        selectionSource: 'manual',
        selectionState: 'selected',
      },
    }),
    {
      selectionOrigin: 'manual_edition',
      selectionSource: 'manual',
      selectionState: 'selected',
    },
  );
  assert.deepEqual(
    buildMusicQueueOperatorSelectionEvidence({
      evidence: {
        selectionOrigin: 'manual_edition',
        selectionSource: 'policy',
        selectionState: 'selected',
      },
    }),
    {
      selectionOrigin: null,
      selectionSource: 'policy',
      selectionState: 'selected',
    },
  );
  assert.deepEqual(
    buildMusicQueueOperatorSelectionEvidence({
      evidence: {
        selectionOrigin: 'unknown_value',
        selectionSource: 'manual',
        selectionState: 'unexpected_value',
      },
    }),
    {
      selectionOrigin: null,
      selectionSource: 'manual',
      selectionState: null,
    },
  );
});
