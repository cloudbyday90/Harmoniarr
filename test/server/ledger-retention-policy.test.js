/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ledgerRetentionBounds,
  resolveLedgerRetentionPolicy,
  resolveRetentionCutoffIso,
} from '../../src/server/ledger-retention-policy.js';

test('resolveLedgerRetentionPolicy returns secure defaults for empty input', () => {
  const policy = resolveLedgerRetentionPolicy();

  assert.equal(policy.operationRuns.maxAgeDays, ledgerRetentionBounds.operationRunMaxAgeDays.default);
  assert.equal(policy.operationRuns.retainCountPerType, ledgerRetentionBounds.operationRunRetainCountPerType.default);
  assert.equal(policy.outcomeEvents.maxAgeDays, ledgerRetentionBounds.outcomeEventMaxAgeDays.default);
});

test('resolveLedgerRetentionPolicy reads the retention namespace from a full settings tree', () => {
  const policy = resolveLedgerRetentionPolicy({
    retention: {
      operationRunMaxAgeDays: 120,
      operationRunRetainCountPerType: 75,
      outcomeEventMaxAgeDays: 365,
    },
  });

  assert.equal(policy.operationRuns.maxAgeDays, 120);
  assert.equal(policy.operationRuns.retainCountPerType, 75);
  assert.equal(policy.outcomeEvents.maxAgeDays, 365);
});

test('resolveLedgerRetentionPolicy clamps below the minimum-retention floor', () => {
  const policy = resolveLedgerRetentionPolicy({
    retention: {
      operationRunMaxAgeDays: 1,
      operationRunRetainCountPerType: 1,
      outcomeEventMaxAgeDays: 1,
    },
  });

  assert.equal(policy.operationRuns.maxAgeDays, ledgerRetentionBounds.operationRunMaxAgeDays.min);
  assert.equal(policy.operationRuns.retainCountPerType, ledgerRetentionBounds.operationRunRetainCountPerType.min);
  assert.equal(policy.outcomeEvents.maxAgeDays, ledgerRetentionBounds.outcomeEventMaxAgeDays.min);
});

test('resolveLedgerRetentionPolicy clamps above the ceiling and tolerates junk values', () => {
  const policy = resolveLedgerRetentionPolicy({
    retention: {
      operationRunMaxAgeDays: 99999,
      operationRunRetainCountPerType: 'not-a-number',
      outcomeEventMaxAgeDays: 99999,
    },
  });

  assert.equal(policy.operationRuns.maxAgeDays, ledgerRetentionBounds.operationRunMaxAgeDays.max);
  // Junk falls back to the default rather than the ceiling.
  assert.equal(policy.operationRuns.retainCountPerType, ledgerRetentionBounds.operationRunRetainCountPerType.default);
  assert.equal(policy.outcomeEvents.maxAgeDays, ledgerRetentionBounds.outcomeEventMaxAgeDays.max);
});

test('resolveRetentionCutoffIso subtracts the window from the reference clock', () => {
  const now = new Date('2026-06-30T00:00:00.000Z');
  const cutoff = resolveRetentionCutoffIso(10, now);

  assert.equal(cutoff, '2026-06-20T00:00:00.000Z');
});

test('resolveRetentionCutoffIso falls back to a valid clock for invalid reference', () => {
  const cutoff = resolveRetentionCutoffIso(7, new Date('not-a-date'));

  assert.match(cutoff, /^\d{4}-\d{2}-\d{2}T/);
});
