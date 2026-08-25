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
import { buildMusicQueueReleaseProgressPresentation } from '../../src/client/lib/music-queue-release-progress-presentation.js';

test('Music Queue release progress presents durable download confirmation in a stable ordered flow', () => {
  const progress = buildMusicQueueReleaseProgressPresentation({
    matchSummary: {
      confirmedTransferCount: 2,
      latestConfirmedTransferAt: '2026-08-25T19:12:00.000Z',
      selectedCount: 1,
      totalCount: 3,
    },
    status: {
      code: 'downloading',
      message: 'A selected match is downloading.',
      progressStep: 'download',
    },
    statusCode: 'downloading',
  });

  assert.deepEqual(progress.steps.map((step) => [step.id, step.state]), [
    ['search', 'complete'],
    ['match', 'complete'],
    ['download', 'current'],
    ['add', 'upcoming'],
  ]);
  assert.match(progress.summary, /^Download: 2 transfers confirmed by Harmoniarr\./);
  assert.match(progress.steps[2].detail, /Confirmed /);
});

test('Music Queue release progress prefers the current status over older derived detail', () => {
  const progress = buildMusicQueueReleaseProgressPresentation({
    detailText: 'A previous match still has older evaluation detail.',
    status: {
      code: 'searching',
      message: 'Harmoniarr is looking for matching files.',
      progressStep: 'search',
    },
    statusCode: 'searching',
  });

  assert.equal(progress.steps[0].detail, 'Harmoniarr is looking for matching files.');
});

test('Music Queue release progress makes the blocked step explicit without adding another action', () => {
  const progress = buildMusicQueueReleaseProgressPresentation({
    matchSummary: { totalCount: 2 },
    status: {
      code: 'quality_choice_needed',
      message: 'The best match does not clearly satisfy the selected quality preference.',
      progressStep: 'quality',
    },
    statusCode: 'quality_choice_needed',
  });

  assert.deepEqual(progress.steps.map((step) => [step.id, step.state]), [
    ['search', 'complete'],
    ['match', 'attention'],
    ['download', 'upcoming'],
    ['add', 'upcoming'],
  ]);
  assert.match(progress.summary, /^Choose match: The best match/);
});

test('Music Queue release progress completes every stage only after the release is in the library', () => {
  const progress = buildMusicQueueReleaseProgressPresentation({
    status: {
      code: 'in_library',
      message: 'The desired release is already in the library.',
      progressStep: 'complete',
    },
    statusCode: 'in_library',
  });

  assert.deepEqual(progress.steps.map((step) => step.state), [
    'complete',
    'complete',
    'complete',
    'complete',
  ]);
  assert.equal(progress.summary, 'This release has completed every Music Queue step.');
});
