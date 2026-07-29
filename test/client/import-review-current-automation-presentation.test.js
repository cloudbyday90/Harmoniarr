/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCurrentAutomationPresentation,
  shouldOpenCurrentAutomationForRoute,
} from '../../src/client/lib/import-review-current-automation-presentation.js';

test('buildCurrentAutomationPresentation summarizes selected, ready-to-add, and blocked work', () => {
  assert.deepEqual(buildCurrentAutomationPresentation({
    importPendingCounts: { blocked: 1, totalImportPending: 2 },
    selectedCounts: { blocked: 1, totalSelected: 1 },
  }), {
    hasWork: true,
    summary: '1 match selected · 2 downloads waiting to add · 2 items blocked',
  });
});

test('buildCurrentAutomationPresentation distinguishes a quiet queue from a loading queue', () => {
  assert.deepEqual(buildCurrentAutomationPresentation(), {
    hasWork: false,
    summary: 'Nothing waiting to download or add',
  });

  assert.deepEqual(buildCurrentAutomationPresentation({ isLoadingImportPending: true }), {
    hasWork: false,
    summary: 'Checking current progress',
  });
});

test('shouldOpenCurrentAutomationForRoute only expands status-only selected and ready-to-add links', () => {
  assert.equal(shouldOpenCurrentAutomationForRoute({ status: 'selected' }), true);
  assert.equal(shouldOpenCurrentAutomationForRoute({ status: 'import_pending' }), true);
  assert.equal(shouldOpenCurrentAutomationForRoute({ candidateId: 'candidate-1', status: 'import_pending' }), false);
  assert.equal(shouldOpenCurrentAutomationForRoute({ status: 'pending' }), false);
});
