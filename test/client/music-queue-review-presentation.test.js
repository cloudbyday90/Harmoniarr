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
import { buildMusicQueueReviewPresentation } from '../../src/client/lib/music-queue-review-presentation.js';

const BASE_REVIEW = {
  action: { type: 'review' },
  matchRows: [{ label: 'Matches found', value: '2' }],
  qualityRows: [
    { label: 'Profile', value: 'Lossless archive' },
    { label: 'Decision', value: 'Needs verification' },
    { label: 'Preferred', value: 'FLAC' },
    { label: 'Verification', value: 'Required' },
  ],
};

test('Music Queue review presents actionable matches before optional evidence', () => {
  const presentation = buildMusicQueueReviewPresentation({
    ...BASE_REVIEW,
    matchCards: [{ canRejectMatch: true, canUseMatch: true, id: 'match-1' }],
  });

  assert.equal(presentation.hasDecision, true);
  assert.equal(presentation.hasMatchChoices, true);
  assert.equal(presentation.evidenceMatchCards.length, 0);
  assert.deepEqual(presentation.decisionMatchCards.map((match) => match.id), ['match-1']);
  assert.deepEqual(presentation.primaryQualityRows.map((row) => row.label), [
    'Profile',
    'Decision',
    'Verification',
  ]);
});

test('Music Queue review keeps non-actionable match evidence behind the disclosure', () => {
  const presentation = buildMusicQueueReviewPresentation({
    ...BASE_REVIEW,
    canSearchAgain: true,
    matchCards: [{ canRejectMatch: false, canUseMatch: false, id: 'match-1' }],
  });

  assert.equal(presentation.hasMatchChoices, false);
  assert.equal(presentation.hasQualityChoice, true);
  assert.deepEqual(presentation.evidenceMatchCards.map((match) => match.id), ['match-1']);
  assert.match(presentation.decisionCopy, /keep looking/i);
});

test('Music Queue review keeps an automatic release calm while retaining evidence', () => {
  const presentation = buildMusicQueueReviewPresentation({
    ...BASE_REVIEW,
    matchCards: [],
  });

  assert.equal(presentation.hasDecision, false);
  assert.equal(presentation.hasEvidence, true);
  assert.match(presentation.decisionCopy, /continue automatically/i);
});

test('Music Queue review explains automatic recovery without adding a decision', () => {
  const presentation = buildMusicQueueReviewPresentation({
    ...BASE_REVIEW,
    matchCards: [],
    recovery: {
      kind: 'automatic',
      nextStep: 'No action is needed. Harmoniarr will continue this release automatically.',
    },
  });

  assert.equal(presentation.hasDecision, false);
  assert.match(presentation.decisionCopy, /No action is needed/i);
});
