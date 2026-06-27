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
import { createLibraryReleasesService } from '../../src/server/library/library-releases-service.js';

function makeRelease(overrides = {}) {
  return {
    id: 'recon-uuid-1',
    artistName: 'Radiohead',
    expectedTrackCount: 12,
    matchedTrackCount: 12,
    missingTrackCount: 0,
    matchedFileCount: 12,
    duplicateTrackCount: 0,
    reconciliationStatus: 'complete',
    releaseTitle: 'OK Computer',
    releaseDate: '1997-05-21',
    musicbrainzReleaseId: 'rel-mbid-1',
    musicbrainzReleaseGroupId: 'rg-mbid-1',
    ...overrides,
  };
}

// ── buildLibraryReleases ──────────────────────────────────────────────────────

test('buildLibraryReleases returns ok with checkedAt, total, and releases', async () => {
  const releases = [makeRelease()];
  const service = createLibraryReleasesService({
    libraryReleaseReconciliationStore: {
      listLibraryReleasesWithMetadata: async () => releases,
    },
  });

  const result = await service.buildLibraryReleases();

  assert.ok(result.checkedAt);
  assert.equal(result.total, 1);
  assert.equal(result.releases.length, 1);
  assert.equal(result.releases[0].releaseTitle, 'OK Computer');
});

test('buildLibraryReleases passes reconciliationStatus to store', async (t) => {
  const listLibraryReleasesWithMetadata = t.mock.fn(async () => []);

  const service = createLibraryReleasesService({
    libraryReleaseReconciliationStore: { listLibraryReleasesWithMetadata },
  });

  await service.buildLibraryReleases({ reconciliationStatus: 'complete' });

  const callArgs = listLibraryReleasesWithMetadata.mock.calls[0].arguments[0];
  assert.equal(callArgs.reconciliationStatus, 'complete');
});

test('buildLibraryReleases passes appUserId and visibilityState to store', async (t) => {
  const listLibraryReleasesWithMetadata = t.mock.fn(async () => []);

  const service = createLibraryReleasesService({
    libraryReleaseReconciliationStore: { listLibraryReleasesWithMetadata },
  });

  await service.buildLibraryReleases({
    appUserId: 'operator-1',
    visibilityState: 'removed',
  });

  const callArgs = listLibraryReleasesWithMetadata.mock.calls[0].arguments[0];
  assert.equal(callArgs.appUserId, 'operator-1');
  assert.equal(callArgs.visibilityState, 'removed');
});

test('buildLibraryReleases passes partial reconciliationStatus to store', async (t) => {
  const listLibraryReleasesWithMetadata = t.mock.fn(async () => []);

  const service = createLibraryReleasesService({
    libraryReleaseReconciliationStore: { listLibraryReleasesWithMetadata },
  });

  await service.buildLibraryReleases({ reconciliationStatus: 'partial' });

  const callArgs = listLibraryReleasesWithMetadata.mock.calls[0].arguments[0];
  assert.equal(callArgs.reconciliationStatus, 'partial');
});

test('buildLibraryReleases passes null reconciliationStatus when omitted', async (t) => {
  const listLibraryReleasesWithMetadata = t.mock.fn(async () => []);

  const service = createLibraryReleasesService({
    libraryReleaseReconciliationStore: { listLibraryReleasesWithMetadata },
  });

  await service.buildLibraryReleases();

  const callArgs = listLibraryReleasesWithMetadata.mock.calls[0].arguments[0];
  assert.equal(callArgs.reconciliationStatus, null);
});

test('buildLibraryReleases forwards limit to store', async (t) => {
  const listLibraryReleasesWithMetadata = t.mock.fn(async () => []);

  const service = createLibraryReleasesService({
    libraryReleaseReconciliationStore: { listLibraryReleasesWithMetadata },
  });

  await service.buildLibraryReleases({ limit: 100 });

  const callArgs = listLibraryReleasesWithMetadata.mock.calls[0].arguments[0];
  assert.equal(callArgs.limit, 100);
});

test('buildLibraryReleases returns total matching releases array length', async () => {
  const service = createLibraryReleasesService({
    libraryReleaseReconciliationStore: {
      listLibraryReleasesWithMetadata: async () => [makeRelease(), makeRelease({ id: 'uuid-2' })],
    },
  });

  const result = await service.buildLibraryReleases();

  assert.equal(result.total, 2);
  assert.equal(result.releases.length, 2);
});

test('buildLibraryReleases returns empty result when store returns no releases', async () => {
  const service = createLibraryReleasesService({
    libraryReleaseReconciliationStore: {
      listLibraryReleasesWithMetadata: async () => [],
    },
  });

  const result = await service.buildLibraryReleases();

  assert.equal(result.total, 0);
  assert.deepEqual(result.releases, []);
  assert.ok(typeof result.checkedAt === 'string');
});

test('buildLibraryReleases checkedAt is a valid ISO date string', async () => {
  const service = createLibraryReleasesService({
    libraryReleaseReconciliationStore: {
      listLibraryReleasesWithMetadata: async () => [],
    },
  });

  const result = await service.buildLibraryReleases();

  assert.ok(!Number.isNaN(Date.parse(result.checkedAt)));
});
