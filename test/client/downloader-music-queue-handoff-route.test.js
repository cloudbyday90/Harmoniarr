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
  normalizeDownloaderMusicQueueHandoffRouteQuery,
  omitDownloaderMusicQueueHandoffRouteQuery,
} from '../../src/client/lib/downloader-music-queue-handoff-route.js';

test('normalizes a single Music Queue release route parameter', () => {
  assert.deepEqual(normalizeDownloaderMusicQueueHandoffRouteQuery({
    wantedReleaseId: [' wanted-release-1 ', 'ignored'],
  }), {
    wantedReleaseId: 'wanted-release-1',
  });
  assert.deepEqual(normalizeDownloaderMusicQueueHandoffRouteQuery({ wantedReleaseId: 42 }), {
    wantedReleaseId: '',
  });
});

test('removes only the Music Queue release handoff parameter', () => {
  assert.deepEqual(omitDownloaderMusicQueueHandoffRouteQuery({
    open: 'details',
    transferId: 'transfer-1',
    wantedReleaseId: 'wanted-release-1',
  }), {
    open: 'details',
    transferId: 'transfer-1',
  });
});
