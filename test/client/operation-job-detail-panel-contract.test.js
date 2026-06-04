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

const PANEL_PATH = new URL('../../src/client/components/OperationJobDetailPanel.vue', import.meta.url);
const OPERATIONS_VIEW_PATH = new URL('../../src/client/views/OperationsView.vue', import.meta.url);
const OPERATOR_HOME_PATH = new URL('../../src/client/components/home/OperatorHomePanel.vue', import.meta.url);

test('OperationJobDetailPanel declares a data-down/events-up contract', async () => {
  const source = await readFile(PANEL_PATH, 'utf8');

  for (const propName of [
    'run', 'detail', 'isLoading', 'isCancelling', 'isRetrying',
    'cancellationError', 'retryError', 'detailError',
  ]) {
    assert.match(source, new RegExp(`${propName}:\\s*\\{`), `panel should declare a "${propName}" prop`);
  }

  assert.match(source, /defineEmits\(\['request-cancel', 'request-retry'\]\)/);
  assert.match(source, /emit\('request-cancel'\)/);
  assert.match(source, /emit\('request-retry'\)/);
});

test('OperationsView delegates job detail to the extracted panel', async () => {
  const source = await readFile(OPERATIONS_VIEW_PATH, 'utf8');

  assert.match(source, /import OperationJobDetailPanel from '\.\.\/components\/OperationJobDetailPanel\.vue'/);
  assert.match(source, /<OperationJobDetailPanel/);
  assert.match(source, /@request-cancel="handleRequestCancellation"/);
  assert.match(source, /@request-retry="handleRequestRetry"/);

  // The inline panel markup must no longer live in the view.
  assert.doesNotMatch(source, /class="ops-run-detail-header"/);
  assert.doesNotMatch(source, /class="ops-technical-details"/);
});

test('Operator Home add-artists tile is a neutral action, not a fake artist avatar', async () => {
  const source = await readFile(OPERATOR_HOME_PATH, 'utf8');

  // The colored initial avatar must be gone from the tile.
  assert.doesNotMatch(source, /buildDiscoverAvatarStyle/);
  assert.doesNotMatch(source, /buildDiscoverArtistInitial/);

  // The tile keeps a dashed action treatment with a glyph and clear copy.
  assert.match(source, /hx-artwork--dashed operator-home__discover-art/);
  assert.match(source, /operator-home__discover-art svg/);
  assert.match(source, /Add more artists/);
});
