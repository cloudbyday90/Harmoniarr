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
  CONFIRM_LEVEL,
  CONFIRM_TONE,
  normalizeConfirmLevel,
  normalizeConfirmRequest,
  normalizeConfirmTone,
  resolveConfirmGate,
  resolveTypedMatch,
} from '../../src/client/lib/confirm-intent.js';

test('normalizeConfirmLevel defaults unknown levels to NONE', () => {
  assert.equal(normalizeConfirmLevel(CONFIRM_LEVEL.CHECKBOX), CONFIRM_LEVEL.CHECKBOX);
  assert.equal(normalizeConfirmLevel(CONFIRM_LEVEL.TYPE_TO_CONFIRM), CONFIRM_LEVEL.TYPE_TO_CONFIRM);
  assert.equal(normalizeConfirmLevel('bogus'), CONFIRM_LEVEL.NONE);
  assert.equal(normalizeConfirmLevel(undefined), CONFIRM_LEVEL.NONE);
});

test('normalizeConfirmTone defaults unknown tones to DANGER', () => {
  assert.equal(normalizeConfirmTone(CONFIRM_TONE.PRIMARY), CONFIRM_TONE.PRIMARY);
  assert.equal(normalizeConfirmTone('bogus'), CONFIRM_TONE.DANGER);
  assert.equal(normalizeConfirmTone(undefined), CONFIRM_TONE.DANGER);
});

test('normalizeConfirmRequest fills safe defaults and trims copy', () => {
  const req = normalizeConfirmRequest();
  assert.equal(req.title, 'Confirm');
  assert.equal(req.message, '');
  assert.equal(req.level, CONFIRM_LEVEL.NONE);
  assert.equal(req.tone, CONFIRM_TONE.DANGER);
  assert.equal(req.confirmLabel, 'Confirm');
  assert.equal(req.cancelLabel, 'Cancel');
  assert.equal(req.confirmText, '');

  const custom = normalizeConfirmRequest({
    title: '  Cancel request?  ',
    message: '  This stops fulfillment.  ',
    confirmLabel: '  Cancel request ',
    tone: 'primary',
  });
  assert.equal(custom.title, 'Cancel request?');
  assert.equal(custom.message, 'This stops fulfillment.');
  assert.equal(custom.confirmLabel, 'Cancel request');
  assert.equal(custom.tone, CONFIRM_TONE.PRIMARY);
});

test('normalizeConfirmRequest only retains confirmText for TYPE_TO_CONFIRM', () => {
  const typed = normalizeConfirmRequest({ level: 'type_to_confirm', confirmText: 'do it' });
  assert.equal(typed.confirmText, 'do it');

  // confirmText is dropped when the level does not require typing.
  const checkbox = normalizeConfirmRequest({ level: 'checkbox', confirmText: 'do it' });
  assert.equal(checkbox.confirmText, '');
});

test('resolveTypedMatch only gates TYPE_TO_CONFIRM', () => {
  assert.equal(resolveTypedMatch({ level: 'none', confirmText: 'x', typed: '' }), true);
  assert.equal(resolveTypedMatch({ level: 'checkbox', confirmText: 'x', typed: '' }), true);
  assert.equal(resolveTypedMatch({ level: 'type_to_confirm', confirmText: 'go', typed: 'go' }), true);
  assert.equal(resolveTypedMatch({ level: 'type_to_confirm', confirmText: 'go', typed: 'GO' }), false);
  assert.equal(resolveTypedMatch({ level: 'type_to_confirm', confirmText: 'go', typed: '' }), false);
});

test('resolveConfirmGate: NONE is always confirmable', () => {
  assert.deepEqual(resolveConfirmGate({ level: 'none' }), { matches: true, canConfirm: true });
});

test('resolveConfirmGate: CHECKBOX requires acknowledgement', () => {
  assert.equal(resolveConfirmGate({ level: 'checkbox', acknowledged: false }).canConfirm, false);
  assert.equal(resolveConfirmGate({ level: 'checkbox', acknowledged: true }).canConfirm, true);
});

test('resolveConfirmGate: TYPE_TO_CONFIRM requires acknowledgement AND exact match', () => {
  const confirmText = 'start import apply';
  assert.equal(
    resolveConfirmGate({ level: 'type_to_confirm', confirmText, acknowledged: true, typed: 'start' }).canConfirm,
    false,
  );
  assert.equal(
    resolveConfirmGate({ level: 'type_to_confirm', confirmText, acknowledged: false, typed: confirmText }).canConfirm,
    false,
  );
  const ready = resolveConfirmGate({ level: 'type_to_confirm', confirmText, acknowledged: true, typed: confirmText });
  assert.deepEqual(ready, { matches: true, canConfirm: true });
});
