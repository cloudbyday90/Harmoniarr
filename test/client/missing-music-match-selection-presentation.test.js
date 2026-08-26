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
  buildMissingMusicMatchChoicePresentation,
  formatMissingMusicMatchSize,
} from '../../src/client/lib/missing-music-match-selection-presentation.js';

test('Missing Music match presentation names each choice and excludes provider-private facts', () => {
  const presentation = buildMissingMusicMatchChoicePresentation({
    decision: { release: { title: 'Amber' } },
    matchChoices: [{
      fileCount: 10,
      formats: ['flac'],
      id: 'candidate-amber',
      sourceUsername: 'must-not-leak',
      totalSizeBytes: 358000000,
    }],
    permissions: { canSelectMatch: true, isReadOnly: false },
  });

  assert.equal(presentation.heading, 'Choose a match');
  assert.equal(presentation.choices[0].accessibleActionLabel, 'Use this match for Amber — match 1');
  assert.deepEqual(presentation.choices[0].facts, [
    { label: 'Files', value: '10 files found' },
    { label: 'Formats', value: 'FLAC' },
    { label: 'Total size', value: '341 MB' },
  ]);
  assert.equal(presentation.canSelect, true);
  assert.doesNotMatch(JSON.stringify(presentation), /must-not-leak|provider|username/i);
  assert.equal(formatMissingMusicMatchSize(null), 'Not reported');
});

test('disabled-account match history is explicitly not presented as an actionable choice', () => {
  const presentation = buildMissingMusicMatchChoicePresentation({
    matchChoices: [{ id: 'candidate-history' }],
    permissions: { canSelectMatch: false, isReadOnly: true },
  });

  assert.equal(presentation.heading, 'Recorded match choices');
  assert.equal(presentation.canSelect, false);
  assert.match(presentation.instructions, /read-only/u);
});
