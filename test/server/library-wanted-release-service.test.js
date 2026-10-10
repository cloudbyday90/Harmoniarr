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
import { buildLibraryWantedReleaseProjection } from '../../src/server/library/library-wanted-release-projection-service.js';
import { createLibraryWantedReleaseReader } from '../../src/server/library/library-wanted-release-reader.js';

function buildArtistPayload() {
  return {
    artist: { id: 'artist-1' },
    releaseGroups: [
      { id: 'group-policy', primaryType: 'album', title: 'Policy album' },
      { id: 'group-manual', primaryType: 'single', title: 'Manual single' },
      { id: 'group-complete', primaryType: 'album', title: 'Complete album' },
    ],
    releases: [
      {
        id: 'release-policy',
        isCanonical: true,
        releaseDate: '2028-06-01',
        releaseGroupId: 'group-policy',
        status: 'Official',
        title: 'Policy album',
        trackCount: 10,
      },
      {
        id: 'release-manual',
        isCanonical: true,
        releaseDate: '2016',
        releaseGroupId: 'group-manual',
        status: 'Official',
        title: 'Manual single',
        trackCount: 4,
      },
      {
        id: 'release-complete',
        isCanonical: true,
        releaseDate: '2028-09-01',
        releaseGroupId: 'group-complete',
        status: 'Official',
        title: 'Complete album',
        trackCount: 12,
      },
    ],
  };
}

test('wanted-release projection uses effective desired state and retains explicit selections under manual-only automation', () => {
  const wantedReleases = buildLibraryWantedReleaseProjection({
    appUserId: 'user-1',
    artistPayload: buildArtistPayload(),
    libraryReleaseReconciliations: [
      {
        expectedTrackCount: 12,
        matchedTrackCount: 12,
        metadataReleaseId: 'release-complete',
        reconciliationStatus: 'complete',
      },
    ],
    monitoring: {
      isMonitored: true,
      monitoredReleaseGroupTypes: ['album'],
      releaseScope: 'track_only',
      wantedAutomationMode: 'manual_only',
    },
    releaseGroupSelections: [{
      metadataReleaseGroupId: 'group-manual',
      resolvedMetadataReleaseId: 'release-manual',
      selectionOrigin: 'manual_inclusion',
      selectionSource: 'manual',
      selectionState: 'selected',
    }],
  });

  assert.deepEqual(wantedReleases, [{
    appUserId: 'user-1',
    evidence: {
      monitoredReleaseGroupTypes: ['album'],
      reconciliationStatus: 'missing',
      releaseScope: 'track_only',
      selectionOrigin: 'manual_inclusion',
      selectionSource: 'manual',
      selectionState: 'selected',
      strategy: 'explicit_release_gap',
      wantedAutomationMode: 'manual_only',
    },
    expectedTrackCount: 4,
    matchedTrackCount: 0,
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'group-manual',
    metadataReleaseId: 'release-manual',
    missingTrackCount: 4,
    releaseDate: '2016-01-01',
    releaseStatus: 'Official',
    wantedStatus: 'missing',
  }]);
});

test('wanted-release projection retains eligible policy selections and reports partial coverage from reconciliation', () => {
  const wantedReleases = buildLibraryWantedReleaseProjection({
    appUserId: 'user-1',
    artistPayload: buildArtistPayload(),
    libraryReleaseReconciliations: [{
      expectedTrackCount: 10,
      matchedTrackCount: 7,
      metadataReleaseId: 'release-policy',
      reconciliationStatus: 'partial',
    }, {
      expectedTrackCount: 12,
      matchedTrackCount: 12,
      metadataReleaseId: 'release-complete',
      reconciliationStatus: 'complete',
    }],
    monitoring: {
      isMonitored: true,
      monitoredReleaseGroupTypes: ['album'],
      releaseScope: 'current_and_future',
      wantedAutomationMode: 'current_and_future_matching',
    },
  });

  assert.equal(wantedReleases.length, 1);
  assert.deepEqual(wantedReleases[0], {
    appUserId: 'user-1',
    evidence: {
      monitoredReleaseGroupTypes: ['album'],
      reconciliationStatus: 'partial',
      releaseScope: 'current_and_future',
      selectionOrigin: null,
      selectionSource: 'policy',
      selectionState: 'selected',
      strategy: 'monitored_release_gap',
      wantedAutomationMode: 'current_and_future_matching',
    },
    expectedTrackCount: 10,
    matchedTrackCount: 7,
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'group-policy',
    metadataReleaseId: 'release-policy',
    missingTrackCount: 3,
    releaseDate: '2028-06-01',
    releaseStatus: 'Official',
    wantedStatus: 'partial',
  });
});

