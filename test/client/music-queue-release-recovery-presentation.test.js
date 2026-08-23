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
  buildMusicQueueReleaseRecoveryPresentation,
  MUSIC_QUEUE_RELEASE_RECOVERY_KIND,
} from '../../src/client/lib/music-queue-release-recovery-presentation.js';

test('Music Queue turns a scoped unavailable release into a calm return-to-queue recovery', () => {
  assert.deepEqual(buildMusicQueueReleaseRecoveryPresentation({ isNotFound: true }), {
    announcement: 'Release not available.',
    canRetry: false,
    heading: 'Release not available',
    kind: MUSIC_QUEUE_RELEASE_RECOVERY_KIND.NOT_FOUND,
    message: 'This Music Queue link is unavailable. Return to the queue to continue.',
    role: 'status',
    tone: 'warning',
  });
});

test('Music Queue exposes a retry action without leaking a detail-read error', () => {
  const presentation = buildMusicQueueReleaseRecoveryPresentation({
    errorMessage: 'upstream api at https://provider.example/secret-path failed',
  });

  assert.equal(presentation.kind, MUSIC_QUEUE_RELEASE_RECOVERY_KIND.RETRY);
  assert.equal(presentation.canRetry, true);
  assert.equal(presentation.role, 'alert');
  assert.doesNotMatch(JSON.stringify(presentation), /provider|secret-path|https/u);
});

test('Music Queue does not render recovery content without a terminal detail result', () => {
  assert.equal(buildMusicQueueReleaseRecoveryPresentation(), null);
  assert.equal(buildMusicQueueReleaseRecoveryPresentation({ errorMessage: '   ' }), null);
});
