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
  buildMusicQueueDownloaderHandoff,
  buildReleaseScopedDownloaderHandoff,
} from '../../src/client/lib/music-queue-downloader-handoff.js';

test('buildMusicQueueDownloaderHandoff creates a release-scoped Downloader route', () => {
  assert.deepEqual(buildMusicQueueDownloaderHandoff({
    action: { code: 'open_downloader', routeName: 'downloader', type: 'route' },
    artistName: 'Forest Frank',
    id: 'wanted-forest-frank',
    releaseTitle: 'Child of God',
  }), {
    accessibleLabel: 'View download progress for Forest Frank — Child of God',
    description: 'View the live transfer and its controls in Downloader. Release decisions remain in Music Queue.',
    label: 'View download progress',
    location: {
      name: 'acquisition-downloader',
      query: { wantedReleaseId: 'wanted-forest-frank' },
    },
    wantedReleaseId: 'wanted-forest-frank',
  });
});

test('buildMusicQueueDownloaderHandoff accepts a review projection and rejects unrelated actions', () => {
  assert.equal(buildMusicQueueDownloaderHandoff({
    action: { code: 'open_downloader', routeName: 'downloader', type: 'route' },
    releaseId: 'wanted-review-projection',
  })?.location.query.wantedReleaseId, 'wanted-review-projection');
  assert.equal(buildMusicQueueDownloaderHandoff({
    action: { code: 'review_matches', type: 'review' },
    id: 'wanted-review',
  }), null);
  assert.equal(buildMusicQueueDownloaderHandoff({
    action: { code: 'open_downloader', routeName: 'downloader', type: 'route' },
  }), null);
});

test('buildReleaseScopedDownloaderHandoff accepts a durable queue link without accepting an action', () => {
  assert.deepEqual(buildReleaseScopedDownloaderHandoff({
    artistName: 'Forest Frank',
    releaseTitle: 'Child of God',
    wantedReleaseId: 'wanted-forest-frank',
  }), {
    accessibleLabel: 'View download progress for Forest Frank — Child of God',
    description: 'View the live transfer and its controls in Downloader. Release decisions remain in Music Queue.',
    label: 'View download progress',
    location: {
      name: 'acquisition-downloader',
      query: { wantedReleaseId: 'wanted-forest-frank' },
    },
    wantedReleaseId: 'wanted-forest-frank',
  });
  assert.equal(buildReleaseScopedDownloaderHandoff({ artistName: 'Forest Frank' }), null);
});
