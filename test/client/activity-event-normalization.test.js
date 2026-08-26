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
  getActivityEventDetail,
  getActivityEventIcon,
  getActivityEventLabel,
  normalizeActivityEvent,
} from '../../src/client/lib/activity-event-normalization.js';

function makeReleaseAddedEvent(overrides = {}) {
  return {
    id: 'evt-1',
    eventType: 'release_added',
    actorUserId: null,
    entityType: 'release',
    entityId: null,
    entityTitle: 'OK Computer',
    entityArtist: 'Radiohead',
    extraPayload: {
      schemaVersion: 1,
      presentationType: 'release_added',
      primaryRelease: { artistName: 'Radiohead', releaseTitle: 'OK Computer' },
      releaseCount: 1,
      releases: [{ artistName: 'Radiohead', releaseTitle: 'OK Computer' }],
      movedCount: 12,
      source: {
        operationType: 'library_organize_apply',
        runId: 'run-1',
      },
    },
    occurredAt: '2026-06-01T11:00:00.000Z',
    ...overrides,
  };
}

test('normalizeActivityEvent returns empty object for null/undefined', () => {
  assert.deepEqual(normalizeActivityEvent(null), {});
  assert.deepEqual(normalizeActivityEvent(undefined), {});
});

test('normalizeActivityEvent preserves all raw fields', () => {
  const event = {
    id: 'evt-2',
    eventType: 'artist_monitored',
    actorUserId: 'user-1',
    entityType: 'artist',
    entityId: 'artist-1',
    entityTitle: 'Aphex Twin',
    entityArtist: null,
    extraPayload: { some: 'data' },
    occurredAt: '2026-06-01T12:00:00.000Z',
  };

  const normalized = normalizeActivityEvent(event);

  assert.equal(normalized.id, 'evt-2');
  assert.equal(normalized.eventType, 'artist_monitored');
  assert.equal(normalized.actorUserId, 'user-1');
  assert.equal(normalized.entityType, 'artist');
  assert.equal(normalized.entityId, 'artist-1');
  assert.equal(normalized.entityTitle, 'Aphex Twin');
  assert.equal(normalized.entityArtist, null);
  assert.deepEqual(normalized.extraPayload, { some: 'data' });
  assert.equal(normalized.occurredAt, '2026-06-01T12:00:00.000Z');
});

test('normalizeActivityEvent attaches releasePresentation for release_added events', () => {
  const event = makeReleaseAddedEvent();

  const normalized = normalizeActivityEvent(event);

  assert.ok(normalized.releasePresentation);
  assert.equal(normalized.releasePresentation.schemaVersion, 1);
  assert.equal(normalized.releasePresentation.presentationType, 'release_added');
  assert.equal(normalized.releasePresentation.releaseCount, 1);
  assert.equal(normalized.releasePresentation.primaryRelease.artistName, 'Radiohead');
  assert.equal(normalized.releasePresentation.primaryRelease.releaseTitle, 'OK Computer');
  assert.equal(normalized.releasePresentation.source.operationType, 'library_organize_apply');
  assert.equal(normalized.releasePresentation.source.runId, 'run-1');
});

test('normalizeActivityEvent sets releasePresentation to null for non-release events', () => {
  const event = { id: 'evt-3', eventType: 'artist_monitored', entityTitle: 'Aphex Twin' };

  const normalized = normalizeActivityEvent(event);

  assert.equal(normalized.releasePresentation, null);
});

test('normalizeActivityEvent normalizes legacy release_added events without extraPayload', () => {
  const event = {
    id: 'evt-legacy',
    eventType: 'release_added',
    entityTitle: 'Kid A',
    entityArtist: 'Radiohead',
    extraPayload: null,
  };

  const normalized = normalizeActivityEvent(event);

  assert.ok(normalized.releasePresentation);
  assert.equal(normalized.releasePresentation.schemaVersion, 1);
  assert.equal(normalized.releasePresentation.presentationType, 'release_added');
  assert.equal(normalized.releasePresentation.primaryRelease.artistName, 'Radiohead');
  assert.equal(normalized.releasePresentation.primaryRelease.releaseTitle, 'Kid A');
  assert.equal(normalized.releasePresentation.source, null);
});

