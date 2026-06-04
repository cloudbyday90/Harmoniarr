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

import { useConfirm, useConfirmHost } from '../../src/client/composables/useConfirm.js';

test('useConfirm resolves true when the host accepts a NONE-level prompt', async () => {
  const confirm = useConfirm();
  const host = useConfirmHost();

  const pending = confirm({ title: 'Cancel request?', message: 'Stops fulfillment.' });
  assert.equal(host.isOpen.value, true);
  assert.equal(host.activeRequest.value.title, 'Cancel request?');
  // NONE level is immediately confirmable.
  assert.equal(host.canConfirm.value, true);

  host.accept();
  assert.equal(await pending, true);
  assert.equal(host.isOpen.value, false);
  assert.equal(host.activeRequest.value, null);
});

test('useConfirm resolves false when the host cancels', async () => {
  const confirm = useConfirm();
  const host = useConfirmHost();

  const pending = confirm({ title: 'Remove?' });
  host.cancel();
  assert.equal(await pending, false);
  assert.equal(host.isOpen.value, false);
});

test('useConfirm CHECKBOX gate blocks accept until acknowledged', async () => {
  const confirm = useConfirm();
  const host = useConfirmHost();

  const pending = confirm({ title: 'Purge?', level: 'checkbox' });
  assert.equal(host.canConfirm.value, false);

  // accept() is a no-op while the gate is unmet.
  host.accept();
  assert.equal(host.isOpen.value, true);

  host.setAcknowledged(true);
  assert.equal(host.canConfirm.value, true);
  host.accept();
  assert.equal(await pending, true);
});

test('useConfirm TYPE_TO_CONFIRM gate requires acknowledgement and exact text', async () => {
  const confirm = useConfirm();
  const host = useConfirmHost();

  const pending = confirm({ title: 'Apply?', level: 'type_to_confirm', confirmText: 'go' });
  host.setAcknowledged(true);
  host.setTyped('no');
  assert.equal(host.matches.value, false);
  assert.equal(host.canConfirm.value, false);

  host.setTyped('go');
  assert.equal(host.matches.value, true);
  assert.equal(host.canConfirm.value, true);
  host.accept();
  assert.equal(await pending, true);
});

test('opening a second confirm auto-resolves the first as false', async () => {
  const confirm = useConfirm();
  const host = useConfirmHost();

  const first = confirm({ title: 'First?' });
  const second = confirm({ title: 'Second?' });

  assert.equal(await first, false);
  assert.equal(host.activeRequest.value.title, 'Second?');

  host.accept();
  assert.equal(await second, true);
});
