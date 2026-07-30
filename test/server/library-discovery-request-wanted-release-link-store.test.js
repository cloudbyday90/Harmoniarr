import assert from 'node:assert/strict';
import test from 'node:test';

import { createLibraryDiscoveryRequestWantedReleaseLinkStore } from '../../src/server/library/library-discovery-request-wanted-release-link-store.js';

test('syncActiveWantedReleaseLinks removes stale links and restores every active operator link', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createLibraryDiscoveryRequestWantedReleaseLinkStore();

  await store.syncActiveWantedReleaseLinks({ client: { query } });

  assert.equal(query.mock.callCount(), 2);
  assert.match(query.mock.calls[0].arguments[0], /DELETE FROM library_discovery_request_wanted_release_links/u);
  assert.match(query.mock.calls[0].arguments[0], /wanted_status IN \('missing', 'partial'\)/u);
  assert.match(query.mock.calls[1].arguments[0], /INSERT INTO library_discovery_request_wanted_release_links/u);
  assert.match(query.mock.calls[1].arguments[0], /ON CONFLICT \(discovery_request_id, wanted_release_id\) DO NOTHING/u);
});
