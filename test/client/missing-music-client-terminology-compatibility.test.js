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
  addMusicQueueReleaseToLibrary,
  allowMusicQueueFallbackQuality,
  fetchMusicQueueRelease,
  fetchMusicQueueReleases,
  recheckMusicQueueReleaseSafeAdd,
  rejectMusicQueueMatch,
  searchMusicQueueReleaseAgain,
  useMusicQueueMatch,
} from '../../src/client/lib/acquisition-api.js';
import {
  addMissingMusicReleaseToLibrary,
  allowMissingMusicFallbackQuality,
  fetchMissingMusicRelease,
  fetchMissingMusicReleases,
  recheckMissingMusicReleaseSafeAdd,
  rejectMissingMusicMatch,
  searchMissingMusicReleaseAgain,
  selectMissingMusicMatch,
} from '../../src/client/lib/missing-music-release-api.js';
import { buildMusicQueueProgressStrip } from '../../src/client/lib/music-queue-progress-presentation.js';
import { buildMissingMusicProgressStrip } from '../../src/client/lib/missing-music-progress-presentation.js';
import {
  buildMusicQueueReleaseActionFeedback,
  createMusicQueueActionFeedback,
} from '../../src/client/lib/music-queue-action-feedback-presentation.js';
import {
  buildMissingMusicReleaseActionFeedback,
  createMissingMusicActionFeedback,
} from '../../src/client/lib/missing-music-action-feedback-presentation.js';
import {
  MUSIC_QUEUE_ATTENTION_STATUSES,
  getMusicQueueReleaseStatusCode,
  hasMusicQueueHomeProgress,
  isMusicQueueActiveProgressRelease,
  isMusicQueueAttentionRelease,
  isMusicQueueHomeProgressRelease,
} from '../../src/client/lib/music-queue-progress-state.js';
import {
  MISSING_MUSIC_ATTENTION_STATUSES,
  getMissingMusicReleaseStatusCode,
  hasMissingMusicHomeProgress,
  isMissingMusicActiveProgressRelease,
  isMissingMusicAttentionRelease,
  isMissingMusicHomeProgressRelease,
} from '../../src/client/lib/missing-music-progress-state.js';
import {
  MUSIC_QUEUE_ACTIVE_PROGRESS_STATUSES,
  hasActiveMusicQueueProgress,
  useMusicQueue,
} from '../../src/client/composables/useMusicQueue.js';
import {
  MISSING_MUSIC_ACTIVE_PROGRESS_STATUSES,
  hasActiveMissingMusicReleaseProgress,
  useMissingMusicReleaseWorkflow,
} from '../../src/client/composables/useMissingMusicReleaseWorkflow.js';

test('legacy client entry points remain aliases of canonical Missing Music modules', () => {
  assert.equal(addMusicQueueReleaseToLibrary, addMissingMusicReleaseToLibrary);
  assert.equal(allowMusicQueueFallbackQuality, allowMissingMusicFallbackQuality);
  assert.equal(fetchMusicQueueRelease, fetchMissingMusicRelease);
  assert.equal(fetchMusicQueueReleases, fetchMissingMusicReleases);
  assert.equal(recheckMusicQueueReleaseSafeAdd, recheckMissingMusicReleaseSafeAdd);
  assert.equal(rejectMusicQueueMatch, rejectMissingMusicMatch);
  assert.equal(searchMusicQueueReleaseAgain, searchMissingMusicReleaseAgain);
  assert.equal(useMusicQueueMatch, selectMissingMusicMatch);
  assert.equal(buildMusicQueueProgressStrip, buildMissingMusicProgressStrip);
  assert.equal(buildMusicQueueReleaseActionFeedback, buildMissingMusicReleaseActionFeedback);
  assert.equal(createMusicQueueActionFeedback, createMissingMusicActionFeedback);
  assert.equal(MUSIC_QUEUE_ACTIVE_PROGRESS_STATUSES, MISSING_MUSIC_ACTIVE_PROGRESS_STATUSES);
  assert.equal(MUSIC_QUEUE_ATTENTION_STATUSES, MISSING_MUSIC_ATTENTION_STATUSES);
  assert.equal(getMusicQueueReleaseStatusCode, getMissingMusicReleaseStatusCode);
  assert.equal(hasActiveMusicQueueProgress, hasActiveMissingMusicReleaseProgress);
  assert.equal(hasMusicQueueHomeProgress, hasMissingMusicHomeProgress);
  assert.equal(isMusicQueueActiveProgressRelease, isMissingMusicActiveProgressRelease);
  assert.equal(isMusicQueueAttentionRelease, isMissingMusicAttentionRelease);
  assert.equal(isMusicQueueHomeProgressRelease, isMissingMusicHomeProgressRelease);
  assert.equal(useMusicQueue, useMissingMusicReleaseWorkflow);
});
