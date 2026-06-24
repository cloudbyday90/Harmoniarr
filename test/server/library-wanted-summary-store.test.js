import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryWantedSummaryStore } from '../../src/server/library/library-wanted-summary-store.js';

test('getLibraryWantedSnapshot counts operator monitored artist scope without legacy monitoring reads', async (t) => {
  const query = t.mock.fn(async (sql, params) => {
    assert.deepEqual(params, ['user-1']);
    if (sql.includes('monitored_artist_count')) {
      return {
        rows: [{
          monitored_artist_count: 2,
        }],
      };
    }

    return {
      rows: [{
        last_reconciled_at: '2026-06-13T12:00:00.000Z',
        missing_release_count: 3,
        partial_release_count: 1,
        total_wanted_release_count: 4,
      }],
    };
  });
  const store = createLibraryWantedSummaryStore({
    getPoolFn: () => ({
      query,
    }),
  });

  const snapshot = await store.getLibraryWantedSnapshot({ appUserId: 'user-1' });

  const monitoredArtistSql = query.mock.calls
    .map((call) => call.arguments[0])
    .find((sql) => sql.includes('monitored_artist_count'));
  assert.match(monitoredArtistSql, /operator_artist_monitoring/);
  assert.match(monitoredArtistSql, /app_user_id = \$1/);
  assert.match(monitoredArtistSql, /release_scope <> 'track_only'/);
  assert.match(monitoredArtistSql, /wanted_automation_mode <> 'manual_only'/);
  assert.doesNotMatch(monitoredArtistSql, /metadata_artist_monitoring/);
  const releaseCountsSql = query.mock.calls
    .map((call) => call.arguments[0])
    .find((sql) => sql.includes('total_wanted_release_count'));
  assert.match(releaseCountsSql, /FROM library_wanted_releases/);
  assert.match(releaseCountsSql, /app_user_id = \$1/);
  assert.deepEqual(snapshot, {
    lastReconciledAt: '2026-06-13T12:00:00.000Z',
    monitoredArtistCount: 2,
    releaseCounts: {
      missing: 3,
      partial: 1,
      totalWanted: 4,
    },
  });
});
