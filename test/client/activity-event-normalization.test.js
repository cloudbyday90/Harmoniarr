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
  formatActivityEventTime,
  getActivityEventDetail,
  getActivityEventIcon,
  getActivityEventLabel,
  normalizeActivityEvent,
} from '../../src/client/lib/activity-event-normalization.js';

// ── normalizeActivityEvent ────────────────────────────────────────────────────

test('normalizeActivityEvent: returns empty object for null input', () => {
  assert.deepEqual(normalizeActivityEvent(null), {});
});

test('normalizeActivityEvent: returns empty object for undefined input', () => {
  assert.deepEqual(normalizeActivityEvent(undefined), {});
});

test('normalizeActivityEvent: maps all fields from a full event row', () => {
  const raw = {
    id: 'evt-1',
    eventType: 'request_created',
    actorUserId: 'user-1',
    entityType: 'media_request',
    entityId: 'req-1',
    entityTitle: 'OK Computer',
    entityArtist: 'Radiohead',
    extraPayload: { note: 'expanded edition' },
    occurredAt: '2026-06-01T11:00:00.000Z',
  };

  const result = normalizeActivityEvent(raw);

  assert.equal(result.id, 'evt-1');
  assert.equal(result.eventType, 'request_created');
  assert.equal(result.actorUserId, 'user-1');
  assert.equal(result.entityType, 'media_request');
  assert.equal(result.entityId, 'req-1');
  assert.equal(result.entityTitle, 'OK Computer');
  assert.equal(result.entityArtist, 'Radiohead');
  assert.deepEqual(result.extraPayload, { note: 'expanded edition' });
  assert.equal(result.occurredAt, '2026-06-01T11:00:00.000Z');
  assert.equal(result.releasePresentation, null);
});

test('normalizeActivityEvent: falls back to null for missing optional fields', () => {
  const result = normalizeActivityEvent({ eventType: 'artist_monitored' });

  assert.equal(result.id, null);
  assert.equal(result.actorUserId, null);
  assert.equal(result.entityType, null);
  assert.equal(result.entityId, null);
  assert.equal(result.entityTitle, null);
  assert.equal(result.entityArtist, null);
  assert.equal(result.extraPayload, null);
  assert.equal(result.occurredAt, null);
  assert.equal(result.releasePresentation, null);
});

test('normalizeActivityEvent: normalizes release_added events onto a shared release presentation contract', () => {
  const result = normalizeActivityEvent({
    eventType: 'release_added',
    extraPayload: {
      schemaVersion: 1,
      presentationType: 'release_added',
      releaseCount: 2,
      releases: [
        { artistName: 'Radiohead', releaseTitle: 'Kid A' },
        { artistName: 'Autechre', releaseTitle: 'Amber' },
      ],
      source: {
        operationType: 'library_organize_apply',
        runId: 'run-1',
      },
    },
  });

  assert.deepEqual(result.releasePresentation, {
    schemaVersion: 1,
    presentationType: 'release_added',
    movedCount: null,
    primaryRelease: { artistName: 'Radiohead', releaseTitle: 'Kid A' },
    releaseCount: 2,
    releases: [
      { artistName: 'Radiohead', releaseTitle: 'Kid A' },
      { artistName: 'Autechre', releaseTitle: 'Amber' },
    ],
    source: {
      operationType: 'library_organize_apply',
      runId: 'run-1',
    },
  });
});

// ── getActivityEventLabel ─────────────────────────────────────────────────────

test('getActivityEventLabel: request_created with title and artist', () => {
  const label = getActivityEventLabel(
    { eventType: 'request_created', entityTitle: 'OK Computer', entityArtist: 'Radiohead' },
    null,
  );
  assert.equal(label, 'Music requested: OK Computer by Radiohead');
});

test('getActivityEventLabel: request_created with title only', () => {
  const label = getActivityEventLabel(
    { eventType: 'request_created', entityTitle: 'OK Computer', entityArtist: null },
    null,
  );
  assert.equal(label, 'Music requested: OK Computer');
});

