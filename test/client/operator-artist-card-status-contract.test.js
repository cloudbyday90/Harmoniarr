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

const COMPONENT_PATH = new URL('../../src/client/components/home/OperatorArtistCard.vue', import.meta.url);

test('OperatorArtistCard only renders a meaningful static release-plan status', async () => {
  const source = await readFile(COMPONENT_PATH, 'utf8');

  assert.match(source, /buildOperatorArtistCardStatusPresentation/);
  assert.match(source, /const cardStatus = computed/);
  assert.match(source, /v-if="cardStatus"/);
  assert.match(source, /:data-tone="cardStatus\.tone"/);
  assert.doesNotMatch(source, /role="status"/);
  assert.doesNotMatch(source, /Last reconciliation completed/);
});
