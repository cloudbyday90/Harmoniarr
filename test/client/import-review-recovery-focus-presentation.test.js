/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildImportReviewRecoveryFocus } from '../../src/client/lib/import-review-recovery-focus-presentation.js';

test('buildImportReviewRecoveryFocus prioritizes direct file and match recovery targets', () => {
  assert.equal(buildImportReviewRecoveryFocus({
    candidateFileId: 'file-1',
    candidateId: 'candidate-1',
    status: 'import_pending',
  }), 'Fix a file issue');
  assert.equal(buildImportReviewRecoveryFocus({
    candidateId: 'candidate-1',
    status: 'failed',
  }), 'Review selected match');
  assert.equal(buildImportReviewRecoveryFocus({
    candidateId: 'candidate-1',
    status: 'import_pending',
  }), 'Review library add');
});

test('buildImportReviewRecoveryFocus maps saved status filters to operator intent', () => {
  assert.equal(buildImportReviewRecoveryFocus({ status: 'selected' }), 'Review selected matches');
  assert.equal(buildImportReviewRecoveryFocus({ status: 'import_pending' }), 'Review library add');
  assert.equal(buildImportReviewRecoveryFocus({ status: 'failed' }), 'Resolve a failed match');
  assert.equal(buildImportReviewRecoveryFocus({ status: 'held' }), 'Review a paused match');
});

test('buildImportReviewRecoveryFocus keeps unknown and default state generic', () => {
  assert.equal(buildImportReviewRecoveryFocus({ status: 'pending' }), 'Resolve a match issue');
  assert.equal(buildImportReviewRecoveryFocus({ status: 'unexpected' }), 'Resolve a match issue');
  assert.equal(buildImportReviewRecoveryFocus({ candidateId: '   ' }), 'Resolve a match issue');
});