test('normalizeActivityEvent normalizes multi-release events from shared presentation', () => {
  const event = makeReleaseAddedEvent({
    entityTitle: '2 releases',
    entityArtist: null,
    extraPayload: {
      schemaVersion: 1,
      presentationType: 'release_added',
      primaryRelease: null,
      releaseCount: 2,
      releases: [
        { artistName: 'Radiohead', releaseTitle: 'OK Computer' },
        { artistName: 'Radiohead', releaseTitle: 'Kid A' },
      ],
      movedCount: 24,
      source: { operationType: 'library_organize_apply', runId: 'run-multi-1' },
    },
  });

  const normalized = normalizeActivityEvent(event);

  assert.equal(normalized.releasePresentation.releaseCount, 2);
  assert.equal(normalized.releasePresentation.releases.length, 2);
  assert.equal(normalized.releasePresentation.source.operationType, 'library_organize_apply');
});

test('getActivityEventLabel formats release_added with presentation subject', () => {
  const event = normalizeActivityEvent(makeReleaseAddedEvent());

  assert.equal(getActivityEventLabel(event), 'OK Computer by Radiohead added to library');
});

test('getActivityEventLabel formats multi-release added', () => {
  const event = normalizeActivityEvent(makeReleaseAddedEvent({
    entityTitle: '2 releases',
    entityArtist: null,
    extraPayload: {
      schemaVersion: 1,
      presentationType: 'release_added',
      primaryRelease: null,
      releaseCount: 2,
      releases: [
        { artistName: 'Radiohead', releaseTitle: 'OK Computer' },
        { artistName: 'Radiohead', releaseTitle: 'Kid A' },
      ],
      movedCount: 24,
      source: null,
    },
  }));

  assert.equal(getActivityEventLabel(event), '2 releases added to library');
});

test('getActivityEventLabel formats request_created with artist', () => {
  const event = { eventType: 'request_created', entityTitle: 'Amber', entityArtist: 'Autechre' };

  assert.equal(getActivityEventLabel(event), 'Music requested: Amber by Autechre');
});

test('getActivityEventLabel formats artist_monitored', () => {
  const event = { eventType: 'artist_monitored', entityTitle: 'Boards of Canada' };

  assert.equal(getActivityEventLabel(event), 'Now monitoring Boards of Canada');
});

test('getActivityEventLabel and detail format artist_policy_saved', () => {
  const event = {
    eventType: 'artist_policy_saved',
    entityTitle: 'Boards of Canada',
    extraPayload: {
      changes: {
        monitoring: { changedFieldCount: 1 },
        releaseGroups: { added: 1, changed: 1, removed: 0 },
        trackOverrides: {
          added: 0,
          changed: 1,
          clearedReviewCount: 1,
          removed: 1,
          resolvedReviewCount: 2,
        },
      },
      reconciliation: {
        queuedBehindRun: false,
        runId: 'run-1',
      },
    },
  };

  assert.equal(getActivityEventLabel(event), 'Artist policy saved for Boards of Canada');
  assert.equal(
    getActivityEventDetail(event),
    '1 monitoring field; 2 release selections; 2 track overrides; 2 track reviews repaired; 1 stale track review cleared; reconciliation queued',
  );
});

test('getActivityEventLabel formats request_fulfilled for the requester', () => {
  const event = {
    eventType: 'request_fulfilled',
    entityTitle: 'Amber',
    entityArtist: 'Autechre',
    actorUserId: 'user-1',
  };

  assert.equal(getActivityEventLabel(event, 'user-1'), 'Your request for Amber by Autechre is ready');
});

test('getActivityEventLabel formats request_fulfilled for other users', () => {
  const event = {
    eventType: 'request_fulfilled',
    entityTitle: 'Amber',
    entityArtist: 'Autechre',
    actorUserId: 'user-1',
  };

  assert.equal(getActivityEventLabel(event, 'user-2'), 'Amber by Autechre added to library');
});

