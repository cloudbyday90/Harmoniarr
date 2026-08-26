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
import { createMissingMusicDecisionCommandService } from '../../src/server/missing-music/missing-music-decision-command-service.js';
import { createMissingMusicDecisionTargetService } from '../../src/server/missing-music/missing-music-decision-target-service.js';

function createRelease({ appUserId = 'user-1', id = 'wanted-amber' } = {}) {
  return {
    appUserId,
    artistName: 'Autechre',
    discoveryRequest: {
      importReviewSummary: {
        matches: [{
          fileCount: 11,
          formats: ['flac'],
          matchId: 'candidate-amber',
          sourceProvider: 'slskd',
          sourceUsername: 'must-not-leak',
          status: 'pending',
          totalSizeBytes: 350000000,
        }],
      },
    },
    id,
    releaseTitle: 'Amber',
  };
}

function createService({
  release = createRelease(),
  users = [
    { id: 'admin-1', isDisabled: false, username: 'admin' },
    { id: 'user-1', isDisabled: false, username: 'listener' },
    { id: 'user-2', isDisabled: true, username: 'former-listener' },
  ],
} = {}) {
  const listAppUsers = test.mock.fn(async () => users);
  const listWantedReleasesWithMetadata = test.mock.fn(async ({ appUserIds, wantedReleaseId }) => [release]
    .filter((item) => appUserIds.includes(item.appUserId) && item.id === wantedReleaseId));
  const selectImportCandidate = test.mock.fn(async ({ importCandidateId }) => ({
    candidate: {
      id: importCandidateId,
      musicQueueContext: { wantedReleaseId: release.id },
      releaseIdentity: {
        artistName: release.artistName,
        releaseTitle: release.releaseTitle,
      },
    },
  }));
  const recordActivityEventFn = test.mock.fn(async () => {});
  const targetService = createMissingMusicDecisionTargetService({
    listAppUsers,
    listWantedReleasesWithMetadata,
  });
  const service = createMissingMusicDecisionCommandService({
    recordActivityEventFn,
    resolveMissingMusicDecisionTarget: targetService.resolveMissingMusicDecisionTarget,
    selectImportCandidate,
  });

  return {
    listAppUsers,
    listWantedReleasesWithMetadata,
    recordActivityEventFn,
    selectImportCandidate,
    service,
  };
}

test('an administrator can select a match for an active household account without starting a download', async () => {
  const { recordActivityEventFn, selectImportCandidate, service } = createService();

  const result = await service.selectMissingMusicDecisionMatch({
    actorUser: { id: 'admin-1', role: 'admin', username: 'admin' },
    decisionId: 'wanted-amber',
    matchId: 'candidate-amber',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
  });

  assert.deepEqual(result.action, {
    code: 'use_match',
    decisionId: 'wanted-amber',
    downloadStarted: false,
    matchId: 'candidate-amber',
    targetUserId: 'user-1',
  });
  assert.deepEqual(selectImportCandidate.mock.calls[0].arguments[0], {
    actorUserId: 'admin-1',
    eventDetails: {
      missingMusic: {
        targetUserId: 'user-1',
        transferStarted: false,
        wantedReleaseId: 'wanted-amber',
      },
    },
    importCandidateId: 'candidate-amber',
    reason: 'Selected from Missing Music',
    requestMetadata: { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
  });
  assert.deepEqual(recordActivityEventFn.mock.calls[0].arguments[0], {
    actorUserId: 'admin-1',
    entityArtist: 'Autechre',
    entityId: 'wanted-amber',
    entityTitle: 'Amber',
    entityType: 'wanted_release',
    eventType: 'music_queue_match_selected',
    extraPayload: {
      importCandidateId: 'candidate-amber',
      schemaVersion: 1,
      selectionMode: 'manual',
      wantedReleaseId: 'wanted-amber',
    },
  });
});

test('disabled target-account history cannot be selected even by an administrator', async () => {
  const { selectImportCandidate, service } = createService({
    release: createRelease({ appUserId: 'user-2', id: 'wanted-history' }),
  });

  await assert.rejects(
    () => service.selectMissingMusicDecisionMatch({
      actorUser: { id: 'admin-1', role: 'admin', username: 'admin' },
      decisionId: 'wanted-history',
      matchId: 'candidate-amber',
    }),
    (error) => error?.status === 409 && error?.code === 'missing_music_decision_read_only',
  );

  assert.equal(selectImportCandidate.mock.callCount(), 0);
});

test('a requester cannot select another household member’s match or an unknown candidate', async () => {
  const { selectImportCandidate, service } = createService();

  await assert.rejects(
    () => service.selectMissingMusicDecisionMatch({
      actorUser: { id: 'user-2', role: 'requester', username: 'former-listener' },
      decisionId: 'wanted-amber',
      matchId: 'candidate-amber',
    }),
    (error) => error?.status === 404 && error?.code === 'missing_music_decision_not_found',
  );
  await assert.rejects(
    () => service.selectMissingMusicDecisionMatch({
      actorUser: { id: 'admin-1', role: 'admin', username: 'admin' },
      decisionId: 'wanted-amber',
      matchId: 'candidate-outside-release',
    }),
    (error) => error?.status === 404 && error?.code === 'missing_music_match_not_found',
  );

  assert.equal(selectImportCandidate.mock.callCount(), 0);
});

test('Missing Music selection validates bounded candidate identifiers before resolving a target', async () => {
  const { listAppUsers, service } = createService();

  await assert.rejects(
    () => service.selectMissingMusicDecisionMatch({
      actorUser: { id: 'admin-1', role: 'admin', username: 'admin' },
      decisionId: 'wanted-amber',
      matchId: 'x'.repeat(201),
    }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );

  assert.equal(listAppUsers.mock.callCount(), 0);
});
