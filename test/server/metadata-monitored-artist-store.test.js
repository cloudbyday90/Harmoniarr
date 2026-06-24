import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataMonitoredArtistStore } from '../../src/server/metadata/metadata-monitored-artist-store.js';

test('listMonitoredArtistsForArtwork reads canonical operator monitoring and never the legacy table', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [
      { metadata_artist_id: 'artist-1', musicbrainz_artist_id: 'mb-1', name: 'Autechre' },
      { metadata_artist_id: 'artist-2', musicbrainz_artist_id: null, name: 'Local Only' },
    ],
  }));
  const store = createMetadataMonitoredArtistStore({ getPoolFn: () => ({ query }) });

  const result = await store.listMonitoredArtistsForArtwork({ limit: 50 });

  const [sql, params] = query.mock.calls[0].arguments;
  assert.match(sql, /FROM operator_artist_monitoring/);
  assert.match(sql, /WHERE operator_artist_monitoring\.is_monitored = TRUE/);
  assert.match(sql, /GROUP BY/);
  assert.doesNotMatch(sql, /metadata_artist_monitoring/);
  assert.deepEqual(params, [50]);
  assert.deepEqual(result, [
    { metadataArtistId: 'artist-1', musicbrainzArtistId: 'mb-1', name: 'Autechre' },
    { metadataArtistId: 'artist-2', musicbrainzArtistId: null, name: 'Local Only' },
  ]);
});

test('listMonitoredArtistsForArtwork normalizes a non-positive limit to the default', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createMetadataMonitoredArtistStore({ getPoolFn: () => ({ query }) });

  await store.listMonitoredArtistsForArtwork({ limit: 0 });

  assert.deepEqual(query.mock.calls[0].arguments[1], [25]);
});

test('listAdminMonitoredArtists aggregates operator scope and refresh state without the legacy table', async (t) => {
  const dataRow = {
    id: 'artist-1',
    name: 'Autechre',
    sort_name: 'Autechre',
    disambiguation: 'UK',
    country: 'GB',
    artist_type: 'Group',
    musicbrainz_artist_id: 'mb-1',
    monitored_at: new Date('2026-06-15T10:00:00.000Z'),
    monitoring_operator_count: 2,
    monitored_release_group_types: ['album', 'ep', 'single'],
    monitored_by_user_id: 'user-1',
    last_refreshed_at: new Date('2026-06-20T08:00:00.000Z'),
    monitored_by_username: 'admin',
  };
  const query = t.mock.fn(async (sql) => {
    if (/COUNT\(\*\)/.test(sql)) {
      return { rows: [{ total: 1 }] };
    }
    return { rows: [dataRow] };
  });
  const store = createMetadataMonitoredArtistStore({ getPoolFn: () => ({ query }) });

  const result = await store.listAdminMonitoredArtists({
    search: undefined,
    sort: 'last_refreshed',
    limit: 25,
    offset: 0,
  });

  const countSql = query.mock.calls[0].arguments[0];
  const dataSql = query.mock.calls[1].arguments[0];

  // Both queries derive scope from operator monitoring + refresh state.
  assert.match(countSql, /WITH operator_scope AS/);
  assert.match(countSql, /FROM operator_artist_monitoring/);
  assert.match(dataSql, /LEFT JOIN metadata_artist_refresh_state/);
  assert.match(dataSql, /CROSS JOIN LATERAL unnest\(operator_artist_monitoring\.monitored_release_group_types\)/);
  assert.doesNotMatch(dataSql, /metadata_artist_monitoring/);
  // No search -> neutral WHERE TRUE, params are just [limit, offset].
  assert.match(dataSql, /WHERE TRUE/);
  assert.match(dataSql, /ORDER BY metadata_artist_refresh_state\.last_refreshed_at DESC NULLS LAST/);
  assert.deepEqual(query.mock.calls[1].arguments[1], [25, 0]);

  assert.deepEqual(result, {
    results: [{
      artistType: 'Group',
      country: 'GB',
      disambiguation: 'UK',
      id: 'mb-1',
      lastRefreshedAt: '2026-06-20T08:00:00.000Z',
      localId: 'artist-1',
      monitoredAt: '2026-06-15T10:00:00.000Z',
      monitoredByUserId: 'user-1',
      monitoredByUsername: 'admin',
      monitoredReleaseGroupTypes: ['album', 'ep', 'single'],
      monitoringOperatorCount: 2,
      name: 'Autechre',
      sortName: 'Autechre',
    }],
    limit: 25,
    offset: 0,
    total: 1,
  });
});

