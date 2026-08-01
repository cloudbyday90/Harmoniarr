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
import { buildActivityEventLinkTarget } from '../../src/client/lib/activity-event-link-targets.js';

function makeReleaseAddedEvent(overrides = {}) {
  return {
    id: 'evt-1',
    eventType: 'release_added',
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
        runId: 'run-organize-1',
      },
    },
    ...overrides,
  };
}

test('buildActivityEventLinkTarget returns null for activity events without a supported handoff', () => {
  assert.equal(buildActivityEventLinkTarget({ eventType: 'request_created' }), null);
  assert.equal(buildActivityEventLinkTarget({ eventType: 'artist_monitored' }), null);
  assert.equal(buildActivityEventLinkTarget({ eventType: 'download_completed' }), null);
  assert.equal(buildActivityEventLinkTarget({ eventType: 'request_fulfilled' }), null);
  assert.equal(buildActivityEventLinkTarget({}), null);
  assert.equal(buildActivityEventLinkTarget(), null);
});

test('buildActivityEventLinkTarget resolves allowed quality fallback to Music Queue', () => {
  const target = buildActivityEventLinkTarget({
    entityId: 'wanted-1',
    entityType: 'wanted_release',
    eventType: 'quality_fallback_allowed',
    extraPayload: { wantedReleaseId: 'wanted-1' },
  });

  assert.deepEqual(target, {
    label: 'Open Music Queue',
    to: {
      name: 'music-queue-release',
      params: { wantedReleaseId: 'wanted-1' },
    },
  });
});

test('buildActivityEventLinkTarget resolves quality blocks to Music Queue review', () => {
  const target = buildActivityEventLinkTarget({
    entityId: 'wanted-1',
    entityType: 'wanted_release',
    eventType: 'music_queue_quality_blocked',
    extraPayload: {
      wantedReleaseId: 'wanted-1',
    },
  });

  assert.deepEqual(target, {
    label: 'Review quality choice',
    to: {
      name: 'music-queue-release',
      params: { wantedReleaseId: 'wanted-1' },
    },
  });
});

test('buildActivityEventLinkTarget resolves Music Queue lifecycle events to the release', () => {
  const target = buildActivityEventLinkTarget({
    entityId: 'wanted-1',
    entityType: 'wanted_release',
    eventType: 'music_queue_match_retrying',
    extraPayload: { wantedReleaseId: 'wanted-1' },
  });

  assert.deepEqual(target, {
    label: 'Open Music Queue',
    to: {
      name: 'music-queue-release',
      params: { wantedReleaseId: 'wanted-1' },
    },
  });
});

test('buildActivityEventLinkTarget resolves import safety stops to release-centred recovery', () => {
  const target = buildActivityEventLinkTarget({
    entityId: 'wanted-1',
    entityType: 'wanted_release',
    eventType: 'music_queue_import_blocked',
    extraPayload: { wantedReleaseId: 'wanted-1' },
  });

  assert.deepEqual(target, {
    label: 'Review what needs fixing',
    to: {
      name: 'music-queue-release',
      params: { wantedReleaseId: 'wanted-1' },
    },
  });
});

test('buildActivityEventLinkTarget resolves a recovered provider search to Music Queue', () => {
  const target = buildActivityEventLinkTarget({
    entityId: 'wanted-1',
    entityType: 'wanted_release',
    eventType: 'music_queue_search_started',
    extraPayload: { wantedReleaseId: 'wanted-1' },
  });

  assert.deepEqual(target, {
    label: 'Open Music Queue',
    to: {
      name: 'music-queue-release',
      params: { wantedReleaseId: 'wanted-1' },
    },
  });
});

test('buildActivityEventLinkTarget does not treat import candidate ids as Music Queue release ids', () => {
  const target = buildActivityEventLinkTarget({
    entityId: 'candidate-1',
    entityType: 'import_candidate',
    eventType: 'music_queue_quality_blocked',
    extraPayload: {},
  });

  assert.equal(target, null);
});

test('buildActivityEventLinkTarget sends library events to the Library instead of diagnostics', () => {
  assert.deepEqual(buildActivityEventLinkTarget(makeReleaseAddedEvent()), {
    label: 'Open Library',
    to: { name: 'library' },
  });
});

test('buildActivityEventLinkTarget resolves artist policy activity back to Artist Detail', () => {
  const target = buildActivityEventLinkTarget({
    eventType: 'artist_policy_saved',
    extraPayload: {
      artistMusicBrainzId: 'mb-artist-boards',
    },
  });

  assert.deepEqual(target, {
    label: 'Open artist policy',
    to: {
      name: 'artist-detail',
      params: { mbid: 'mb-artist-boards' },
    },
  });
});

test('buildActivityEventLinkTarget returns null for artist policy activity without MusicBrainz artist id', () => {
  assert.equal(buildActivityEventLinkTarget({
    eventType: 'artist_policy_saved',
    extraPayload: {},
  }), null);
});

test('buildActivityEventLinkTarget keeps release events useful without legacy source metadata', () => {
  assert.deepEqual(buildActivityEventLinkTarget({
    eventType: 'release_added',
    entityArtist: 'Radiohead',
    entityTitle: 'Kid A',
  }), {
    label: 'Open Library',
    to: { name: 'library' },
  });
});

test('buildActivityEventLinkTarget offers one safe handoff for audio and request outcomes', () => {
  assert.deepEqual(buildActivityEventLinkTarget({
    eventType: 'music_queue_audio_check_failed',
  }), {
    label: 'Check connections',
    to: {
      name: 'settings-connections',
      query: { returnTo: 'activity_timeline' },
    },
  });
  assert.deepEqual(buildActivityEventLinkTarget({
    entityId: 'wanted-1',
    entityType: 'wanted_release',
    eventType: 'music_queue_audio_check_failed',
  }), {
    label: 'Check connections',
    to: {
      name: 'settings-connections',
      query: {
        returnReleaseId: 'wanted-1',
        returnTo: 'music_queue_release',
      },
    },
  });
  assert.deepEqual(buildActivityEventLinkTarget({
    entityId: 'wanted-1',
    entityType: 'wanted_release',
    eventType: 'music_queue_audio_warning',
    extraPayload: { wantedReleaseId: 'wanted-1' },
  }), {
    label: 'Review quality choice',
    to: {
      name: 'music-queue-release',
      params: { wantedReleaseId: 'wanted-1' },
    },
  });
  assert.deepEqual(buildActivityEventLinkTarget({
    entityId: 'request-1',
    entityType: 'media_request',
    eventType: 'request_fulfilled',
    extraPayload: { sourceMediaRequestId: 'request-1' },
  }), {
    label: 'Open request',
    to: {
      name: 'request-detail',
      params: { id: 'request-1' },
    },
  });
});
