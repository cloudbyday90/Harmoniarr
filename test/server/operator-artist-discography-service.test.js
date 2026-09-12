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
import { createOperatorArtistDiscographyService } from '../../src/server/metadata/operator-artist-discography-service.js';
import { createOperatorArtistDiscographyStore } from '../../src/server/metadata/operator-artist-discography-store.js';

const releaseGroups = [{ id: 'album', primaryType: 'Album' }, { id: 'ep', primaryType: 'EP' }];

test('operator page enrichment scopes reads and preserves canonical/manual selection and review semantics', async () => {
  let scope;
  const service = createOperatorArtistDiscographyService({
    catalogService: { getArtistDiscography: async (options) => {
      assert.deepEqual(options, { metadataArtistId: 'artist', limit: 2, cursor: 'next' });
      return { releaseGroups, pageInfo: { hasMore: true, nextCursor: 'later' } };
    } },
    store: { readPageState: async (options) => {
      scope = options;
      return { monitoredReleaseGroupTypes: ['album'],
        releaseGroupSelections: [{ metadataReleaseGroupId: 'album', resolvedMetadataReleaseId: 'manual-edition', selectionState: 'partial', selectionOrigin: 'manual_edition' }],
        trackOverrides: [{ metadataReleaseGroupId: 'album', isDesired: false, remapStatus: 'review_needed' }],
        releases: [{ id: 'canonical', releaseGroupId: 'album', isCanonical: true },
          { id: 'manual-edition', releaseGroupId: 'album', isCanonical: false }] };
    } },
  });
  const result = await service.getOperatorArtistDiscography({ appUserId: 'operator', metadataArtistId: 'artist', limit: 2, cursor: 'next' });
  assert.deepEqual(scope, { appUserId: 'operator', metadataArtistId: 'artist', releaseGroupIds: ['album', 'ep'] });
  const album = result.releaseGroups[0].operatorState;
  assert.equal(album.selectionState, 'partial');
  assert.equal(album.selectionOrigin, 'manual_edition');
  assert.equal(album.resolvedRelease.id, 'manual-edition');
  assert.equal(album.trackOverrideSummary.reviewNeededCount, 1);
  assert.equal(result.releaseGroups[1].operatorState.selectionState, 'unselected');
  assert.deepEqual(result.pageInfo, { hasMore: true, nextCursor: 'later' });
  assert.deepEqual(Object.keys(result).sort(), ['pageInfo', 'releaseGroups']);
});

test('operator page defaults use the same policy and canonical edition as global projection', async () => {
  const service = createOperatorArtistDiscographyService({
    catalogService: { getArtistDiscography: async () => ({ releaseGroups: releaseGroups.slice(0, 1), pageInfo: { hasMore: false, nextCursor: null } }) },
    store: { readPageState: async () => ({ releaseGroupSelections: [], trackOverrides: [], releases: [{ id: 'canonical', releaseGroupId: 'album', isCanonical: true }] }) },
  });
  const result = await service.getOperatorArtistDiscography({ appUserId: 'user', metadataArtistId: 'artist' });
  assert.equal(result.releaseGroups[0].operatorState.selectionSource, 'policy');
  assert.equal(result.releaseGroups[0].operatorState.selectionState, 'selected');
  assert.equal(result.releaseGroups[0].operatorState.resolvedRelease.id, 'canonical');
});

test('empty pages avoid operator hydration and missing actor fails before catalog access', async () => {
  let catalogReads = 0;
  const service = createOperatorArtistDiscographyService({
    catalogService: { getArtistDiscography: async () => { catalogReads += 1; return { releaseGroups: [], pageInfo: { hasMore: false, nextCursor: null } }; } },
    store: { readPageState: async () => { throw new Error('Must not hydrate empty page'); } },
  });
  await assert.rejects(service.getOperatorArtistDiscography({ metadataArtistId: 'artist' }), { status: 401 });
  assert.equal(catalogReads, 0);
  assert.equal((await service.getOperatorArtistDiscography({ appUserId: 'user', metadataArtistId: 'artist' })).releaseGroups.length, 0);
});

test('page state SQL binds actor, artist and page IDs and hydrates only canonical or explicitly resolved editions', async () => {
  const calls = [];
  const store = createOperatorArtistDiscographyStore({ getPoolFn: () => ({ query: async (sql, values) => {
    calls.push({ sql, values });
    return { rows: [] };
  } }) });
  await store.readPageState({ appUserId: 'operator', metadataArtistId: 'artist', releaseGroupIds: ['first', 'second'] });
  assert.equal(calls.length, 4);
  for (const call of calls) {
    assert.deepEqual(call.values.slice(0, 2), ['operator', 'artist']);
    if (call.values.length === 3) {
      assert.deepEqual(call.values[2], ['first', 'second']);
      assert.match(call.sql, /ANY\(\$3::uuid\[\]\)/u);
    }
  }
  const editionSql = calls.find(({ sql }) => sql.includes('metadata_releases')).sql;
  assert.match(editionSql, /release\.is_canonical OR EXISTS/u);
  assert.match(editionSql, /selection\.app_user_id = \$1/u);
  assert.match(editionSql, /selection\.resolved_metadata_release_id = release\.id/u);
  assert.match(editionSql, /selection\.metadata_release_group_id = release_group\.id/u);
});
