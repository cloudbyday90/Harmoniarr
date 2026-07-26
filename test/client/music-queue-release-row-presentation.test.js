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
import { normalizeMusicQueueRelease } from '../../src/client/lib/acquisition-pipeline-presentation.js';
import { buildMusicQueueReleaseRowPresentation } from '../../src/client/lib/music-queue-release-row-presentation.js';

test('Music Queue release rows keep accepted quality compact', () => {
  const release = normalizeMusicQueueRelease({
    artistName: 'Forest Frank',
    expectedTrackCount: 12,
    matchedTrackCount: 4,
    missingTrackCount: 8,
    quality: {
      code: 'accepted',
      profile: { code: 'lossless_archive' },
    },
    releaseTitle: 'Child of God',
    status: {
      code: 'downloading',
      label: 'Downloading',
      tone: 'info',
    },
  });

  assert.deepEqual(buildMusicQueueReleaseRowPresentation(release), {
    facts: [
      { key: 'progress', label: '8 tracks still missing', tone: 'neutral' },
      { key: 'quality', label: 'Quality profile: Lossless archive', tone: 'neutral' },
    ],
    qualityNeedsAttention: false,
    statusTone: 'info',
    updatedLabel: 'Not updated yet',
  });
});

test('Music Queue release rows elevate a quality stop without exposing match evidence', () => {
  const release = normalizeMusicQueueRelease({
    expectedTrackCount: 10,
    matchedTrackCount: 10,
    quality: {
      code: 'needs_verification',
      profile: { code: 'lossless_archive' },
      tone: 'warning',
    },
    releaseTitle: 'Geogaddi',
    status: {
      code: 'quality_choice_needed',
      label: 'Quality choice needed',
      tone: 'warning',
    },
  });

  const presentation = buildMusicQueueReleaseRowPresentation(release);

  assert.equal(presentation.qualityNeedsAttention, true);
  assert.equal(presentation.statusTone, 'warning');
  assert.deepEqual(presentation.facts, [
    { key: 'progress', label: 'All 10 tracks matched', tone: 'neutral' },
    { key: 'quality', label: 'Quality: Needs verification', tone: 'warning' },
  ]);
});
