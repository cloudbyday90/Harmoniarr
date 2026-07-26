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
  buildMusicQueueAudioInspectionActivityEvent,
  buildMusicQueueDownloadCompletedActivityEvent,
  buildMusicQueueDownloadStartedActivityEvent,
  buildMusicQueueMatchSelectedActivityEvent,
} from '../../src/server/activity/music-queue-milestone-activity-event-service.js';
import { buildRequestFulfilledActivityEvent } from '../../src/server/activity/request-fulfillment-activity-event-service.js';

function createCandidate(overrides = {}) {
  return {
    folderPath: '/not-for-activity/Amber',
    id: 'candidate-1',
    musicQueueContext: { wantedReleaseId: 'wanted-1' },
    releaseIdentity: {
      artistName: 'Autechre',
      releaseTitle: 'Amber',
    },
    username: 'source-user',
    ...overrides,
  };
}

test('Music Queue milestone events are release scoped and exclude source diagnostics', () => {
  const selected = buildMusicQueueMatchSelectedActivityEvent({
    actorUserId: 'operator-1',
    candidate: createCandidate(),
  });
  const started = buildMusicQueueDownloadStartedActivityEvent({
    candidate: createCandidate(),
    operationRunId: 'run-1',
    queuedFileCount: 12,
    queuedWithWarnings: true,
  });
  const completed = buildMusicQueueDownloadCompletedActivityEvent({
    candidate: createCandidate(),
    operationRunId: 'run-2',
  });

  assert.deepEqual(selected, {
    actorUserId: 'operator-1',
    entityArtist: 'Autechre',
    entityId: 'wanted-1',
    entityTitle: 'Amber',
    entityType: 'wanted_release',
    eventType: 'music_queue_match_selected',
    extraPayload: {
      importCandidateId: 'candidate-1',
      schemaVersion: 1,
      selectionMode: 'automatic',
      wantedReleaseId: 'wanted-1',
    },
  });
  assert.equal(started.eventType, 'music_queue_download_started');
  assert.equal(started.extraPayload.queuedFileCount, 12);
  assert.equal(started.extraPayload.queuedWithWarnings, true);
  assert.equal(completed.eventType, 'download_completed');
  assert.equal(JSON.stringify({ selected, started, completed }).includes('/not-for-activity'), false);
  assert.equal(JSON.stringify({ selected, started, completed }).includes('source-user'), false);
});

test('Music Queue audio milestones distinguish checked, warning, and unavailable states', () => {
  const checked = buildMusicQueueAudioInspectionActivityEvent({ candidate: createCandidate() });
  const warning = buildMusicQueueAudioInspectionActivityEvent({
    candidate: createCandidate(),
    warningCount: 1,
  });
  const failed = buildMusicQueueAudioInspectionActivityEvent({
    candidate: createCandidate(),
    inspectionUnavailableCount: 1,
    warningCount: 1,
  });

  assert.equal(checked.eventType, 'music_queue_audio_checked');
  assert.equal(warning.eventType, 'music_queue_audio_warning');
  assert.equal(failed.eventType, 'music_queue_audio_check_failed');
  assert.equal(failed.extraPayload.inspectionUnavailableCount, 1);
});

test('request fulfillment carries a request-detail handoff only when the request id is known', () => {
  assert.deepEqual(buildRequestFulfilledActivityEvent({
    candidate: createCandidate({
      requestOwnership: {
        sourceMediaRequestId: 'request-1',
        sourceRequestedForUserId: 'requester-1',
      },
    }),
  }), {
    actorUserId: null,
    entityArtist: 'Autechre',
    entityId: 'request-1',
    entityTitle: 'Amber',
    entityType: 'media_request',
    eventType: 'request_fulfilled',
    extraPayload: {
      requestedForUserId: 'requester-1',
      schemaVersion: 1,
      sourceMediaRequestId: 'request-1',
    },
  });
  assert.deepEqual(buildRequestFulfilledActivityEvent({
    candidate: createCandidate({
      requestOwnership: { sourceRequestedForUserId: 'requester-1' },
    }),
  }), {
    actorUserId: null,
    entityArtist: 'Autechre',
    entityId: 'candidate-1',
    entityTitle: 'Amber',
    entityType: 'import_candidate',
    eventType: 'request_fulfilled',
    extraPayload: {
      requestedForUserId: 'requester-1',
      schemaVersion: 1,
    },
  });
});
