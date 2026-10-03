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
    permissions: { canStartDownload: true, isReadOnly: false },
  });

  assert.equal(presentation.statusLabel, 'Match selected');
  assert.equal(presentation.statusMessage, 'A match has been selected. A download will not start until someone explicitly starts it.');
  assert.equal(presentation.canStartDownload, true);
  assert.equal(presentation.nextStep, 'Start download');
});

test('Missing Music tells non-administrators when a selected download requires an administrator', () => {
  const presentation = buildMissingMusicDecisionDetailPresentation({
    decision: {
      status: { nextAction: 'download_now' },
    },
    permissions: { canStartDownload: false, isReadOnly: false },
  });

  assert.equal(presentation.canStartDownload, false);
  assert.equal(presentation.nextStep, 'A household administrator can start the download.');
});

test('Missing Music exposes a purpose-specific Downloader link only when the server permits it', () => {
  const presentation = buildMissingMusicDecisionDetailPresentation({
    decision: {
      release: { title: 'Amber' },
      requestedFor: { username: 'Jamie' },
      status: { nextAction: 'open_downloader' },
    },
    permissions: { canViewDownloader: true },
  });

  assert.equal(presentation.canViewDownloader, true);
  assert.equal(presentation.downloaderLinkAccessibleLabel, 'View Amber downloads for Jamie in Downloader');
});

test('Search again is a server-permitted action and disabled account history stays read-only', () => {
  const detail = { decision: { status: { nextAction: 'try_again' } }, permissions: { canSearchAgain: true } };
  assert.equal(buildMissingMusicDecisionDetailPresentation(detail).canSearchAgain, true);
  assert.equal(buildMissingMusicDecisionDetailPresentation(detail).nextStep, 'Search again');
  detail.permissions.canSearchAgain = false;
  assert.equal(buildMissingMusicDecisionDetailPresentation(detail).canSearchAgain, false);
  detail.permissions.canSearchAgain = true;
  detail.decision.requestedFor = { accountStatus: 'disabled' };
  assert.equal(buildMissingMusicDecisionDetailPresentation(detail).canSearchAgain, false);
});

test('an eligible quality choice remains the next step while Search again stays available', () => {
  const detail = {
    decision: { status: { nextAction: 'review_quality_choice' } },
    permissions: { canAllowFallbackQuality: true, canSearchAgain: true },
  };
  const presentation = buildMissingMusicDecisionDetailPresentation(detail);
  assert.equal(presentation.nextStep, 'Review the quality choice');
  assert.equal(presentation.canAllowFallbackQuality, true);
  assert.equal(presentation.canSearchAgain, true);
  detail.permissions.isReadOnly = true;
  assert.equal(buildMissingMusicDecisionDetailPresentation(detail).canAllowFallbackQuality, false);
});