test('wanted reader reads each monitored artist through injected read boundaries', async (t) => {
  const queryable = { query: async () => ({ rows: [] }) };
  const listReconciliations = t.mock.fn(async ({ metadataReleaseIds }) => {
    assert.deepEqual(metadataReleaseIds.sort(), [
      'release-complete',
      'release-manual',
      'release-policy',
    ]);
    return [{
      expectedTrackCount: 12,
      matchedTrackCount: 12,
      metadataReleaseId: 'release-complete',
      reconciliationStatus: 'complete',
    }];
  });
  const reader = createLibraryWantedReleaseReader({
    getMetadataArtist: async ({ artistId, queryable: client }) => {
      assert.equal(client, queryable);
      assert.equal(artistId, 'artist-1');
      return buildArtistPayload();
    },
    listLibraryReleaseReconciliationsByMetadataReleaseIds: listReconciliations,
    listOperatorArtistMonitoringSnapshot: async () => [{
      appUserId: 'user-1',
      isMonitored: true,
      metadataArtistId: 'artist-1',
      monitoredReleaseGroupTypes: ['album'],
      releaseScope: 'current_and_future',
      wantedAutomationMode: 'current_and_future_matching',
    }],
    listOperatorReleaseGroupSelections: async ({ appUserId, metadataArtistId }) => {
      assert.equal(appUserId, 'user-1');
      assert.equal(metadataArtistId, 'artist-1');
      return [];
    },
    listOperatorTrackOverrides: async ({ appUserId, metadataArtistId }) => {
      assert.equal(appUserId, 'user-1');
      assert.equal(metadataArtistId, 'artist-1');
      return [];
    },
  });

  const result = await reader.readWantedReleaseProjection({ queryable });

  assert.equal(listReconciliations.mock.calls.length, 1);
  assert.deepEqual(result.wantedReleases, [{
      appUserId: 'user-1',
      evidence: {
        monitoredReleaseGroupTypes: ['album'],
        reconciliationStatus: 'missing',
        releaseScope: 'current_and_future',
        selectionOrigin: null,
        selectionSource: 'policy',
        selectionState: 'selected',
        strategy: 'monitored_release_absent',
        wantedAutomationMode: 'current_and_future_matching',
      },
      expectedTrackCount: 10,
      matchedTrackCount: 0,
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'group-policy',
      metadataReleaseId: 'release-policy',
      missingTrackCount: 10,
      releaseDate: '2028-06-01',
      releaseStatus: 'Official',
      wantedStatus: 'missing',
    }]);
});

test('wanted reader returns an empty projection when no monitored artists remain', async () => {
  const reader = createLibraryWantedReleaseReader({
    listOperatorArtistMonitoringSnapshot: async () => [],
  });

  const result = await reader.readWantedReleaseProjection({ queryable: { query: async () => ({ rows: [] }) } });

  assert.deepEqual(result.wantedReleases, []);
});

