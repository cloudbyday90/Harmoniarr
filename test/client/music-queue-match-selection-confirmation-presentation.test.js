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
import { buildMusicQueueMatchSelectionConfirmation } from '../../src/client/lib/music-queue-match-selection-confirmation-presentation.js';

test('Music Queue match selection confirmation names the release and bounded next step', () => {
  assert.deepEqual(
    buildMusicQueueMatchSelectionConfirmation({ releaseTitle: 'Child of God' }),
    {
      cancelLabel: 'Keep reviewing',
      confirmLabel: 'Use this match',
      level: 'none',
      message: 'Harmoniarr will save this match for Child of God. It will check the match before it can queue a download.',
      title: 'Use this match for Child of God?',
      tone: 'primary',
    },
  );
});

test('Music Queue match selection confirmation uses a safe release fallback', () => {
  const confirmation = buildMusicQueueMatchSelectionConfirmation({ releaseTitle: '   ' });

  assert.equal(confirmation.title, 'Use this match for this release?');
  assert.equal(
    confirmation.message,
    'Harmoniarr will save this match for this release. It will check the match before it can queue a download.',
  );
});
