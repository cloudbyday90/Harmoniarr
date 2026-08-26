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
  buildMissingMusicDecisionDetailPresentation,
  formatMissingMusicDecisionCheckedAt,
} from '../../src/client/lib/missing-music-decision-detail-presentation.js';

test('Missing Music decision detail presents target, coverage, and the next clear step', () => {
  const presentation = buildMissingMusicDecisionDetailPresentation({
    checkedAt: '2026-08-26T16:30:00.000Z',
    decision: {
      expectedTrackCount: 10,
      lastReconciledAt: '2026-08-26T16:00:00.000Z',
      matchedTrackCount: 2,
      release: {
        artistName: 'Autechre',
        releaseDate: '1994-11-07',
        releaseGroupType: 'Album',
        title: 'Amber',
      },
      requestedFor: {
        accountStatus: 'active',
        username: 'Jamie',
      },
      status: {
        label: 'Choose a match',
        message: 'Harmoniarr found matches that need a selection.',
        nextAction: 'review_matches',
        tone: 'warning',
      },
    },
    permissions: { isReadOnly: false },
  });

  assert.equal(presentation.title, 'Amber');
  assert.equal(presentation.artistName, 'Autechre');
  assert.equal(presentation.releaseMeta, 'Album · 1994-11-07');
  assert.equal(presentation.username, 'Jamie');
  assert.equal(presentation.coverage, '2 of 10 tracks in library');
  assert.equal(presentation.nextStep, 'Review matches');
  assert.equal(presentation.isReadOnly, false);
});

test('Missing Music decision detail makes disabled account history explicitly read-only', () => {
  const presentation = buildMissingMusicDecisionDetailPresentation({
    decision: {
      requestedFor: {
        accountStatus: 'disabled',
        username: 'Former listener',
      },
      status: {
        nextAction: 'review_matches',
      },
    },
    permissions: { isReadOnly: true },
  });

  assert.equal(presentation.isReadOnly, true);
  assert.equal(presentation.nextStep, 'This account is disabled; no changes can be made.');
  assert.equal(presentation.accountNote, 'This account is disabled. Its history is read-only.');
  assert.equal(formatMissingMusicDecisionCheckedAt(null), 'Not recorded');
});

test('Missing Music describes a selected match as awaiting an explicit download start', () => {
  const presentation = buildMissingMusicDecisionDetailPresentation({
    decision: {
      status: {
        label: 'Match selected',
        message: 'A match has been selected. A download will not start until someone explicitly starts it.',
        nextAction: 'download_now',
        tone: 'warning',
      },
    },
    permissions: { isReadOnly: false },
  });

  assert.equal(presentation.statusLabel, 'Match selected');
  assert.equal(presentation.statusMessage, 'A match has been selected. A download will not start until someone explicitly starts it.');
  assert.equal(presentation.nextStep, 'Start download');
});
