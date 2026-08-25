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
    attentionLabel: null,
    facts: [
      { key: 'progress', label: '8 tracks still missing', tone: 'neutral' },
      { key: 'quality', label: 'Quality profile: Lossless archive', tone: 'neutral' },
    ],
    qualityNeedsAttention: false,
    statusTone: 'info',
    transition: {
      label: 'Up next',
      message: 'Harmoniarr will automatically check the files, then add them to the library.',
    },
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
  assert.equal(presentation.transition, null);
  assert.deepEqual(presentation.facts, [
    { key: 'progress', label: 'All 10 tracks matched', tone: 'neutral' },
    { key: 'quality', label: 'Quality: Needs verification', tone: 'warning' },
  ]);
  assert.equal(presentation.attentionLabel, null);
});

test('Music Queue release rows name the safe stop without exposing diagnostics', () => {
  const release = normalizeMusicQueueRelease({
    expectedTrackCount: 10,
    matchedTrackCount: 10,
    missingTrackCount: 10,
    quality: { code: 'accepted', profile: { code: 'lossless_archive' } },
    releaseTitle: 'Northbound',
    status: {
      code: 'needs_help_adding',
      detail: 'A file for this release already exists in your library, so Harmoniarr stopped before overwriting it.',
      label: 'Needs help',
      repair: {
        actionCode: 'review_add_plan',
        actionLabel: 'Review library conflict',
        reasonCode: 'library_collision',
        title: 'Existing library files need review',
      },
      tone: 'warning',
    },
  });

  const presentation = buildMusicQueueReleaseRowPresentation(release);

  assert.equal(presentation.attentionLabel, 'Existing library files need review');
  assert.equal(presentation.qualityNeedsAttention, false);
  assert.equal(presentation.statusTone, 'warning');
  assert.doesNotMatch(presentation.attentionLabel, /candidate|path|source/i);
});

test('Music Queue release rows describe only recognized automatic handoffs', () => {
  const release = normalizeMusicQueueRelease({
    expectedTrackCount: 12,
    missingTrackCount: 12,
    quality: { code: 'accepted', profile: { code: 'lossless_archive' } },
    releaseTitle: 'Child of God',
    status: {
      code: 'checking_matches',
      label: 'Checking matches',
      tone: 'info',
    },
  });

  assert.deepEqual(buildMusicQueueReleaseRowPresentation(release).transition, {
    label: 'Up next',
    message: 'Harmoniarr will automatically queue the selected match for download when its checks finish.',
  });
  assert.equal(buildMusicQueueReleaseRowPresentation({ statusCode: 'unknown_future_status' }).transition, null);
});

test('Music Queue release rows retain manual selection provenance as a compact fact', () => {
  const release = normalizeMusicQueueRelease({
    evidence: {
      selectionSource: 'manual',
      selectionState: 'selected',
    },
    expectedTrackCount: 12,
    missingTrackCount: 12,
    quality: { code: 'accepted', profile: { code: 'lossless_archive' } },
    releaseTitle: 'Child of God',
    status: {
      code: 'queued_for_search',
      label: 'Waiting to search',
      tone: 'neutral',
    },
  });

  assert.deepEqual(buildMusicQueueReleaseRowPresentation(release).facts, [
    { key: 'progress', label: '12 tracks still missing', tone: 'neutral' },
    { key: 'quality', label: 'Quality profile: Lossless archive', tone: 'neutral' },
    { key: 'selection', label: 'Manual selection', tone: 'info' },
  ]);
});
