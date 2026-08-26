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
  buildMissingMusicDecisionRow,
  buildMissingMusicStatusAnnouncement,
  createMissingMusicDecisionFilters,
  getMissingMusicNextStep,
  splitMissingMusicUsers,
} from '../../src/client/lib/missing-music-worklist-presentation.js';

test('Missing Music filters default to active releases that have a clear action', () => {
  assert.deepEqual(createMissingMusicDecisionFilters({
    offset: 50,
    q: '  Nine Inch Nails  ',
    requestedForUserId: '  user-1  ',
  }), {
    accountStatus: 'active',
    limit: 50,
    offset: 0,
    q: 'Nine Inch Nails',
    requestedForUserId: 'user-1',
    scope: 'all',
    state: 'action',
  });
});

test('Missing Music worklist rows name the target user and next action without provider data', () => {
  const row = buildMissingMusicDecisionRow({
    decisionId: 'wanted-amber',
    expectedTrackCount: 11,
    matchedTrackCount: 3,
    release: {
      artistName: 'Autechre',
      releaseDate: '1994-11-07',
      releaseGroupType: 'album',
      title: 'Amber',
    },
    requestedFor: { accountStatus: 'active', id: 'user-1', username: 'Jamie' },
    status: {
      code: 'pick_match',
      label: 'Choose a match',
      message: 'Several matches need a deliberate choice.',
      nextAction: 'review_matches',
      tone: 'warning',
      providerUsername: 'must-not-be-projected',
    },
  });

  assert.deepEqual(row, {
    accountStatus: 'active',
    artistName: 'Autechre',
    coverage: '3 of 11 tracks in library',
    decisionId: 'wanted-amber',
    isReadOnly: false,
    nextStep: 'Review matches',
    releaseMeta: 'album · 1994-11-07',
    statusLabel: 'Choose a match',
    statusMessage: 'Several matches need a deliberate choice.',
    statusTone: 'warning',
    targetUserLabel: 'Jamie',
    title: 'Amber',
  });
  assert.equal('providerUsername' in row, false);
});

test('disabled account rows retain history but state that it is read-only', () => {
  const row = buildMissingMusicDecisionRow({
    release: { artistName: 'Autechre', title: 'Incunabula' },
    requestedFor: { accountStatus: 'disabled', username: 'Alex' },
    status: { nextAction: 'review_matches' },
  });

  assert.equal(row.isReadOnly, true);
  assert.equal(row.nextStep, 'This account is disabled; its history is read-only.');
});

test('Missing Music status announcement makes the current scope visible', () => {
  assert.equal(
    buildMissingMusicStatusAnnouncement({
      decisions: [{}, {}],
      filters: { accountStatus: 'active' },
      page: { total: 5 },
      scope: 'all',
    }),
    'Showing 2 of 5 releases for all active accounts.',
  );
  assert.equal(
    buildMissingMusicStatusAnnouncement({
      decisions: [],
      filters: { requestedForUserId: 'user-2' },
      page: { total: 0 },
      scope: 'all',
    }),
    'No releases are shown for the selected user.',
  );
});

test('Missing Music separates active accounts from retained disabled history', () => {
  assert.deepEqual(splitMissingMusicUsers([
    { accountStatus: 'disabled', id: 'alex', username: 'Alex' },
    { accountStatus: 'active', id: 'jamie', username: 'Jamie' },
  ]), {
    active: [{ accountStatus: 'active', id: 'jamie', username: 'Jamie' }],
    disabled: [{ accountStatus: 'disabled', id: 'alex', username: 'Alex' }],
  });
  assert.equal(getMissingMusicNextStep('open_downloader'), 'View in Downloader');
  assert.equal(getMissingMusicNextStep('download_now'), 'Start download');
});
