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
  assertArtistDetailPresentationEvidenceContract,
  createArtistDetailPresentationEvidence,
} from '../../scripts/artist-detail-local-presentation-evidence.js';

test('Artist Detail presentation evidence keeps only a fixed state and rounded relative observation time', () => {
  const evidence = createArtistDetailPresentationEvidence({
    observedAtMs: 42.6,
    state: 'ready',
  });

  assert.deepEqual(evidence, {
    observedAtMs: 43,
    state: 'ready',
  });
  assert.equal(JSON.stringify(evidence).includes('http'), false);
  assert.equal(JSON.stringify(evidence).includes('artist'), false);
});

test('Artist Detail presentation evidence rejects unbounded states and DOM data', () => {
  assert.throws(() => createArtistDetailPresentationEvidence({
    observedAtMs: 1,
    state: 'loading message',
  }), /presentation state is invalid/u);
  assert.throws(() => createArtistDetailPresentationEvidence({
    observedAtMs: -1,
    state: 'ready',
  }), /bounded non-negative duration/u);
  assert.throws(() => assertArtistDetailPresentationEvidenceContract({
    observedAtMs: 1,
    state: 'ready',
    text: 'Artist Detail content',
  }), /text is not allowed/u);
});
