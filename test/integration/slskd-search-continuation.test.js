import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createSlskdSearchContinuationService } from '../../src/server/slskd/slskd-search-continuation-service.js';
import { createSlskdSearchIntentStore } from '../../src/server/slskd/slskd-search-intent-store.js';
import { createLibraryDiscoverySearchAuthorityStore } from '../../src/server/library/library-discovery-search-authority-store.js';
import { createLibraryDiscoverySearchService } from '../../src/server/library/library-discovery-search-service.js';

test('PostgreSQL reserves one search across concurrent workers, uncertain acceptance and recreated owners', { timeout: 120_000 }, async () => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn(); const metadata = await seedMetadataReleaseFixture({ queryable: pool });
    const marker = '2026-10-20T12:00:00+00:00';
    const inserted = await pool.query(`INSERT INTO library_discovery_requests
      (metadata_artist_id,metadata_release_group_id,metadata_release_id,wanted_status,search_mode,request_status,evidence)
      VALUES ($1,$2,$3,'missing','automatic','cooldown',$4::jsonb) RETURNING id`,
    [metadata.metadataArtistId, metadata.metadataReleaseGroupId, metadata.metadataReleaseId, JSON.stringify({ lastDispatchAttemptedAt: marker })]);
    const discoveryRequestId = inserted.rows[0].id;
    const claimedRequest = { discoveryRequestId, metadataReleaseId: metadata.metadataReleaseId, searchAttemptCount: 0,
      evidence: { lastDispatchAttemptedAt: marker } };
    const authorityStore = createLibraryDiscoverySearchAuthorityStore({ getPoolFn });
    const provider = new Map(); let postCount = 0;
    let releasePost; let signalPost;
    const postHeld = new Promise(resolve => { releasePost = resolve; });
    const postEntered = new Promise(resolve => { signalPost = resolve; });
    const failure = new Error('Accepted response lost'); let loseResponse = false;
    const slskdService = { getSearchBinding: async () => 'a'.repeat(64),
      startSearch: async ({ id, query }) => {
        const saved = (await pool.query('SELECT evidence FROM library_discovery_requests WHERE id=$1', [discoveryRequestId])).rows[0];
        assert.equal(saved.evidence.searchContinuation.state, 'pending');
        assert.ok((await pool.query('SELECT id FROM slskd_search_intents WHERE id=$1', [id])).rows[0]);
        postCount++; const search = { id, query }; provider.set(id, search);
        if (postCount === 1) { signalPost(); await postHeld; }
        if (loseResponse) throw failure; return search;
      },
      getSearchState: async ({ searchId }) => { assert.ok(provider.has(searchId)); return provider.get(searchId); } };
    const create = () => createLibraryDiscoverySearchService({ authorityStore,
      continuationService: createSlskdSearchContinuationService({ slskdService, withTransaction: createDatabaseTransactionRunner({ getPoolFn }) }) });
    const input = { claimedRequest, query: 'Owned Artist Album', context: { scope: null }, assertCurrent: async () => {} };
    const first = create().startSearch(input);
    await Promise.race([postEntered, first.then(() => assert.fail('Search must reach the held POST'), error => { throw error; })]);
    let both;
    try {
      const second = await create().startSearch(input); releasePost();
      both = [await first, second];
    } catch (error) {
      releasePost(); await first.catch(() => {}); throw error;
    } finally { releasePost(); }
    assert.equal(both[0].id, both[1].id); assert.equal(postCount, 1);
    assert.equal((await pool.query('SELECT count(*)::int count FROM slskd_search_intents')).rows[0].count, 1);
    loseResponse = true;
    const changed = { ...input, context: { scope: ['track'], newIntent: true } };
    await assert.rejects(create().startSearch(changed), error => error === failure);
    loseResponse = false;
    const resumed = await create().startSearch(changed);
    assert.equal(resumed.resumed, true); assert.equal(postCount, 2);
    assert.equal((await pool.query('SELECT count(*)::int count FROM slskd_search_intents WHERE accepted_at IS NOT NULL')).rows[0].count, 2);
    await pool.query("UPDATE library_discovery_requests SET evidence=evidence||'{\"lastDispatchAttemptedAt\":\"replaced\"}'::jsonb WHERE id=$1", [discoveryRequestId]);
    await assert.rejects(create().startSearch(input), { code: 'operation_run_cancelled' });
    assert.equal(postCount, 2);
    const store = createSlskdSearchIntentStore(); const rollbackId = randomUUID();
    await assert.rejects(createDatabaseTransactionRunner({ getPoolFn })(async queryable => {
      await store.reserve({ queryable, owner: { discoveryRequestId }, intentFingerprint: 'c'.repeat(64), providerFingerprint: 'a'.repeat(64),
        searchId: rollbackId, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString() });
      throw failure;
    }), error => error === failure);
    assert.equal((await pool.query('SELECT count(*)::int count FROM slskd_search_intents WHERE id=$1', [rollbackId])).rows[0].count, 0);
    await pool.query('DELETE FROM library_discovery_requests WHERE id=$1', [discoveryRequestId]);
    assert.equal((await pool.query('SELECT count(*)::int count FROM slskd_search_intents')).rows[0].count, 0);
  } });
});