test('getActivityEventLabel: request_created with no title falls back to "music"', () => {
  const label = getActivityEventLabel(
    { eventType: 'request_created', entityTitle: null, entityArtist: null },
    null,
  );
  assert.equal(label, 'Music requested: music');
});

test('getActivityEventLabel: artist_monitored with title', () => {
  const label = getActivityEventLabel(
    { eventType: 'artist_monitored', entityTitle: 'Radiohead', actorUserId: null },
    null,
  );
  assert.equal(label, 'Now monitoring Radiohead');
});

test('getActivityEventLabel: artist_monitored with no title falls back', () => {
  const label = getActivityEventLabel(
    { eventType: 'artist_monitored', entityTitle: null, actorUserId: null },
    null,
  );
  assert.equal(label, 'Now monitoring an artist');
});

test('getActivityEventLabel: release_added with title and artist', () => {
  const label = getActivityEventLabel(
    { eventType: 'release_added', entityTitle: 'Kid A', entityArtist: 'Radiohead' },
    null,
  );
  assert.equal(label, 'Kid A by Radiohead added to library');
});

test('getActivityEventLabel: release_added with shared multi-release presentation avoids misleading artist suffix', () => {
  const label = getActivityEventLabel(
    {
      eventType: 'release_added',
      entityArtist: 'Radiohead',
      entityTitle: '2 releases',
      releasePresentation: {
        schemaVersion: 1,
        presentationType: 'release_added',
        movedCount: 2,
        primaryRelease: { artistName: 'Radiohead', releaseTitle: 'Kid A' },
        releaseCount: 2,
        releases: [
          { artistName: 'Radiohead', releaseTitle: 'Kid A' },
          { artistName: 'Autechre', releaseTitle: 'Amber' },
        ],
        source: null,
      },
    },
    null,
  );
  assert.equal(label, '2 releases added to library');
});

test('getActivityEventDetail: release_added with multi-release summaries returns detail copy', () => {
  const detail = getActivityEventDetail({
    eventType: 'release_added',
    extraPayload: {
      releaseCount: 3,
      releaseSummaries: [
        { artistName: 'Radiohead', releaseTitle: 'Kid A' },
        { artistName: 'Autechre', releaseTitle: 'Amber' },
        { artistName: 'Aphex Twin', releaseTitle: 'Selected Ambient Works 85-92' },
      ],
    },
  });

  assert.equal(detail, 'Includes Kid A by Radiohead, Amber by Autechre, Selected Ambient Works 85-92 by Aphex Twin.');
});

test('getActivityEventDetail: release_added with truncated summaries mentions remaining releases', () => {
  const detail = getActivityEventDetail({
    eventType: 'release_added',
    extraPayload: {
      releaseCount: 4,
      releaseSummaries: [
        { artistName: 'Radiohead', releaseTitle: 'Kid A' },
        { artistName: 'Autechre', releaseTitle: 'Amber' },
        { artistName: 'Aphex Twin', releaseTitle: 'Selected Ambient Works 85-92' },
      ],
    },
  });

  assert.equal(detail, 'Includes Kid A by Radiohead, Amber by Autechre, Selected Ambient Works 85-92 by Aphex Twin, and 1 more.');
});

test('getActivityEventDetail: release_added with shared contract payload returns detail copy', () => {
  const detail = getActivityEventDetail({
    eventType: 'release_added',
    extraPayload: {
      schemaVersion: 1,
      presentationType: 'release_added',
      releaseCount: 2,
      releases: [
        { artistName: 'Radiohead', releaseTitle: 'Kid A' },
        { artistName: 'Autechre', releaseTitle: 'Amber' },
      ],
      source: {
        operationType: 'library_organize_apply',
        runId: 'run-1',
      },
    },
  });

  assert.equal(detail, 'Includes Kid A by Radiohead, Amber by Autechre.');
});

test('getActivityEventDetail: release_added with a single release returns empty string', () => {
  const detail = getActivityEventDetail({
    eventType: 'release_added',
    extraPayload: {
      releaseCount: 1,
      releaseSummaries: [{ artistName: 'Radiohead', releaseTitle: 'Kid A' }],
    },
  });

  assert.equal(detail, '');
});

