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
  buildMusicQueueRecoveryActivityEvent,
  buildMusicQueueProviderRecoverySearchStartedActivityEvent,
  buildMusicQueueSearchQueuedActivityEvent,
  recordActivityEventSafely,
} from '../../src/server/activity/music-queue-lifecycle-activity-event-service.js';

const candidate = {
  id: 'candidate-1',
  releaseIdentity: {
    artistName: 'Boards of Canada',
    releaseTitle: 'Music Has the Right to Children',
  },
  requestOwnership: {
    wantedReleaseId: 'wanted-1',
  },
};

test('Music Queue recovery activity describes a safe next-match fallback without source details', () => {
  const event = buildMusicQueueRecoveryActivityEvent({
    candidate,
    operationRunId: 'run-1',
    recovery: {
      nextCandidateId: 'candidate-2',
      reason: 'candidate_promoted',
      recovered: true,
      skippedCandidateCount: 2,
    },
  });

  assert.deepEqual(event, {
    entityArtist: 'Boards of Canada',
    entityId: 'wanted-1',
    entityTitle: 'Music Has the Right to Children',
    entityType: 'wanted_release',
    eventType: 'music_queue_match_retrying',
    extraPayload: {
      schemaVersion: 1,
      wantedReleaseId: 'wanted-1',
      recoveryCode: 'candidate_promoted',
      operationRunId: 'run-1',
      retryAt: null,
      nextSearchAfter: null,
      rediscoveryScheduled: false,
      skippedCandidateCount: 2,
    },
  });
  assert.equal(JSON.stringify(event).includes('candidate-2'), false);
  assert.equal(JSON.stringify(event).includes('source-user'), false);
});

test('Music Queue recovery activity distinguishes retry, rediscovery, and terminal failure', () => {
  const sameCandidateRetry = buildMusicQueueRecoveryActivityEvent({
    candidate,
    recovery: {
      reason: 'candidate_retry_scheduled',
      recovered: true,
      retrySameCandidate: true,
      retryAt: '2026-07-25T22:00:00.000Z',
    },
  });
  const rediscovery = buildMusicQueueRecoveryActivityEvent({
    candidate,
    recovery: {
      reason: 'rediscovery_scheduled',
      recovered: false,
      rediscovery: {
        nextSearchAfter: '2026-07-25T23:00:00.000Z',
        scheduled: true,
      },
    },
  });
  const terminalFailure = buildMusicQueueRecoveryActivityEvent({
    candidate,
    recovery: {
      reason: 'no_recovery_candidate_available',
      recovered: false,
    },
  });

  assert.equal(sameCandidateRetry.eventType, 'music_queue_download_retrying');
  assert.equal(rediscovery.eventType, 'music_queue_no_matches_left');
  assert.equal(rediscovery.extraPayload.rediscoveryScheduled, true);
  assert.equal(terminalFailure.eventType, 'music_queue_download_failed');
});

test('Music Queue search activity is release-scoped and records only safe scheduling evidence', () => {
  const event = buildMusicQueueSearchQueuedActivityEvent({
    actorUserId: 'user-1',
    discoveryRunId: 'run-2',
    rediscovery: { nextSearchAfter: '2026-07-25T22:00:00.000Z' },
    release: {
      artistName: 'Boards of Canada',
      releaseTitle: 'Geogaddi',
    },
    wantedReleaseId: 'wanted-2',
  });

  assert.equal(event.eventType, 'music_queue_search_queued');
  assert.equal(event.entityId, 'wanted-2');
  assert.equal(event.entityType, 'wanted_release');
  assert.deepEqual(Object.keys(event.extraPayload).sort(), [
    'discoveryRunId',
    'dispatchAlreadyActive',
    'nextSearchAfter',
    'schemaVersion',
    'wantedReleaseId',
  ]);
});

test('Music Queue provider recovery search activity is release-scoped and excludes provider diagnostics', () => {
  const event = buildMusicQueueProviderRecoverySearchStartedActivityEvent({
    claimedRequest: {
      artistName: 'Boards of Canada',
      evidence: {
        providerRecoveryPending: {
          pauseCode: 'slskd_unavailable',
          provider: 'slskd',
        },
      },
      releaseTitle: 'Geogaddi',
      wantedReleaseId: 'wanted-2',
    },
  });

  assert.deepEqual(event, {
    entityArtist: 'Boards of Canada',
    entityId: 'wanted-2',
    entityTitle: 'Geogaddi',
    entityType: 'wanted_release',
    eventType: 'music_queue_search_started',
    extraPayload: {
      schemaVersion: 1,
      wantedReleaseId: 'wanted-2',
    },
  });
  assert.equal(JSON.stringify(event).includes('slskd_unavailable'), false);
  assert.equal(JSON.stringify(event).includes('providerRecoveryPending'), false);
});

test('recordActivityEventSafely absorbs a synchronous diagnostic writer failure', () => {
  assert.doesNotThrow(() => recordActivityEventSafely(
    () => { throw new Error('activity store unavailable'); },
    { eventType: 'music_queue_download_failed' },
  ));
});
