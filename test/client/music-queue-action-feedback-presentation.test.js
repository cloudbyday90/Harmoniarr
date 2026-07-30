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
  buildMusicQueueReleaseActionFeedback,
  createMusicQueueActionFeedback,
} from '../../src/client/lib/music-queue-action-feedback-presentation.js';

test('Music Queue action feedback presents working, success, and error with appropriate live-region semantics', () => {
  const feedback = createMusicQueueActionFeedback({
    actionKey: 'wanted-1:match-1:use',
    message: 'Using this match...',
    phase: 'working',
    wantedReleaseId: 'wanted-1',
  });

  assert.deepEqual(buildMusicQueueReleaseActionFeedback(feedback, 'wanted-1'), {
    actionKey: 'wanted-1:match-1:use',
    label: 'Working',
    message: 'Using this match...',
    phase: 'working',
    role: 'status',
    tone: 'info',
    wantedReleaseId: 'wanted-1',
  });

  feedback.phase = 'success';
  assert.equal(buildMusicQueueReleaseActionFeedback(feedback, 'wanted-1').role, 'status');
  assert.equal(buildMusicQueueReleaseActionFeedback(feedback, 'wanted-1').tone, 'success');

  feedback.phase = 'error';
  assert.equal(buildMusicQueueReleaseActionFeedback(feedback, 'wanted-1').label, 'Could not continue');
  assert.equal(buildMusicQueueReleaseActionFeedback(feedback, 'wanted-1').role, 'alert');
  assert.equal(buildMusicQueueReleaseActionFeedback(feedback, 'wanted-1').tone, 'danger');
});

test('Music Queue action feedback remains bounded and release-scoped', () => {
  const longMessage = `Could not use the selected match: ${'x'.repeat(300)}`;
  const feedback = createMusicQueueActionFeedback({
    actionKey: 'wanted-1:search-again',
    message: longMessage,
    phase: 'error',
    wantedReleaseId: 'wanted-1',
  });

  assert.equal(feedback.message.length, 280);
  assert.match(feedback.message, /\.\.\.$/);
  assert.equal(buildMusicQueueReleaseActionFeedback(feedback, 'wanted-2'), null);
  assert.equal(createMusicQueueActionFeedback({ message: 'Missing release', phase: 'error' }), null);
  assert.equal(createMusicQueueActionFeedback({ wantedReleaseId: 'wanted-1', message: 'Unknown', phase: 'unknown' }), null);
});