test('getActivityEventLabel formats download_completed', () => {
  const event = {
    eventType: 'download_completed',
    entityTitle: 'Amber',
    entityArtist: 'Autechre',
  };

  assert.equal(getActivityEventLabel(event), 'Download completed: Amber by Autechre');
});

test('getActivityEventLabel and detail present Music Queue milestones without source diagnostics', () => {
  const started = {
    eventType: 'music_queue_download_started',
    entityArtist: 'Autechre',
    entityTitle: 'Amber',
    extraPayload: { queuedFileCount: 12 },
  };
  const audioFailure = {
    eventType: 'music_queue_audio_check_failed',
    entityArtist: 'Autechre',
    entityTitle: 'Amber',
  };

  assert.equal(getActivityEventLabel(started), 'Download started: Amber by Autechre');
  assert.equal(getActivityEventDetail(started), '12 files accepted for download.');
  assert.equal(getActivityEventLabel(audioFailure), 'Audio check could not run: Amber by Autechre');
  assert.equal(
    getActivityEventDetail(audioFailure),
    'Harmoniarr could not inspect the downloaded audio. Check the media tooling connection.',
  );
});

test('getActivityEventLabel identifies request fulfillment from its payload owner', () => {
  const event = {
    eventType: 'request_fulfilled',
    entityTitle: 'Amber',
    entityArtist: 'Autechre',
    actorUserId: null,
    extraPayload: { requestedForUserId: 'requester-1' },
  };

  assert.equal(getActivityEventLabel(event, 'requester-1'), 'Your request for Amber by Autechre is ready');
});

test('getActivityEventLabel and detail format music_queue_quality_blocked', () => {
  const event = {
    eventType: 'music_queue_quality_blocked',
    entityTitle: 'Amber',
    entityArtist: 'Autechre',
    extraPayload: {
      blockers: [{
        message: 'Spectral analysis does not verify this lossless file.',
      }],
      message: '1 file did not pass verified lossless checks before automatic add.',
    },
  };

  assert.equal(getActivityEventLabel(event), 'Quality choice needed: Amber by Autechre');
  assert.equal(getActivityEventDetail(event), 'Spectral analysis does not verify this lossless file.');
});

test('getActivityEventLabel and detail format quality_fallback_allowed', () => {
  const event = {
    eventType: 'quality_fallback_allowed',
    entityTitle: 'Amber',
    entityArtist: 'Autechre',
  };

  assert.equal(getActivityEventLabel(event), 'Quality fallback allowed: Amber by Autechre');
  assert.equal(
    getActivityEventDetail(event),
    'Harmoniarr will continue searching with the updated quality choice.',
  );
});

test('getActivityEventLabel and detail make Music Queue recovery understandable without raw diagnostics', () => {
  const retrying = {
    eventType: 'music_queue_match_retrying',
    entityTitle: 'Music Has the Right to Children',
    entityArtist: 'Boards of Canada',
  };
  const exhausted = {
    eventType: 'music_queue_no_matches_left',
    entityTitle: 'Geogaddi',
    entityArtist: 'Boards of Canada',
    extraPayload: { rediscoveryScheduled: true },
  };
  const boundedStop = {
    eventType: 'music_queue_no_matches_left',
    entityTitle: 'Geogaddi',
    entityArtist: 'Boards of Canada',
    extraPayload: { rediscoveryExhausted: true, rediscoveryScheduled: false },
  };

  assert.equal(
    getActivityEventLabel(retrying),
    'Trying the next best match: Music Has the Right to Children by Boards of Canada',
  );
  assert.equal(
    getActivityEventDetail(retrying),
    'A download failed. Harmoniarr is trying the next best match.',
  );
  assert.equal(
    getActivityEventLabel(exhausted),
    'No good matches left: Geogaddi by Boards of Canada',
  );
  assert.equal(getActivityEventDetail(exhausted), 'Harmoniarr will search again later.');
  assert.equal(
    getActivityEventDetail(boundedStop),
    'Harmoniarr stopped automatic recovery. Open Missing Music to search again.',
  );
});