test('getActivityEventDetail: non-release events return empty string', () => {
  assert.equal(getActivityEventDetail({ eventType: 'request_created', extraPayload: {} }), '');
});

test('getActivityEventLabel: request_fulfilled — owner sees personal variant', () => {
  const label = getActivityEventLabel(
    {
      eventType: 'request_fulfilled',
      entityTitle: 'Kid A',
      entityArtist: 'Radiohead',
      actorUserId: 'user-1',
    },
    'user-1',
  );
  assert.equal(label, 'Your request for Kid A by Radiohead is ready');
});

test('getActivityEventLabel: request_fulfilled — other user sees generic variant', () => {
  const label = getActivityEventLabel(
    {
      eventType: 'request_fulfilled',
      entityTitle: 'Kid A',
      entityArtist: 'Radiohead',
      actorUserId: 'user-1',
    },
    'user-2',
  );
  assert.equal(label, 'Kid A by Radiohead added to library');
});

test('getActivityEventLabel: request_fulfilled — null currentUserId shows generic variant', () => {
  const label = getActivityEventLabel(
    {
      eventType: 'request_fulfilled',
      entityTitle: 'Kid A',
      entityArtist: null,
      actorUserId: 'user-1',
    },
    null,
  );
  assert.equal(label, 'Kid A added to library');
});

test('getActivityEventLabel: download_completed with title and artist', () => {
  const label = getActivityEventLabel(
    { eventType: 'download_completed', entityTitle: 'Amnesiac', entityArtist: 'Radiohead' },
    null,
  );
  assert.equal(label, 'Download completed: Amnesiac by Radiohead');
});

test('getActivityEventLabel: download_completed with no title falls back to "a file"', () => {
  const label = getActivityEventLabel(
    { eventType: 'download_completed', entityTitle: null, entityArtist: null },
    null,
  );
  assert.equal(label, 'Download completed: a file');
});

test('getActivityEventLabel: unknown eventType returns the type string', () => {
  const label = getActivityEventLabel(
    { eventType: 'hypothetical_event' },
    null,
  );
  assert.equal(label, 'hypothetical_event');
});

test('getActivityEventLabel: null eventType returns "Activity" fallback', () => {
  const label = getActivityEventLabel({ eventType: null }, null);
  assert.equal(label, 'Activity');
});

// ── getActivityEventIcon ──────────────────────────────────────────────────────

test('getActivityEventIcon: request_created returns music-request', () => {
  assert.equal(getActivityEventIcon('request_created'), 'music-request');
});

test('getActivityEventIcon: artist_monitored returns artist-monitored', () => {
  assert.equal(getActivityEventIcon('artist_monitored'), 'artist-monitored');
});

test('getActivityEventIcon: release_added returns release-added', () => {
  assert.equal(getActivityEventIcon('release_added'), 'release-added');
});

test('getActivityEventIcon: request_fulfilled returns checkmark', () => {
  assert.equal(getActivityEventIcon('request_fulfilled'), 'checkmark');
});

test('getActivityEventIcon: download_completed returns download', () => {
  assert.equal(getActivityEventIcon('download_completed'), 'download');
});

test('getActivityEventIcon: unknown type returns activity', () => {
  assert.equal(getActivityEventIcon('some_future_type'), 'activity');
});

test('getActivityEventIcon: null returns activity', () => {
  assert.equal(getActivityEventIcon(null), 'activity');
});

// ── formatActivityEventTime ───────────────────────────────────────────────────

test('formatActivityEventTime: null returns empty string', () => {
  assert.equal(formatActivityEventTime(null), '');
});

test('formatActivityEventTime: undefined returns empty string', () => {
  assert.equal(formatActivityEventTime(undefined), '');
});

test('formatActivityEventTime: empty string returns empty string', () => {
  assert.equal(formatActivityEventTime(''), '');
});

test('formatActivityEventTime: non-date string returns empty string', () => {
  assert.equal(formatActivityEventTime('not-a-date'), '');
});

test('formatActivityEventTime: valid ISO timestamp returns non-empty locale string', () => {
  const result = formatActivityEventTime('2025-05-12T14:34:00.000Z');
  assert.ok(typeof result === 'string' && result.length > 0);
});
