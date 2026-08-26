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
  buildDownloaderMissingMusicDecisionLinkLabel,
  buildDownloaderMissingMusicDecisionLocation,
  getDownloaderMissingMusicDecision,
} from '../../src/client/lib/downloader-missing-music-release-link.js';

const linkedTransfer = Object.freeze({
  diagnostics: {
    importLinkage: {
      musicQueueRelease: {
        artistName: 'Autechre',
        releaseTitle: 'Amber',
        wantedReleaseId: 'wanted-release-1',
        wantedStatus: 'missing',
      },
    },
  },
});

test('Downloader linkage resolves the canonical Missing Music decision destination', () => {
  assert.deepEqual(getDownloaderMissingMusicDecision(linkedTransfer), {
    artistName: 'Autechre',
    decisionId: 'wanted-release-1',
    releaseTitle: 'Amber',
    wantedStatus: 'missing',
  });
  assert.deepEqual(buildDownloaderMissingMusicDecisionLocation(linkedTransfer), {
    name: 'missing-decision',
    params: { decisionId: 'wanted-release-1' },
  });
  assert.equal(
    buildDownloaderMissingMusicDecisionLinkLabel(linkedTransfer),
    'Open Missing Music release: Autechre — Amber',
  );
});

test('Downloader Missing Music linkage is unavailable without a durable decision ID', () => {
  assert.equal(getDownloaderMissingMusicDecision({ diagnostics: { importLinkage: {} } }), null);
  assert.equal(buildDownloaderMissingMusicDecisionLocation({ diagnostics: { importLinkage: {} } }), null);
});
