import assert from 'node:assert/strict';
import test from 'node:test';

import { createLibraryMediaRequestStore } from '../../src/server/library/library-media-request-store.js';

test('library media request store joins matched artists through release groups', async (t) => {
  const query = t.mock.fn(async (_sql, params) => {
    if (params.length > 1) {
      return {
        rows: [{
          id: 'request-1',
        }],
      };
    }

    return {
      rows: [{
        artist_name: 'Autechre',
        created_at: '2026-05-04T00:00:00.000Z',
        evidence: {},
        id: 'request-1',
        matched_artist_name: 'Autechre',
        matched_metadata_release_group_id: 'group-1',
        matched_metadata_release_id: 'release-1',
        matched_release_group_id: 'group-1',
        matched_release_group_title: 'Amber',
        matched_release_title: 'Amber',
        normalized_query: 'autechre amber',
        notes: null,
        release_title: 'Amber',
        request_kind: 'release',
        request_state: 'needs_fetch',
        requested_by_role: 'admin',
        requested_by_user_id: 'admin-1',
        requested_by_username: 'smoke-admin',
        requested_for_role: 'requester',
        requested_for_user_id: 'user-1',
        requested_for_username: 'smoke-listener',
        source_provider: null,
        source_url: null,
        track_title: null,
        updated_at: '2026-05-04T00:00:00.000Z',
      }],
    };
  });
  const store = createLibraryMediaRequestStore({
    getPoolFn: () => ({ query }),
  });

  const mediaRequest = await store.createMediaRequest({
    artistName: 'Autechre',
    evidence: {},
    matchedMetadataReleaseGroupId: 'group-1',
    matchedMetadataReleaseId: 'release-1',
    normalizedQuery: 'autechre amber',
    notes: null,
    releaseTitle: 'Amber',
    requestKind: 'release',
    requestState: 'needs_fetch',
    requestedByUserId: 'admin-1',
    requestedForUserId: 'user-1',
    sourceProvider: null,
    sourceUrl: null,
    trackTitle: null,
  });

  assert.equal(query.mock.callCount(), 2);
  assert.match(query.mock.calls[0].arguments[0], /INSERT INTO media_requests/);
  assert.match(query.mock.calls[1].arguments[0], /matched_artists\.id = matched_release_groups\.metadata_artist_id/);
  assert.doesNotMatch(query.mock.calls[1].arguments[0], /matched_releases\.metadata_artist_id/);
  assert.deepEqual(query.mock.calls[1].arguments[1], ['request-1']);
  assert.equal(mediaRequest.existingMatch.artistName, 'Autechre');
  assert.equal(mediaRequest.existingMatch.releaseId, 'release-1');
});