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
  buildSettingsSaveFailureMessage,
  buildSettingsSaveState,
} from '../../src/client/lib/settings-save-state-presentation.js';

test('settings save state is quiet before an edit or explicit save', () => {
  assert.deepEqual(buildSettingsSaveState(), {
    actionLabel: 'Save settings',
    canSubmit: true,
    message: '',
    state: 'initial',
    statusLabel: '',
    tone: 'neutral',
    verificationActionLabel: '',
  });
});

test('settings save state presents unsaved and saving changes clearly', () => {
  const unsaved = buildSettingsSaveState({ isDirty: true });
  const saving = buildSettingsSaveState({ isDirty: true, isSaving: true });

  assert.equal(unsaved.state, 'unsaved');
  assert.equal(unsaved.actionLabel, 'Save changes');
  assert.equal(unsaved.canSubmit, true);
  assert.equal(saving.state, 'saving');
  assert.equal(saving.actionLabel, 'Saving settings...');
  assert.equal(saving.canSubmit, false);
});

test('settings save state leaves a bounded retry path after a failed save', () => {
  const state = buildSettingsSaveState({ saveErrorMessage: 'Library batch size must be between 1 and 50.' });

  assert.equal(state.state, 'save_failed');
  assert.equal(state.statusLabel, 'Not saved');
  assert.equal(state.actionLabel, 'Try saving again');
  assert.equal(state.canSubmit, true);
  assert.match(state.message, /Library batch size must be between 1 and 50/);
});

test('settings save failure presentation suppresses sensitive-looking diagnostics', () => {
  const message = buildSettingsSaveFailureMessage('Request to https://private.example failed with api key abc');

  assert.equal(message, 'Settings could not be saved. Review the affected setting and try again.');
});

test('settings save state requires explicit provider verification only after a successful save', () => {
  const state = buildSettingsSaveState({
    hasSaved: true,
    requiresVerification: true,
    successMessage: 'Settings saved.',
  });

  assert.equal(state.state, 'saved_unverified');
  assert.equal(state.actionLabel, 'Saved');
  assert.equal(state.verificationActionLabel, 'Test saved connection');
  assert.match(state.message, /Test the saved connection/);
});
