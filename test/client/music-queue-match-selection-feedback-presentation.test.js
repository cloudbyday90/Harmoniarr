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
import { buildMusicQueueMatchSelectionSuccessMessage } from '../../src/client/lib/music-queue-match-selection-feedback-presentation.js';

test('Music Queue match selection feedback uses the authoritative automatic handoff state', () => {
  assert.equal(
    buildMusicQueueMatchSelectionSuccessMessage({
      release: { status: { code: 'checking_matches' } },
    }),
    'Match selected. Harmoniarr will automatically queue the selected match for download when its checks finish.',
  );
  assert.equal(
    buildMusicQueueMatchSelectionSuccessMessage({
      release: { statusCode: 'downloading' },
    }),
    'Match selected. Harmoniarr will automatically check the files, then add them to the library.',
  );
});

test('Music Queue match selection feedback avoids claiming a download when no handoff state is returned', () => {
  assert.equal(
    buildMusicQueueMatchSelectionSuccessMessage({ ok: true }),
    'Match selected. Harmoniarr will update this release as it prepares the next step.',
  );
});