test('wanted reader tolerates a metadata artist removed during the projection run', async () => {
  const missingArtistError = Object.assign(new Error('Metadata artist was not found: artist-1'), {
    code: 'metadata_not_found',
    status: 404,
  });
  const reader = createLibraryWantedReleaseReader({
    getMetadataArtist: async () => {
      throw missingArtistError;
    },
    listOperatorArtistMonitoringSnapshot: async () => [{
      appUserId: 'user-1',
      isMonitored: true,
      metadataArtistId: 'artist-1',
    }],
    listOperatorReleaseGroupSelections: async () => [],
    listOperatorTrackOverrides: async () => [],
  });

  const result = await reader.readWantedReleaseProjection({ queryable: { query: async () => ({ rows: [] }) } });

  assert.deepEqual(result.wantedReleases, []);
});

function readerFixture(overrides = {}) {
  const queryable = { query: async () => ({ rows: [] }) };
  const monitoring = { appUserId: 'user-1', metadataArtistId: 'artist-1', isMonitored: true, isEnabled: false,
    monitoredReleaseGroupTypes: ['album'], releaseScope: 'current_and_future', wantedAutomationMode: 'current_and_future_matching',
    qualityProfile: { minimumQuality: 'high' }, updatedAt: '2026-10-10T01:00:00.000Z' };
  const artistPayload = buildArtistPayload(); const selections = []; const trackOverrides = [];
  const calls = [];
  const reader = createLibraryWantedReleaseReader({
    listOperatorArtistMonitoringSnapshot: async ({ queryable: client }) => { assert.equal(client, queryable); calls.push('monitoring'); return [monitoring]; },
    getMetadataArtist: async ({ artistId, queryable: client }) => { assert.equal(client, queryable); assert.equal(artistId, 'artist-1'); calls.push('metadata'); return artistPayload; },
    listOperatorReleaseGroupSelections: async ({ appUserId, metadataArtistId, queryable: client }) => {
      assert.equal(client, queryable); assert.equal(appUserId, 'user-1'); assert.equal(metadataArtistId, 'artist-1'); calls.push('selections'); return selections;
    },
    listOperatorTrackOverrides: async ({ appUserId, queryable: client }) => { assert.equal(client, queryable); assert.equal(appUserId, 'user-1'); calls.push('overrides'); return trackOverrides; },
    listLibraryReleaseReconciliationsByMetadataReleaseIds: async ({ queryable: client }) => { assert.equal(client, queryable); calls.push('availability'); return []; },
    ...overrides,
  });
  return { queryable, monitoring, artistPayload, selections, trackOverrides, calls, reader };
}

test('wanted reader uses one client for all nested inputs and preserves existing disabled-monitor semantics', async () => {
  const value = readerFixture(); const result = await value.reader.readWantedReleaseProjection({ queryable: value.queryable });
  assert.deepEqual(value.calls, ['monitoring', 'metadata', 'selections', 'overrides', 'availability']);
  assert.ok(result.wantedReleases.some((row) => row.metadataReleaseId === 'release-policy'));
  assert.equal(result.source.artists[0].monitoring.isEnabled, false);
  assert.equal(result.source.artists[0].monitoring.qualityProfile.minimumQuality, 'high');
  assert.equal(Object.hasOwn(result.source.artists[0].monitoring, 'updatedAt'), false);
});

test('wanted reader captures monitoring before metadata awaits and metadata inputs before availability awaits', async () => {
  let value;
  value = readerFixture({
    getMetadataArtist: async () => {
      await Promise.resolve(); value.monitoring.qualityProfile.minimumQuality = 'lossless'; value.monitoring.monitoredReleaseGroupTypes.push('single');
      return value.artistPayload;
    },
    listLibraryReleaseReconciliationsByMetadataReleaseIds: async () => {
      await Promise.resolve(); value.artistPayload.releases[0].trackCount = 999;
      value.selections.push({ metadataReleaseGroupId: 'group-policy', selectionState: 'excluded' });
      value.trackOverrides.push({ metadataReleaseId: 'release-policy', included: false }); return [];
    },
  });
  const result = await value.reader.readWantedReleaseProjection({ queryable: value.queryable });
  const source = result.source.artists[0];
  assert.equal(source.monitoring.qualityProfile.minimumQuality, 'high'); assert.deepEqual(source.monitoring.monitoredReleaseGroupTypes, ['album']);
  assert.equal(source.artistPayload.releases[0].trackCount, 10); assert.deepEqual(source.releaseGroupSelections, []); assert.deepEqual(source.trackOverrides, []);
  assert.equal(result.wantedReleases.find((row) => row.metadataReleaseId === 'release-policy').expectedTrackCount, 10);
  assert.equal(Object.isFrozen(source.artistPayload.releases), true);
});

