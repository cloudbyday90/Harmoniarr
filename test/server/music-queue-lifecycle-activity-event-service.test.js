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
import { buildMusicQueueAddBlockedActivityEvent } from '../../src/server/activity/music-queue-add-blocked-activity-event-service.js';

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
      rediscoveryExhausted: false,
      rediscoveryScheduled: false,
      skippedCandidateCount: 2,
    },
  });
  assert.equal(JSON.stringify(event).includes('candidate-2'), false);
  assert.equal(JSON.stringify(event).includes('source-user'), false);
});

test('Music Queue recovery activity distinguishes retry, scheduled rediscovery, exhausted rediscovery, and terminal failure', () => {
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
  const exhaustedRediscovery = buildMusicQueueRecoveryActivityEvent({
    candidate,
    recovery: {
      reason: 'no_recovery_candidate_available',
      recovered: false,
      rediscovery: {
        exhausted: true,
        researchAttemptCount: 2,
        scheduled: false,
      },
    },
  });

  assert.equal(sameCandidateRetry.eventType, 'music_queue_download_retrying');
  assert.equal(rediscovery.eventType, 'music_queue_no_matches_left');
  assert.equal(rediscovery.extraPayload.rediscoveryScheduled, true);
  assert.equal(exhaustedRediscovery.eventType, 'music_queue_no_matches_left');
  assert.equal(exhaustedRediscovery.extraPayload.rediscoveryExhausted, true);
  assert.equal(exhaustedRediscovery.extraPayload.rediscoveryScheduled, false);
  assert.equal(terminalFailure.eventType, 'music_queue_download_failed');
});

test('Music Queue shared recovery fans out redacted retry events per wanted release', () => {
  const recordedEvents = [];
  const sharedCandidate = {
    ...candidate,
    normalizedPayload: {
      musicQueue: {
        profileCode: 'lossless_archive',
        wantedReleaseId: 'wanted-1',
        wantedReleaseIds: ['wanted-1', 'wanted-2'],
      },
    },
  };
  const event = buildMusicQueueRecoveryActivityEvent({
    candidate: sharedCandidate,
    operationRunId: 'run-retry-1',
    recovery: {
      nextCandidateId: 'candidate-2',
      reason: 'candidate_promoted',
      recovered: true,
    },
  });

  recordActivityEventSafely((recordedEvent) => {
    recordedEvents.push(recordedEvent);
  }, event);

  assert.deepEqual(recordedEvents, [
    {
      entityArtist: 'Boards of Canada',
      entityId: 'wanted-1',
      entityTitle: 'Music Has the Right to Children',
      entityType: 'wanted_release',
      eventType: 'music_queue_match_retrying',
      extraPayload: {
        schemaVersion: 1,
        wantedReleaseId: 'wanted-1',
        recoveryCode: 'candidate_promoted',
        operationRunId: 'run-retry-1',
        retryAt: null,
        nextSearchAfter: null,
        rediscoveryExhausted: false,
        rediscoveryScheduled: false,
        skippedCandidateCount: null,
      },
    },
    {
      entityArtist: 'Boards of Canada',
      entityId: 'wanted-2',
      entityTitle: 'Music Has the Right to Children',
      entityType: 'wanted_release',
      eventType: 'music_queue_match_retrying',
      extraPayload: {
        schemaVersion: 1,
        wantedReleaseId: 'wanted-2',
        recoveryCode: 'candidate_promoted',
        operationRunId: 'run-retry-1',
        retryAt: null,
        nextSearchAfter: null,
        rediscoveryExhausted: false,
        rediscoveryScheduled: false,
        skippedCandidateCount: null,
      },
    },
  ]);
  assert.equal(JSON.stringify(recordedEvents).includes('wantedReleaseIds'), false);
  assert.equal(JSON.stringify(recordedEvents[0]).includes('wanted-2'), false);
  assert.equal(JSON.stringify(recordedEvents[1]).includes('wanted-1'), false);
});

test('Music Queue recovery activity records a safe library-add stop without provider diagnostics', () => {
  const event = buildMusicQueueRecoveryActivityEvent({
    candidate,
    recovery: {
      reason: 'import_blocker_requires_operator',
      recovered: false,
      requiresOperator: true,
      terminalOutcome: 'import_blocked',
    },
  });

  assert.equal(event.eventType, 'music_queue_import_blocked');
  assert.equal(event.extraPayload.terminalOutcome, 'import_blocked');
  assert.equal(JSON.stringify(event).includes('source-user'), false);
  assert.equal(JSON.stringify(event).includes('/data/downloads'), false);
});

test('Music Queue add-blocked activity records only the release-scoped blocker category', () => {
  const event = buildMusicQueueAddBlockedActivityEvent({
    blockerCode: 'source_path_unavailable',
    runId: 'apply-run-1',
    summaryCandidate: {
      id: 'candidate-1',
      musicQueueContext: { wantedReleaseId: 'wanted-1' },
      releaseIdentity: candidate.releaseIdentity,
      sourcePath: '/data/downloads/Boards of Canada/Geogaddi',
    },
  });

  assert.deepEqual(event, {
    actorUserId: null,
    entityArtist: 'Boards of Canada',
    entityId: 'wanted-1',
    entityTitle: 'Music Has the Right to Children',
    entityType: 'wanted_release',
    eventType: 'music_queue_import_blocked',
    extraPayload: {
      addBlockerCode: 'source_path_unavailable',
      importCandidateId: 'candidate-1',
      runId: 'apply-run-1',
      schemaVersion: 1,
      wantedReleaseId: 'wanted-1',
    },
  });
  assert.equal(JSON.stringify(event).includes('/data/downloads'), false);
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
  assert.equal(Object.hasOwn(event, 'actorUserId'), false);
  assert.equal(JSON.stringify(event).includes('user-1'), false);
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

test('recordActivityEventSafely fans one shared lifecycle result into release-scoped Activity rows', () => {
  const recordedEvents = [];
  recordActivityEventSafely((event) => {
    recordedEvents.push(event);
  }, {
    entityId: 'wanted-1',
    entityType: 'wanted_release',
    eventType: 'music_queue_download_started',
    extraPayload: {
      wantedReleaseId: 'wanted-1',
      wantedReleaseIds: ['wanted-1', 'wanted-2'],
    },
  });

  assert.deepEqual(recordedEvents, [{
    entityId: 'wanted-1',
    entityType: 'wanted_release',
    eventType: 'music_queue_download_started',
    extraPayload: {
      wantedReleaseId: 'wanted-1',
    },
  }, {
    entityId: 'wanted-2',
    entityType: 'wanted_release',
    eventType: 'music_queue_download_started',
    extraPayload: {
      wantedReleaseId: 'wanted-2',
    },
  }]);
});
