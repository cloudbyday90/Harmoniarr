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
import { buildMissingMusicReleaseTransitionPresentation } from '../../src/client/lib/missing-music-release-transition-presentation.js';

test('Missing Music release transition presentation describes only authoritative automatic work', () => {
  assert.deepEqual(
    buildMissingMusicReleaseTransitionPresentation({ status: { code: 'searching' } }),
    {
      label: 'Up next',
      message: 'Harmoniarr will automatically check the best results against the selected quality settings.',
    },
  );
  assert.deepEqual(
    buildMissingMusicReleaseTransitionPresentation({ statusCode: 'downloading' }),
    {
      label: 'Up next',
      message: 'Harmoniarr will automatically check the files, then add them to the library.',
    },
  );
});

test('Missing Music release transition presentation does not infer an unknown next action', () => {
  assert.equal(buildMissingMusicReleaseTransitionPresentation({ statusCode: 'needs_review' }), null);
  assert.equal(buildMissingMusicReleaseTransitionPresentation(), null);
});