test('only an exact metadata-not-found artist read is tolerated, while selection/availability and real failures escape', async () => {
  for (const boundary of ['getMetadataArtist', 'listOperatorReleaseGroupSelections', 'listOperatorTrackOverrides', 'listLibraryReleaseReconciliationsByMetadataReleaseIds']) {
    for (const failure of [Object.assign(new Error('Missing'), { status: 404, code: 'metadata_not_found' }),
      Object.assign(new Error('Unrelated'), { status: 404, code: 'other_not_found' }), new Error('Database unavailable')]) {
      const value = readerFixture({ [boundary]: async () => { throw failure; } });
      if (boundary === 'getMetadataArtist' && failure.code === 'metadata_not_found') {
        assert.deepEqual((await value.reader.readWantedReleaseProjection({ queryable: value.queryable })).wantedReleases, []);
      } else await assert.rejects(value.reader.readWantedReleaseProjection({ queryable: value.queryable }), (error) => error === failure);
    }
  }
});

test('malformed reader input arrays and missing client fail instead of becoming an empty cleanup source', async () => {
  for (const boundary of ['listOperatorArtistMonitoringSnapshot', 'listOperatorReleaseGroupSelections', 'listOperatorTrackOverrides', 'listLibraryReleaseReconciliationsByMetadataReleaseIds']) {
    const value = readerFixture({ [boundary]: async () => null });
    await assert.rejects(value.reader.readWantedReleaseProjection({ queryable: value.queryable }), { code: 'library_wanted_projection_invalid' });
  }
  for (const payload of [null, {}, { artist: { id: 'another-artist' }, releaseGroups: [], releases: [] }]) {
    const value = readerFixture({ getMetadataArtist: async () => payload });
    await assert.rejects(value.reader.readWantedReleaseProjection({ queryable: value.queryable }), { code: 'library_wanted_projection_invalid' });
  }
  const value = readerFixture(); await assert.rejects(value.reader.readWantedReleaseProjection({ queryable: {} }), TypeError);
});

