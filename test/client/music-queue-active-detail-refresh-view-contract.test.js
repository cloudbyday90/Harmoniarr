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

const VIEW_PATH = new URL('../../src/client/views/MusicQueueView.vue', import.meta.url);

test('Music Queue refreshes an already authorized selected detail from the queue list', async () => {
  const source = await readFile(VIEW_PATH, 'utf8');

  assert.match(source, /watch\(releases, \(updatedReleases\) => \{/);
  assert.match(source, /releaseDetail\.value\?\.id !== wantedReleaseId/);
  assert.match(source, /updatedReleases\.find\(\(release\) => release\.id === wantedReleaseId\)/);
  assert.match(source, /applyReleaseDetail\(refreshedRelease\)/);
});
