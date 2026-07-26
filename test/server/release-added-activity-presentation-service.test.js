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
import { buildReleaseAddedActivityEvent } from '../../src/server/activity/release-added-activity-presentation-service.js';

test('buildReleaseAddedActivityEvent emits a shared single-release presentation contract', () => {
  assert.deepEqual(buildReleaseAddedActivityEvent({
    artistName: 'Radiohead',
    entityId: 'candidate-1',
    entityType: 'import_candidate',
    operationType: 'import_candidate_apply',
    releaseTitle: 'Kid A',
    runId: 'run-1',
  }), {
    actorUserId: null,
    entityArtist: 'Radiohead',
    entityId: 'candidate-1',
    entityTitle: 'Kid A',
    entityType: 'import_candidate',
    eventType: 'release_added',
    extraPayload: {
      schemaVersion: 1,
      presentationType: 'release_added',
      movedCount: null,
      primaryRelease: { artistName: 'Radiohead', releaseTitle: 'Kid A' },
      releaseCount: 1,
      releases: [{ artistName: 'Radiohead', releaseTitle: 'Kid A' }],
      source: {
        operationType: 'import_candidate_apply',
        runId: 'run-1',
      },
    },
  });
});

test('buildReleaseAddedActivityEvent clears entityArtist for multi-release events and keeps run metadata', () => {
  const event = buildReleaseAddedActivityEvent({
    artistName: 'Radiohead',
    entityType: 'library_release',
    movedCount: 2,
    operationType: 'library_organize_apply',
    releaseCount: 2,
    releases: [
      { artistName: 'Radiohead', releaseTitle: 'Kid A' },
      { artistName: 'Autechre', releaseTitle: 'Amber' },
    ],
    releaseTitle: 'Kid A',
    runId: 'run-2',
  });

  assert.equal(event.entityArtist, null);
  assert.equal(event.entityTitle, '2 releases');
  assert.deepEqual(event.extraPayload.source, {
    operationType: 'library_organize_apply',
    runId: 'run-2',
  });
});

test('buildReleaseAddedActivityEvent keeps fallback entity title when no canonical release title exists', () => {
  const event = buildReleaseAddedActivityEvent({
    artistName: 'Unknown Artist',
    entityType: 'import_candidate',
    fallbackEntityTitle: 'uploader/odd-folder',
    operationType: 'import_candidate_apply',
    runId: 'run-3',
  });

  assert.equal(event.entityTitle, 'uploader/odd-folder');
  assert.equal(event.extraPayload.releaseCount, 1);
  assert.deepEqual(event.extraPayload.primaryRelease, {
    artistName: 'Unknown Artist',
    releaseTitle: null,
  });
});

test('buildReleaseAddedActivityEvent preserves the bounded Music Queue release correlation', () => {
  const event = buildReleaseAddedActivityEvent({
    artistName: 'Forest Frank',
    entityId: 'candidate-forest-frank',
    entityType: 'import_candidate',
    releaseTitle: 'Child of God',
    wantedReleaseId: ' wanted-forest-frank ',
  });

  assert.equal(event.entityId, 'candidate-forest-frank');
  assert.equal(event.extraPayload.wantedReleaseId, 'wanted-forest-frank');
});
