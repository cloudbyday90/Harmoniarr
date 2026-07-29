/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldOpenRunHistoryControls } from '../../src/client/lib/import-review-runway-presentation.js';

test('shouldOpenRunHistoryControls opens the disclosure for direct run links', () => {
  assert.equal(shouldOpenRunHistoryControls({ executionRunId: 'execution-run-1' }), true);
  assert.equal(shouldOpenRunHistoryControls({ mediaInspectionRunId: 'media-run-1' }), true);
  assert.equal(shouldOpenRunHistoryControls({ applyRunId: 'apply-run-1' }), true);
});

test('shouldOpenRunHistoryControls leaves ordinary match diagnostics collapsed', () => {
  assert.equal(shouldOpenRunHistoryControls({ candidateId: 'candidate-1' }), false);
  assert.equal(shouldOpenRunHistoryControls({ executionRunId: '   ' }), false);
  assert.equal(shouldOpenRunHistoryControls(), false);
});
