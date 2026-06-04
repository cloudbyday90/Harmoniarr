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
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const CONFIRM_DIALOG = new URL('../../src/client/components/ConfirmDialog.vue', import.meta.url);
const CONFIRM_HOST = new URL('../../src/client/components/ConfirmDialogHost.vue', import.meta.url);
const APP_SHELL = new URL('../../src/client/components/AppShell.vue', import.meta.url);

const DESTRUCTIVE_SITES = [
  new URL('../../src/client/views/RequestMusicView.vue', import.meta.url),
  new URL('../../src/client/views/RequestDetailView.vue', import.meta.url),
  new URL('../../src/client/views/ActivityIgnoredView.vue', import.meta.url),
  new URL('../../src/client/views/OperationsView.vue', import.meta.url),
];

async function read(url) {
  return readFile(url, 'utf8');
}

test('ConfirmDialog follows the WAI-ARIA alertdialog pattern', async () => {
  const source = await read(CONFIRM_DIALOG);
  assert.match(source, /role="alertdialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /aria-labelledby/);
  // Message is exposed via aria-describedby per the APG alertdialog pattern.
  assert.match(source, /aria-describedby="isConfirming && message \? 'confirm-message' : undefined"/);
  assert.match(source, /id="confirm-message"/);
  // Type-to-confirm input blocks paste to prevent accidental autofill.
  assert.match(source, /@paste="onPaste"/);
});

test('ConfirmDialogHost drives the dialog from the imperative service', async () => {
  const source = await read(CONFIRM_HOST);
  assert.match(source, /useConfirmHost/);
  assert.match(source, /@execute="accept"/);
  assert.match(source, /@close="cancel"/);
  assert.match(source, /@update:typed="setTyped"/);
  assert.match(source, /@update:acknowledged="setAcknowledged"/);
});

test('AppShell mounts the single ConfirmDialogHost', async () => {
  const source = await read(APP_SHELL);
  assert.match(source, /import ConfirmDialogHost from '\.\/ConfirmDialogHost\.vue'/);
  assert.match(source, /<ConfirmDialogHost \/>/);
});

test('every migrated destructive site routes through useConfirm', async () => {
  for (const url of DESTRUCTIVE_SITES) {
    const source = await read(url);
    assert.match(source, /import \{ useConfirm \} from '\.\.\/composables\/useConfirm\.js'/, `${url} imports useConfirm`);
    assert.match(source, /const confirm = useConfirm\(\)/, `${url} instantiates confirm`);
    assert.match(source, /await confirm\(/, `${url} awaits a confirmation`);
  }
});
