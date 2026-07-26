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
import { buildSettingsSaveSuccessMessage } from '../../src/client/lib/settings-save-presentation.js';

test('buildSettingsSaveSuccessMessage keeps ordinary Settings saves concise', () => {
  assert.equal(buildSettingsSaveSuccessMessage({}), 'Settings saved.');
  assert.equal(buildSettingsSaveSuccessMessage({ musicQueueRecovery: null }), 'Settings saved.');
});

test('buildSettingsSaveSuccessMessage confirms one released Music Queue item that is searching', () => {
  assert.equal(
    buildSettingsSaveSuccessMessage({
      musicQueueRecovery: { releasedCount: 1, runStarted: true },
    }),
    'Settings saved. Music Queue is searching for 1 release automatically.',
  );
});

test('buildSettingsSaveSuccessMessage confirms a deferred automatic search without claiming it has started', () => {
  assert.equal(
    buildSettingsSaveSuccessMessage({
      musicQueueRecovery: { dispatchDeferred: true, releasedCount: 2, runStarted: false },
    }),
    'Settings saved. Music Queue will search for 2 releases automatically.',
  );
});

test('buildSettingsSaveSuccessMessage ignores malformed recovery counts', () => {
  for (const releasedCount of [0, -1, 1.5, '2', Number.POSITIVE_INFINITY]) {
    assert.equal(
      buildSettingsSaveSuccessMessage({ musicQueueRecovery: { releasedCount } }),
      'Settings saved.',
    );
  }
});