test('listAdminMonitoredArtists parameterizes search text rather than interpolating it', async (t) => {
  const query = t.mock.fn(async (sql) => {
    if (/COUNT\(\*\)/.test(sql)) {
      return { rows: [{ total: 0 }] };
    }
    return { rows: [] };
  });
  const store = createMetadataMonitoredArtistStore({ getPoolFn: () => ({ query }) });

  await store.listAdminMonitoredArtists({
    search: '  Autechre  ',
    sort: 'name',
    limit: 10,
    offset: 5,
  });

  const countSql = query.mock.calls[0].arguments[0];
  const [dataSql, dataParams] = query.mock.calls[1].arguments;

  // The count query must carry its own operator_scope CTE definition.
  assert.match(countSql, /WITH operator_scope AS/);
  // Search value is bound, not concatenated raw into SQL.
  assert.match(dataSql, /ILIKE '%' \|\| \$1 \|\| '%'/);
  assert.deepEqual(dataParams, ['Autechre', 10, 5]);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['Autechre']);
});

test('listAdminMonitoredArtists falls back to name sort for an unknown sort key', async (t) => {
  const query = t.mock.fn(async (sql) => {
    if (/COUNT\(\*\)/.test(sql)) {
      return { rows: [{ total: 0 }] };
    }
    return { rows: [] };
  });
  const store = createMetadataMonitoredArtistStore({ getPoolFn: () => ({ query }) });

  await store.listAdminMonitoredArtists({ sort: 'DROP TABLE' });

  assert.match(query.mock.calls[1].arguments[0], /ORDER BY metadata_artists\.name ASC/);
});

test('listAdminMonitoredArtists maps a null release-type aggregate to the default set', async (t) => {
  const query = t.mock.fn(async (sql) => ({
    rows: [{
      id: 'artist-1',
      name: 'Autechre',
      sort_name: 'Autechre',
      disambiguation: null,
      country: null,
      artist_type: null,
      musicbrainz_artist_id: null,
      monitored_at: null,
      monitoring_operator_count: 1,
      monitored_release_group_types: null,
      monitored_by_user_id: 'user-1',
      last_refreshed_at: null,
      monitored_by_username: null,
    }],
  }));
  const store = createMetadataMonitoredArtistStore({ getPoolFn: () => ({ query }) });

  const result = await store.listAdminMonitoredArtists();

  // Without a MusicBrainz id, id falls back to the stringified local id.
  assert.equal(result.results[0].id, 'artist-1');
  assert.deepEqual(result.results[0].monitoredReleaseGroupTypes, ['album', 'ep']);
  assert.equal(result.results[0].monitoringOperatorCount, 1);
  assert.equal(result.total, 0);
});

test('getArtistMonitoringStatus assembles canonical status from operator monitoring and refresh state', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      is_monitored: true,
      monitored_release_group_types: ['album', 'ep', 'single'],
      last_refreshed_at: new Date('2026-06-20T08:00:00.000Z'),
      next_refresh_at: new Date('2026-06-27T08:00:00.000Z'),
    }],
  }));
  const store = createMetadataMonitoredArtistStore({ getPoolFn: () => ({ query }) });

  const result = await store.getArtistMonitoringStatus('artist-1');

  const [sql, params] = query.mock.calls[0].arguments;
  assert.match(sql, /EXISTS \(/);
  assert.match(sql, /FROM operator_artist_monitoring/);
  assert.match(sql, /CROSS JOIN LATERAL unnest\(operator_artist_monitoring\.monitored_release_group_types\)/);
  assert.match(sql, /FROM metadata_artist_refresh_state/);
  assert.doesNotMatch(sql, /metadata_artist_monitoring/);
  assert.deepEqual(params, ['artist-1']);
  assert.deepEqual(result, {
    isMonitored: true,
    lastRefreshedAt: '2026-06-20T08:00:00.000Z',
    monitoredReleaseGroupTypes: ['album', 'ep', 'single'],
    nextRefreshAt: '2026-06-27T08:00:00.000Z',
  });
});

test('getArtistMonitoringStatus returns conservative defaults for an unmonitored artist with no refresh state', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      is_monitored: false,
      monitored_release_group_types: null,
      last_refreshed_at: null,
      next_refresh_at: null,
    }],
  }));
  const store = createMetadataMonitoredArtistStore({ getPoolFn: () => ({ query }) });

  const result = await store.getArtistMonitoringStatus('artist-2');

  assert.deepEqual(result, {
    isMonitored: false,
    lastRefreshedAt: null,
    monitoredReleaseGroupTypes: ['album', 'ep'],
    nextRefreshAt: null,
  });
});
