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

test('buildActivityEventLinkTarget returns null for non-release_added events', () => {
  assert.equal(buildActivityEventLinkTarget({ eventType: 'request_created' }), null);
  assert.equal(buildActivityEventLinkTarget({ eventType: 'artist_monitored' }), null);
  assert.equal(buildActivityEventLinkTarget({ eventType: 'download_completed' }), null);
  assert.equal(buildActivityEventLinkTarget({ eventType: 'request_fulfilled' }), null);
  assert.equal(buildActivityEventLinkTarget({}), null);
  assert.equal(buildActivityEventLinkTarget(), null);
});

test('buildActivityEventLinkTarget resolves library_organize_apply drillthrough from presentation source', () => {
  const event = makeReleaseAddedEvent();
  const target = buildActivityEventLinkTarget(event);

  assert.deepEqual(target, {
    label: 'View organize apply',
    to: {
      name: 'jobs',
      query: { runId: 'run-organize-1' },
    },
  });
});

test('buildActivityEventLinkTarget resolves import_candidate_apply drillthrough from presentation source', () => {
  const event = makeReleaseAddedEvent({
    extraPayload: {
      schemaVersion: 1,
      presentationType: 'release_added',
      primaryRelease: { artistName: 'Aphex Twin', releaseTitle: 'Selected Ambient Works 85-92' },
      releaseCount: 1,
      releases: [{ artistName: 'Aphex Twin', releaseTitle: 'Selected Ambient Works 85-92' }],
      movedCount: 14,
      source: {
        operationType: 'import_candidate_apply',
        runId: 'run-import-apply-1',
      },
    },
  });

  const target = buildActivityEventLinkTarget(event);

  assert.deepEqual(target, {
    label: 'View library import',
    to: {
      hash: '#import-apply-run-panel',
      name: 'review-queue',
      query: { applyRunId: 'run-import-apply-1' },
    },
  });
});

test('buildActivityEventLinkTarget resolves import_candidate_execution_planning drillthrough from presentation source', () => {
  const event = makeReleaseAddedEvent({
    extraPayload: {
      schemaVersion: 1,
      presentationType: 'release_added',
      primaryRelease: { artistName: 'Boards of Canada', releaseTitle: 'Music Has the Right to Children' },
      releaseCount: 1,
      releases: [{ artistName: 'Boards of Canada', releaseTitle: 'Music Has the Right to Children' }],
      movedCount: 18,
      source: {
        operationType: 'import_candidate_execution_planning',
        runId: 'run-exec-1',
      },
    },
  });

  const target = buildActivityEventLinkTarget(event);

  assert.deepEqual(target, {
    label: 'View download run',
    to: {
      hash: '#import-execution-run-panel',
      name: 'review-queue',
      query: { executionRunId: 'run-exec-1' },
    },
  });
});

test('buildActivityEventLinkTarget returns null for release_added without source metadata', () => {
  const event = makeReleaseAddedEvent({
    extraPayload: {
      schemaVersion: 1,
      presentationType: 'release_added',
      primaryRelease: { artistName: 'Radiohead', releaseTitle: 'OK Computer' },
      releaseCount: 1,
      releases: [{ artistName: 'Radiohead', releaseTitle: 'OK Computer' }],
      movedCount: 12,
      source: null,
    },
  });

  assert.equal(buildActivityEventLinkTarget(event), null);
});

test('buildActivityEventLinkTarget returns null for release_added with source but missing runId', () => {
  const event = makeReleaseAddedEvent({
    extraPayload: {
      schemaVersion: 1,
      presentationType: 'release_added',
      primaryRelease: { artistName: 'Radiohead', releaseTitle: 'OK Computer' },
      releaseCount: 1,
      releases: [{ artistName: 'Radiohead', releaseTitle: 'OK Computer' }],
      movedCount: 12,
      source: { operationType: 'library_organize_apply' },
    },
  });

  assert.equal(buildActivityEventLinkTarget(event), null);
});

test('buildActivityEventLinkTarget returns null for release_added with source but missing operationType', () => {
  const event = makeReleaseAddedEvent({
    extraPayload: {
      schemaVersion: 1,
      presentationType: 'release_added',
      primaryRelease: { artistName: 'Radiohead', releaseTitle: 'OK Computer' },
      releaseCount: 1,
      releases: [{ artistName: 'Radiohead', releaseTitle: 'OK Computer' }],
      movedCount: 12,
      source: { runId: 'run-1' },
    },
  });

  assert.equal(buildActivityEventLinkTarget(event), null);
});

test('buildActivityEventLinkTarget falls back to legacy normalization when releasePresentation is missing', () => {
  const event = {
    id: 'evt-legacy',
    eventType: 'release_added',
    entityTitle: 'Kid A',
    entityArtist: 'Radiohead',
    extraPayload: null,
    releasePresentation: null,
  };

  assert.equal(buildActivityEventLinkTarget(event), null);
});

test('buildActivityEventLinkTarget uses pre-normalized releasePresentation when available', () => {
  const event = {
    id: 'evt-pre-normalized',
    eventType: 'release_added',
    entityTitle: 'Kid A',
    entityArtist: 'Radiohead',
    releasePresentation: {
      schemaVersion: 1,
      presentationType: 'release_added',
      primaryRelease: { artistName: 'Radiohead', releaseTitle: 'Kid A' },
      releaseCount: 1,
      releases: [{ artistName: 'Radiohead', releaseTitle: 'Kid A' }],
      movedCount: 10,
      source: {
        operationType: 'library_organize_apply',
        runId: 'run-pre-norm-1',
      },
    },
  };

  const target = buildActivityEventLinkTarget(event);

  assert.deepEqual(target, {
    label: 'View organize apply',
    to: {
      name: 'jobs',
      query: { runId: 'run-pre-norm-1' },
    },
  });
});

test('buildActivityEventLinkTarget handles library_scan drillthrough', () => {
  const event = makeReleaseAddedEvent({
    extraPayload: {
      schemaVersion: 1,
      presentationType: 'release_added',
      primaryRelease: { artistName: 'Test Artist', releaseTitle: 'Test Album' },
      releaseCount: 1,
      releases: [{ artistName: 'Test Artist', releaseTitle: 'Test Album' }],
      movedCount: 5,
      source: {
        operationType: 'library_scan',
        runId: 'run-scan-1',
      },
    },
  });

  const target = buildActivityEventLinkTarget(event);

  assert.deepEqual(target, {
    label: 'View library scan',
    to: {
      hash: '#library-scan-panel',
      name: 'dashboard-panel',
      query: { libraryScanRunId: 'run-scan-1' },
    },
  });
});

test('buildActivityEventLinkTarget handles artwork_cleanup drillthrough', () => {
  const event = makeReleaseAddedEvent({
    extraPayload: {
      schemaVersion: 1,
      presentationType: 'release_added',
      primaryRelease: null,
      releaseCount: 0,
      releases: [],
      movedCount: 1,
      source: {
        operationType: 'artwork_cleanup',
        runId: 'run-art-1',
      },
    },
  });

  const target = buildActivityEventLinkTarget(event);

  assert.deepEqual(target, {
    label: 'View artwork cleanup',
    to: {
      hash: '#artwork-maintenance-panel',
      name: 'dashboard-panel',
      query: { artworkRunId: 'run-art-1' },
    },
  });
});