test('wanted reader does not overlap queries on one client across artists or policy reads', async () => {
  const uuid = (value) => `70000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
  const appUserId = uuid(1); const artistIds = [uuid(2), uuid(3)];
  let active = false; let maximumActive = 0; const calls = [];
  const queryable = { async query(kind, args = []) {
    if (active) throw new Error('The same PostgreSQL client received an overlapping query');
    active = true; maximumActive = Math.max(maximumActive, 1); calls.push({ kind, args });
    try {
      await new Promise((done) => { setImmediate(done); });
      if (kind === 'monitoring') return { rows: artistIds.map((metadataArtistId) => ({ appUserId, metadataArtistId, isMonitored: true,
        monitoredReleaseGroupTypes: ['album'], releaseScope: 'current_and_future', wantedAutomationMode: 'current_and_future_matching' })) };
      if (kind === 'artist') {
        const index = artistIds.indexOf(args[0]);
        return { rows: [{ artist: { id: args[0] }, releaseGroups: [{ id: uuid(10 + index), primaryType: 'album', title: 'Album' }],
          releases: [{ id: uuid(20 + index), releaseGroupId: uuid(10 + index), title: 'Album', isCanonical: true,
            trackCount: 10, releaseDate: '2028-06-01', status: 'Official' }] }] };
      }
      return { rows: [] };
    } finally { active = false; }
  } };
  const reader = createLibraryWantedReleaseReader({
    listOperatorArtistMonitoringSnapshot: async ({ queryable: client }) => (await client.query('monitoring')).rows,
    getMetadataArtist: async ({ artistId, queryable: client }) => (await client.query('artist', [artistId])).rows[0],
    listOperatorReleaseGroupSelections: async ({ metadataArtistId, queryable: client }) => (await client.query('selections', [metadataArtistId])).rows,
    listOperatorTrackOverrides: async ({ metadataArtistId, queryable: client }) => (await client.query('overrides', [metadataArtistId])).rows,
    listLibraryReleaseReconciliationsByMetadataReleaseIds: async ({ metadataReleaseIds, queryable: client }) => (await client.query('availability', metadataReleaseIds)).rows,
  });
  const result = await reader.readWantedReleaseProjection({ queryable });
  assert.equal(maximumActive, 1); assert.equal(active, false); assert.equal(result.wantedReleases.length, 2);
  assert.deepEqual(result.wantedReleases.map((row) => row.metadataArtistId).sort(), artistIds);
  assert.equal(calls.filter((call) => call.kind === 'artist').length, 2);
  assert.equal(calls.filter((call) => call.kind === 'selections').length, 2);
  assert.equal(calls.filter((call) => call.kind === 'overrides').length, 2);
  assert.equal(calls.filter((call) => call.kind === 'availability').length, 2);
});

test('default wanted metadata composition does not overlap release-group and release queries on its client', async () => {
  const uuid = (value) => `71000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
  const appUserId = uuid(1); const artistId = uuid(2); const groupId = uuid(10); const releaseId = uuid(20);
  let active = false; const calls = [];
  const queryable = { async query(sql) {
    if (active) throw new Error('Nested metadata reads overlapped on the same PostgreSQL client');
    active = true;
    try {
      await new Promise((done) => { setImmediate(done); });
      if (sql === 'monitoring') { calls.push('monitoring'); return { rows: [{ appUserId, metadataArtistId: artistId, isMonitored: true,
        monitoredReleaseGroupTypes: ['album'], releaseScope: 'current_and_future', wantedAutomationMode: 'current_and_future_matching' }] }; }
      if (/FROM metadata_artists/u.test(sql)) { calls.push('artist'); return { rows: [{ id: artistId, name: 'Artist', sort_name: 'Artist' }] }; }
      if (/FROM metadata_release_groups/u.test(sql)) { calls.push('groups'); return { rows: [{ id: groupId,
        metadata_artist_id: artistId, primary_type: 'album', title: 'Album', release_count: 1 }] }; }
      if (/FROM metadata_releases/u.test(sql)) { calls.push('releases'); return { rows: [{ id: releaseId,
        metadata_release_group_id: groupId, title: 'Album', is_canonical: true, release_date: '2028-06-01', track_count: 10, status: 'Official' }] }; }
      if (['selections', 'overrides', 'availability'].includes(sql)) { calls.push(sql); return { rows: [] }; }
      assert.fail(`Unexpected lookup outside the narrow metadata projection: ${sql}`);
    } finally { active = false; }
  } };
  const reader = createLibraryWantedReleaseReader({
    listOperatorArtistMonitoringSnapshot: async ({ queryable: client }) => (await client.query('monitoring')).rows,
    listOperatorReleaseGroupSelections: async ({ queryable: client }) => (await client.query('selections')).rows,
    listOperatorTrackOverrides: async ({ queryable: client }) => (await client.query('overrides')).rows,
    listLibraryReleaseReconciliationsByMetadataReleaseIds: async ({ queryable: client }) => (await client.query('availability')).rows,
  });
  const result = await reader.readWantedReleaseProjection({ queryable });
  assert.equal(active, false); assert.equal(result.wantedReleases.length, 1);
  assert.equal(result.wantedReleases[0].metadataReleaseId, releaseId);
  assert.deepEqual(calls, ['monitoring', 'artist', 'groups', 'releases', 'selections', 'overrides', 'availability']);
});
