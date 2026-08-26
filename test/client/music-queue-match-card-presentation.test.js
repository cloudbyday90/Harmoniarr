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
  buildMusicQueueMatchActionLabel,
  buildMusicQueueMatchCardPresentation,
} from '../../src/client/lib/music-queue-match-card-presentation.js';

const MATCH = {
  fileLabel: '12 files',
  formatLabel: 'FLAC',
  healthLabel: 'Free slot - 1.0 MB/s',
  qualityFitLabel: 'Preferred quality',
  qualityFitTone: 'success',
  qualityRows: [
    { label: 'Observed', tone: 'success', value: 'FLAC' },
    { label: 'Audio check', tone: 'warning', value: 'Required before automatic progress' },
  ],
  scoreLabel: '91',
  sizeLabel: '117.7 MB',
  trackCoverageLabel: '12 of 12 tracks matched',
};

test('Music Queue match action labels retain the visible action and identify its match', () => {
  assert.equal(buildMusicQueueMatchActionLabel('use', { label: 'Match 1' }), 'Use this match: Match 1');
  assert.equal(buildMusicQueueMatchActionLabel('reject', { label: 'Match 1' }), 'Reject match: Match 1');
  assert.equal(buildMusicQueueMatchActionLabel('use'), 'Use this match');
});

test('Music Queue decision cards keep only selection facts before the action', () => {
  const presentation = buildMusicQueueMatchCardPresentation(MATCH, { isDecision: true });

  assert.deepEqual(
    presentation.visibleFacts.map((fact) => fact.label),
    ['Quality', 'Format', 'Tracks'],
  );
  assert.deepEqual(
    presentation.detailFacts.map((fact) => fact.label),
    ['Score', 'Files', 'Size', 'Source health'],
  );
  assert.deepEqual(presentation.detailQualityRows, MATCH.qualityRows);
  assert.deepEqual(presentation.qualityRows, []);
  assert.equal(presentation.hasDetails, true);
});

test('Music Queue evidence cards retain complete facts after the outer disclosure opens', () => {
  const presentation = buildMusicQueueMatchCardPresentation(MATCH);

  assert.deepEqual(
    presentation.visibleFacts.map((fact) => fact.label),
    ['Quality', 'Format', 'Tracks', 'Score', 'Files', 'Size', 'Source health'],
  );
  assert.deepEqual(presentation.detailFacts, []);
  assert.deepEqual(presentation.qualityRows, MATCH.qualityRows);
  assert.equal(presentation.hasDetails, false);
});

test('Music Queue decision cards tolerate missing quality evidence', () => {
  const presentation = buildMusicQueueMatchCardPresentation({
    ...MATCH,
    qualityRows: null,
  }, { isDecision: true });

  assert.equal(presentation.hasDetails, true);
  assert.deepEqual(presentation.detailQualityRows, []);
});