test('getActivityEventLabel and detail make blocked library adds actionable without provider diagnostics', () => {
  const event = {
    entityArtist: 'Autechre',
    entityTitle: 'Amber',
    eventType: 'music_queue_import_blocked',
  };

  assert.equal(getActivityEventLabel(event), 'Library add needs help: Amber by Autechre');
  assert.equal(
    getActivityEventDetail(event),
    'Harmoniarr stopped before changing your library because the completed download needs a safe add review.',
  );
  assert.equal(getActivityEventIcon(event.eventType), 'alert');
});

test('getActivityEventDetail gives a path blocker a safe, specific next step', () => {
  const event = {
    entityArtist: 'Autechre',
    entityTitle: 'Amber',
    eventType: 'music_queue_import_blocked',
    extraPayload: {
      addBlockerCode: 'source_path_unavailable',
      sourcePath: '/data/downloads/Autechre/Amber',
    },
  };

  assert.equal(
    getActivityEventDetail(event),
    'Harmoniarr cannot reach the completed download from its configured folders.',
  );
  assert.equal(getActivityEventDetail(event).includes('/data/downloads'), false);
});

test('getActivityEventLabel and detail describe a recovered provider search without diagnostics', () => {
  const event = {
    eventType: 'music_queue_search_started',
    entityArtist: 'Boards of Canada',
    entityTitle: 'Geogaddi',
    extraPayload: { wantedReleaseId: 'wanted-1' },
  };

  assert.equal(getActivityEventLabel(event), 'Searching again: Geogaddi by Boards of Canada');
  assert.equal(
    getActivityEventDetail(event),
    'Soulseek is available again. Harmoniarr started checking for a safe match.',
  );
  assert.equal(getActivityEventIcon(event.eventType), 'search');
});

test('getActivityEventDetail returns detail for multi-release release_added', () => {
  const event = normalizeActivityEvent(makeReleaseAddedEvent({
    entityTitle: '2 releases',
    entityArtist: null,
    extraPayload: {
      schemaVersion: 1,
      presentationType: 'release_added',
      primaryRelease: null,
      releaseCount: 3,
      releases: [
        { artistName: 'Radiohead', releaseTitle: 'OK Computer' },
        { artistName: 'Radiohead', releaseTitle: 'Kid A' },
      ],
      movedCount: 30,
      source: null,
    },
  }));

  const detail = getActivityEventDetail(event);
  assert.ok(detail.includes('OK Computer by Radiohead'));
  assert.ok(detail.includes('Kid A by Radiohead'));
  assert.ok(detail.includes('1 more'));
});

test('getActivityEventDetail returns empty for single-release events', () => {
  const event = normalizeActivityEvent(makeReleaseAddedEvent());

  assert.equal(getActivityEventDetail(event), '');
});

test('getActivityEventDetail returns empty for non-release events', () => {
  assert.equal(getActivityEventDetail({ eventType: 'artist_monitored' }), '');
  assert.equal(getActivityEventDetail(null), '');
});

test('getActivityEventIcon returns correct icon keys for each event type', () => {
  assert.equal(getActivityEventIcon('request_created'), 'music-request');
  assert.equal(getActivityEventIcon('artist_monitored'), 'artist-monitored');
  assert.equal(getActivityEventIcon('artist_policy_saved'), 'artist-policy');
  assert.equal(getActivityEventIcon('release_added'), 'release-added');
  assert.equal(getActivityEventIcon('request_fulfilled'), 'checkmark');
  assert.equal(getActivityEventIcon('download_completed'), 'download');
  assert.equal(getActivityEventIcon('music_queue_quality_blocked'), 'audio-check');
  assert.equal(getActivityEventIcon('quality_fallback_allowed'), 'audio-check');
  assert.equal(getActivityEventIcon('unknown_type'), 'activity');
  assert.equal(getActivityEventIcon(null), 'activity');
});
