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
  buildMissingMusicMatchChoices,
  findSelectableMissingMusicMatch,
} from '../../src/server/missing-music/missing-music-match-choice-projection.js';

test('Missing Music match choices contain only decision facts and selectable candidates', () => {
  const release = {
    discoveryRequest: {
      importReviewSummary: {
        matches: [{
          fileCount: 10,
          formats: ['flac', 'FLAC'],
          matchId: 'candidate-1',
          queueLength: 12,
          scoreBreakdown: { private: true },
          sourceProvider: 'slskd',
          sourceUsername: 'private-peer',
          status: 'pending',
          totalSizeBytes: 123456,
          uploadSpeed: 900000,
        }, {
          matchId: 'candidate-selected',
          status: 'selected',
        }],
      },
    },
  };

  assert.deepEqual(buildMissingMusicMatchChoices(release), [{
    fileCount: 10,
    formats: ['FLAC'],
    id: 'candidate-1',
    totalSizeBytes: 123456,
  }]);
  assert.equal(findSelectableMissingMusicMatch(release, 'candidate-1').matchId, 'candidate-1');
  assert.equal(findSelectableMissingMusicMatch(release, 'candidate-selected'), null);
  assert.doesNotMatch(JSON.stringify(buildMissingMusicMatchChoices(release)), /peer|provider|queue|score|upload/i);
});

test('Missing Music bounds and de-duplicates its browser match choices', () => {
  const matches = Array.from({ length: 14 }, (_, index) => ({
    fileCount: null,
    formats: ['flac'],
    matchId: `candidate-${index}`,
    status: 'pending',
    totalSizeBytes: null,
  }));
  matches.splice(1, 0, {
    fileCount: 99,
    formats: ['mp3'],
    matchId: 'candidate-0',
    status: 'held',
    totalSizeBytes: 99,
  });

  const choices = buildMissingMusicMatchChoices({
    discoveryRequest: { importReviewSummary: { matches } },
  });

  assert.equal(choices.length, 12);
  assert.deepEqual(choices[0], {
    fileCount: null,
    formats: ['FLAC'],
    id: 'candidate-0',
    totalSizeBytes: null,
  });
  assert.equal(choices.filter((choice) => choice.id === 'candidate-0').length, 1);
});
