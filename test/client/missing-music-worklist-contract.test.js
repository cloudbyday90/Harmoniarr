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

const COMPONENT_PATH = new URL('../../src/client/components/missing-music/MissingMusicDecisionWorklist.vue', import.meta.url);
const MISSING_VIEW_PATH = new URL('../../src/client/views/MissingView.vue', import.meta.url);

test('Missing Music worklist groups filters and gives every control a visible label', async () => {
  const source = await readFile(COMPONENT_PATH, 'utf8');

  assert.match(source, /<fieldset class="missing-music-worklist__filters">/);
  assert.match(source, /<legend>Filter releases<\/legend>/);
  assert.match(source, /for="missing-music-user">User<\/label>/);
  assert.match(source, /for="missing-music-account-status">Account status<\/label>/);
  assert.match(source, /for="missing-music-work-state">Work state<\/label>/);
  assert.match(source, /for="missing-music-search">Search releases<\/label>/);
});

test('Missing Music worklist reports result changes and states the next step in every row', async () => {
  const source = await readFile(COMPONENT_PATH, 'utf8');

  assert.match(source, /role="status" aria-atomic="true"/);
  assert.match(source, /<strong>Next step:<\/strong>/);
  assert.match(source, /Disabled — history only/);
});

test('MissingView uses the authorized worklist instead of a parallel client-side decision grid', async () => {
  const source = await readFile(MISSING_VIEW_PATH, 'utf8');

  assert.match(source, /import MissingMusicDecisionWorklist/);
  assert.match(source, /<MissingMusicDecisionWorklist \/>/);
  assert.doesNotMatch(source, /MissingReleaseDecisionActions/);
  assert.doesNotMatch(source, /useLibraryWantedReleases/);
});
