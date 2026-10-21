import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { before, after, suite, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { assertLocatorFocused, assertVisibleFocusOutline } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { createFixtureGate, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { seedMissingMusicPaginationRows } from '../../testing/integration/missing-music-pagination-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createLibraryDiscoveryRequestStore } from '../../src/server/library/library-discovery-request-store.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const card = page => page.getByRole('region', { name: 'Return to your release', exact: true });
const returnLink = page => card(page).getByRole('link', { name: 'Return to Missing Music', exact: true });
async function seedDecision({ client, getPoolFn }) {
  const authenticated = await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' });
  assert.equal(authenticated.response.status, 200); const pool = getPoolFn();
  const fixture = await seedMissingMusicPaginationRows({ queryable: pool, appUserId: authenticated.payload.user.id, count: 1, titlePrefix: 'Return review' });
  const id = fixture.rows[0].id;
  const discovery = (await pool.query(`INSERT INTO library_discovery_requests
    (metadata_artist_id,metadata_release_group_id,metadata_release_id,wanted_status,search_mode,request_status,
      search_attempt_count,research_attempt_count,next_search_after,evidence)
    SELECT metadata_artist_id,metadata_release_group_id,metadata_release_id,'missing','automatic','cooldown',1,0,
      '2050-01-01'::timestamptz,'{}'::jsonb FROM library_wanted_releases WHERE id=$1 RETURNING id,metadata_release_id`, [id])).rows[0];
  await pool.query('INSERT INTO library_discovery_request_wanted_release_links(discovery_request_id,wanted_release_id) VALUES($1,$2)', [discovery.id, id]);
  await createLibraryDiscoveryRequestStore().recordDiscoverySearchSuccess({ metadataReleaseId: discovery.metadata_release_id,
    searchId: 'private-review-search', searchQuery: 'private-review-query', candidateCount: 0, fileCount: 0,
    ingestionDiagnostics: { provider: 'slskd', candidateCount: 0, responseCount: 1, responseFileCount: 1, ignoredUserResponseCount: 1 } });
  const ignored = await client.requestJson('/api/v1/activity/ignored-source-users', { method: 'POST', json: { username: 'return-review-peer', reason: 'Intentional review fixture' } });
  assert.equal(ignored.response.status, 201);
  return { id, pool, discovery };
}
suite('bounded ignored-source review return', () => {
  before(async () => { runtime = await createBrowserSmokeRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('native decision round-trip preserves origin through reload and explicit save, then reads current status without starting a search', { timeout: config.scenarioTimeoutMs }, async t => {
    await runtime.runScenario(async c => withFixtureLifecycle({ signal: t.signal }, async scope => {
      const { baseUrl, browserContext, page } = c; await bootstrapAdminThroughUi(page, { baseUrl });
      const { id, pool, discovery } = await seedDecision(c);
      const path = `/api/v1/missing-music/decisions/${id}`; let reads = 0; const mutations = [];
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.pathname === path && request.method() === 'GET') reads++;
        if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push({ method: request.method(), path: url.pathname });
      });
      const schedule = async () => (await pool.query('SELECT search_attempt_count,research_attempt_count,next_search_after FROM library_discovery_requests WHERE id=$1', [discovery.id])).rows[0];
      const openingSchedule = await schedule(); const operationCount = (await pool.query('SELECT count(*)::int AS n FROM operation_runs')).rows[0].n;
      await page.goto(`${baseUrl}/app/missing/${id}`, { waitUntil: 'domcontentloaded' });
      const diagnostics = page.getByRole('region', { name: 'Last recorded search', exact: true });
      await diagnostics.getByRole('link', { name: 'Review ignored sources', exact: true }).press('Enter');
      const reviewUrl = `${baseUrl}/app/activity/ignored?returnTo=missing_music_decision&returnReleaseId=${id}`;
      await page.waitForURL(reviewUrl); await returnLink(page).waitFor(); await page.reload(); await returnLink(page).waitFor();
      await mkdir('.tmp/ignored-review-return-2026-10-20', { recursive: true });
      for (const [width, theme] of [[390, 'light'], [800, 'dark'], [1280, 'light']]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
        await card(page).screenshot({ path: `.tmp/ignored-review-return-2026-10-20/return-${width}-${theme}.png`, animations: 'disabled' });
        const bounds = await card(page).boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
        assert.ok((await returnLink(page).boundingBox()).height >= 44);
      }
      await returnLink(page).focus(); await assertVisibleFocusOutline(returnLink(page));
      await returnLink(page).press('Shift+Tab'); await page.keyboard.press('Tab'); await assertLocatorFocused(returnLink(page));
      const row = page.getByRole('row').filter({ hasText: 'return-review-peer' }); await row.waitFor();
      await row.getByRole('button', { name: 'Remove', exact: true }).press('Enter');
      const confirmation = page.getByRole('alertdialog', { name: 'Remove from ignore list?', exact: true });
      await confirmation.getByRole('button', { name: 'Keep ignored', exact: true }).press('Enter');
      assert.equal(mutations.length, 0); assert.equal(await row.count(), 1);
      const hold = createFixtureGate({ signal: scope.signal }); scope.onRelease(() => hold.release());
      await browserContext.route('**/api/v1/activity/ignored-source-users/return-review-peer', route => scope.track((async () => {
        const response = await route.fetch({ maxRetries: 0 }); await hold.promise; await route.fulfill({ response });
      })()));
      await row.getByRole('button', { name: 'Remove', exact: true }).press('Enter');
      await confirmation.getByRole('button', { name: 'Remove', exact: true }).press('Enter');
      await card(page).getByRole('status').getByText('Saving source policy…', { exact: true }).waitFor();
      assert.equal(await returnLink(page).count(), 0, 'Pending policy response must withhold return navigation');
      hold.release(); await row.waitFor({ state: 'hidden' }); await returnLink(page).waitFor();
      // Model independent discovery advancement while this review is open;
      // removing an ignore does not rewrite the previous search's counters.
      await pool.query("UPDATE library_discovery_requests SET request_status='ready' WHERE id=$1", [discovery.id]);
      const previousReads = reads;
      const returnedDetail = page.waitForResponse(response => new URL(response.url()).pathname === path && response.status() === 200);
      await returnLink(page).press('Enter'); await page.waitForURL(`${baseUrl}/app/missing/${id}`);
      await returnedDetail;
      await page.waitForFunction(() => globalThis.document.activeElement?.classList.contains('missing-music-inspector__heading'));
      assert.ok(reads > previousReads); assert.equal(await diagnostics.count(), 0);
      assert.deepEqual(mutations, [{ method: 'DELETE', path: '/api/v1/activity/ignored-source-users/return-review-peer' }]);
      assert.deepEqual(await schedule(), openingSchedule);
      assert.equal((await pool.query('SELECT count(*)::int AS n FROM operation_runs')).rows[0].n, operationCount);
      assert.deepEqual((await c.client.requestJson('/api/v1/activity/ignored-source-users')).payload.ignoredSourceUsers, []);
    }), { scenarioName: 'ignored_review_native_return' });
  });
  test('untrusted contexts, role withdrawal and unavailable target IDs cannot turn return navigation into authority', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async ({ baseUrl, page, client, getPoolFn }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const authenticated = await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' });
      for (const query of ['returnTo=https%3A%2F%2Funtrusted.invalid&returnReleaseId=release-one',
        'returnTo=missing_music_decision&returnReleaseId=one&returnReleaseId=two',
        'returnTo=missing_music_decision&returnReleaseId=..%2Fadmin']) {
        await page.goto(`${baseUrl}/app/activity/ignored?${query}`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Ignored source users', exact: true }).waitFor(); assert.equal(await card(page).count(), 0);
      }
      const unavailableId = '00000000-0000-4000-8000-000000000001';
      const valid = `${baseUrl}/app/activity/ignored?returnTo=missing_music_decision&returnReleaseId=${unavailableId}`;
      await page.goto(valid, { waitUntil: 'domcontentloaded' }); await returnLink(page).waitFor();
      await returnLink(page).press('Enter'); await page.waitForURL(`${baseUrl}/app/missing/${unavailableId}`);
      await page.getByText('The requested release is unavailable or you do not have access to it.', { exact: true }).waitFor();
      await getPoolFn().query("UPDATE app_users SET role='operator' WHERE id=$1", [authenticated.payload.user.id]);
      await page.goto(valid, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Ignored source users', exact: true }).waitFor(); assert.equal(await card(page).count(), 0);
      assert.equal((await client.requestJson('/api/v1/activity/ignored-source-users')).response.status, 403);
    }, { scenarioName: 'ignored_review_return_refusal' });
  });
});
