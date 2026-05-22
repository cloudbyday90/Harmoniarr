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

test('buildActivityEventLinkTarget resolves import-apply release events into import review drillthrough', () => {
  assert.deepEqual(buildActivityEventLinkTarget({
    eventType: 'release_added',
    releasePresentation: {
      schemaVersion: 1,
      presentationType: 'release_added',
      movedCount: null,
      primaryRelease: { artistName: 'Radiohead', releaseTitle: 'Kid A' },
      releaseCount: 1,
      releases: [{ artistName: 'Radiohead', releaseTitle: 'Kid A' }],
      source: {
        operationType: 'import_candidate_apply',
        runId: 'apply-run-1',
      },
    },
  }), {
    label: 'View library import',
    to: {
      hash: '#import-apply-run-panel',
      name: 'review-queue',
      query: {
        applyRunId: 'apply-run-1',
      },
    },
  });
});

test('buildActivityEventLinkTarget resolves organize-apply release events into jobs drillthrough', () => {
  assert.deepEqual(buildActivityEventLinkTarget({
    eventType: 'release_added',
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
      source: {
        operationType: 'library_organize_apply',
        runId: 'organize-run-1',
      },
    },
  }), {
    label: 'View organize apply',
    to: {
      name: 'jobs',
      query: {
        runId: 'organize-run-1',
      },
    },
  });
});

test('buildActivityEventLinkTarget falls back to legacy shared payload shape for persisted release events', () => {
  assert.deepEqual(buildActivityEventLinkTarget({
    eventType: 'release_added',
    entityArtist: 'Radiohead',
    entityTitle: 'Kid A',
    extraPayload: {
      schemaVersion: 1,
      presentationType: 'release_added',
      releaseCount: 1,
      releases: [{ artistName: 'Radiohead', releaseTitle: 'Kid A' }],
      source: {
        operationType: 'import_candidate_apply',
        runId: 'apply-run-2',
      },
    },
  }), {
    label: 'View library import',
    to: {
      hash: '#import-apply-run-panel',
      name: 'review-queue',
      query: {
        applyRunId: 'apply-run-2',
      },
    },
  });
});

test('buildActivityEventLinkTarget returns null for non-release or unlinked events', () => {
  assert.equal(buildActivityEventLinkTarget({ eventType: 'request_created' }), null);
  assert.equal(buildActivityEventLinkTarget({ eventType: 'release_added', releasePresentation: null }), null);
});
