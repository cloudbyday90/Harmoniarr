import assert from 'node:assert/strict';
import { before, after, suite, test } from 'node:test';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { bootstrapAdminSession, loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { seedMissingMusicPaginationRows } from '../../testing/integration/missing-music-pagination-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';
import { createLibraryDiscoveryRequestStore } from '../../src/server/library/library-discovery-request-store.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const counts = { provider: 'slskd', candidateCount: 0, responseCount: 4, responseFileCount: 10,
  ignoredUserResponseCount: 2, blacklistedFileCount: 3, missingUsernameResponseCount: 1, malformedFileCount: 2 };
suite('Missing Music scoped search diagnostic reads', () => {
  before(async () => { runtime = await createIntegrationAppRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('own/admin/disabled history is bounded, unrelated targets are refused and reads preserve search authority', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async c => {
      await bootstrapAdminSession(c.client); const pool = c.getPoolFn();
      async function requester(username) {
        const created = await c.client.requestJson('/api/v1/users', { method: 'POST', json: { username, password: 'CountsTestPass123!', role: 'requester' } });
        assert.equal(created.response.status, 201);
        const user = created.payload.user;
        await pool.query('UPDATE app_users SET must_change_password=false WHERE id=$1', [user.id]);
        const client = createSessionHttpClient(c.baseUrl);
        await loginWithPassword(client, { username, password: 'CountsTestPass123!' }); return { user, client };
      }
      const owner = await requester('counts-owner'), outsider = await requester('counts-outsider');
      const fixture = await seedMissingMusicPaginationRows({ queryable: pool, appUserId: owner.user.id, count: 1 });
      const id = fixture.rows[0].id;
      const inserted = await pool.query(`INSERT INTO library_discovery_requests
        (metadata_artist_id,metadata_release_group_id,metadata_release_id,wanted_status,search_mode,request_status,
          search_attempt_count,research_attempt_count,next_search_after,evidence)
        SELECT metadata_artist_id,metadata_release_group_id,metadata_release_id,'missing','automatic','cooldown',1,0,
          '2050-01-01'::timestamptz,'{}'::jsonb FROM library_wanted_releases WHERE id=$1 RETURNING id,metadata_release_id`, [id]);
      const discovery = inserted.rows[0];
      await pool.query('INSERT INTO library_discovery_request_wanted_release_links(discovery_request_id,wanted_release_id) VALUES($1,$2)', [discovery.id, id]);
      await createLibraryDiscoveryRequestStore().recordDiscoverySearchSuccess({ metadataReleaseId: discovery.metadata_release_id,
        searchId: 'private-search-id', searchQuery: 'private-query', candidateCount: 0, fileCount: 0,
        ingestionDiagnostics: { ...counts, reasonCodes: ['private-reason'], username: 'private-peer', path: '/private/file' } });
      const path = `/api/v1/missing-music/decisions/${id}`;
      const read = async client => { const result = await client.requestJson(path); assert.equal(result.response.status, 200); return result.payload; };
      const openingSchedule = (await pool.query('SELECT search_attempt_count,research_attempt_count,next_search_after FROM library_discovery_requests WHERE id=$1', [discovery.id])).rows[0];
      const operationCount = (await pool.query('SELECT count(*)::int AS n FROM operation_runs')).rows[0].n;
      const own = await read(owner.client), admin = await read(c.client);
      assert.deepEqual(own.searchDiagnostics, counts); assert.deepEqual(admin.searchDiagnostics, counts);
      assert.doesNotMatch(JSON.stringify(own), /private-/);
      assert.equal(own.permissions.canSearchAgain, false);
      assert.equal((await outsider.client.requestJson(path)).response.status, 404);
      assert.equal((await createSessionHttpClient(c.baseUrl).requestJson(path)).response.status, 401);
      await pool.query("UPDATE library_discovery_requests SET request_status='ready' WHERE id=$1", [discovery.id]);
      assert.equal((await read(c.client)).searchDiagnostics, null);
      await pool.query("UPDATE library_discovery_requests SET request_status='cooldown' WHERE id=$1", [discovery.id]);
      for (const extra of [{ lastDispatchFailure: { code: 'slskd_unavailable' } }, { searchContinuation: { state: 'reserved' } }]) {
        await pool.query('UPDATE library_discovery_requests SET evidence=evidence||$2::jsonb WHERE id=$1', [discovery.id, JSON.stringify(extra)]);
        assert.equal((await read(c.client)).searchDiagnostics, null);
        await pool.query("UPDATE library_discovery_requests SET evidence=evidence-'lastDispatchFailure'-'searchContinuation' WHERE id=$1", [discovery.id]);
      }
      await pool.query('UPDATE app_users SET is_disabled=true WHERE id=$1', [owner.user.id]);
      const disabled = await read(c.client); assert.deepEqual(disabled.searchDiagnostics, counts);
      assert.equal(disabled.permissions.isReadOnly, true); assert.equal(disabled.permissions.canSearchAgain, false);
      assert.deepEqual((await pool.query('SELECT search_attempt_count,research_attempt_count,next_search_after FROM library_discovery_requests WHERE id=$1', [discovery.id])).rows[0], openingSchedule);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM operation_runs')).rows[0].n, operationCount);
    }, { scenarioName: 'missing_music_search_diagnostic_scope' });
  });
});
