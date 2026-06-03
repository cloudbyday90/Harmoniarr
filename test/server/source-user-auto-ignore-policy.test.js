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
import { evaluateAutoIgnoreApplication } from '../../src/server/activity/source-user-auto-ignore-policy.js';

const SUGGESTED = { suggested: true, reason: 'failure-dominated' };

test('evaluateAutoIgnoreApplication skips when auto-apply is disabled', () => {
  const decision = evaluateAutoIgnoreApplication({
    suggestion: SUGGESTED,
    settings: { autoIgnoreEnabled: false },
  });

  assert.deepEqual(decision, { apply: false, skipReason: 'auto_apply_disabled', source: 'auto_suggested' });
});

test('evaluateAutoIgnoreApplication skips when there is no confident suggestion', () => {
  const decision = evaluateAutoIgnoreApplication({
    suggestion: { suggested: false },
    settings: { autoIgnoreEnabled: true },
  });

  assert.equal(decision.apply, false);
  assert.equal(decision.skipReason, 'not_suggested');
});

test('evaluateAutoIgnoreApplication applies a confident suggestion for a new peer', () => {
  const decision = evaluateAutoIgnoreApplication({
    suggestion: SUGGESTED,
    existingEntry: null,
    settings: { autoIgnoreEnabled: true },
  });

  assert.equal(decision.apply, true);
  assert.equal(decision.skipReason, null);
});

test('evaluateAutoIgnoreApplication dedupes an already-ignored peer past its cooldown', () => {
  const decision = evaluateAutoIgnoreApplication({
    suggestion: SUGGESTED,
    existingEntry: { lastAutoEvaluatedAt: '2026-06-01T00:00:00.000Z' },
    settings: { autoIgnoreEnabled: true, autoIgnoreCooldownHours: 24 },
    now: '2026-06-10T00:00:00.000Z',
  });

  assert.equal(decision.apply, false);
  assert.equal(decision.skipReason, 'already_ignored');
});

test('evaluateAutoIgnoreApplication enforces a cooldown window (hysteresis) to prevent flapping', () => {
  const decision = evaluateAutoIgnoreApplication({
    suggestion: SUGGESTED,
    existingEntry: { lastAutoEvaluatedAt: '2026-06-10T00:00:00.000Z' },
    settings: { autoIgnoreEnabled: true, autoIgnoreCooldownHours: 24 },
    now: '2026-06-10T06:00:00.000Z',
  });

  assert.equal(decision.apply, false);
  assert.equal(decision.skipReason, 'cooldown');
});
