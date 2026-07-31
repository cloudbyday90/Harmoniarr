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

const COMPONENT_PATH = new URL('../../src/client/components/activity/ActivityResourceState.vue', import.meta.url);

const VIEW_EXPECTATIONS = Object.freeze([
  {
    copy: 'Could not load activity',
    path: '../../src/client/views/ActivityFeedView.vue',
  },
  {
    copy: 'Could not load history',
    path: '../../src/client/views/ActivityHistoryView.vue',
  },
  {
    copy: 'Could not load monitored artists',
    path: '../../src/client/views/ActivityMonitoredArtistsView.vue',
  },
  {
    copy: 'Could not load releases',
    path: '../../src/client/views/ActivityReleasesView.vue',
  },
]);

test('ActivityResourceState has semantic loading, empty, and retryable-error contracts', async () => {
  const source = await readFile(COMPONENT_PATH, 'utf8');

  assert.match(source, /\['empty', 'error', 'loading'\]/);
  assert.match(source, /:role="announcementRole"/);
  assert.match(source, /:aria-live="announcementPoliteness"/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /actionLabel/);
  assert.match(source, /\$emit\('action'\)/);
});

test('normal Activity read views use generic retry states instead of raw error pills', async () => {
  for (const expectation of VIEW_EXPECTATIONS) {
    const source = await readFile(new URL(expectation.path, import.meta.url), 'utf8');

    assert.match(source, /ActivityResourceState/);
    assert.match(source, new RegExp(expectation.copy));
    assert.match(source, /action-label="Try again"/);
  }
});

test('Monitored Artists differentiates an empty search result from an empty library', async () => {
  const source = await readFile(
    new URL('../../src/client/views/ActivityMonitoredArtistsView.vue', import.meta.url),
    'utf8',
  );

  assert.match(source, /const hasSearchQuery = computed/);
  assert.match(source, /No matching monitored artists/);
  assert.match(source, /Clear your search or try another artist name/);
});
