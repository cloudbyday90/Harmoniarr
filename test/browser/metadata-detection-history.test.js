import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { createMetadataCommandFixture, metadataCommandIds as id } from '../../testing/browser/metadata-command-fixture.js';
import { bootstrapAdminThroughUi, loginThroughUi, logoutThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { assertLocatorFocused } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { createFixtureGate, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const config = resolveIntegrationTestRuntimeConfig();
const path = `/api/v1/metadata/artists/${id.artist}/detection-events`;
const event = title => ({ id: title, title, primaryType: 'Album', occurredAt: '2026-10-21T00:00:00.000Z', monitoringDecision: 'already_satisfied', resultingWantedStatus: 'none' });
let reads = []; let readPage;
const fixture = createMetadataCommandFixture({ history: {
  entries: [event('Initial discovery')], pageInfo: { hasMore: true, nextCursor: 'initial-cursor' },
  readPage: args => { reads.push(args); return readPage(args); },
} });
let runtime;

async function openArtist(page, baseUrl) {
  await page.goto(`${baseUrl}/app/settings/library-browser?artistId=${id.artist}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Load more history', exact: true }).waitFor();
}

async function prepare({ baseUrl, page, client }) {
  reads = [];
  readPage = async () => ({ entries: [event('Current discovery')], pageInfo: { hasMore: false, nextCursor: null } });
  await bootstrapAdminThroughUi(page, { baseUrl });
  await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' });
}

suite('Metadata detection history retains artist ownership', () => {
  before(async () => { runtime = await createBrowserSmokeRuntime({ config, createAppFn: fixture.createAppFn }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('operator keyboard pagination keeps native session refusal, cursor order and normal append', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const { baseUrl, page, client, getPoolFn } = context; await prepare(context);
      const anonymous = createSessionHttpClient(baseUrl);
      assert.equal((await anonymous.requestJson(path)).response.status, 401); assert.deepEqual(reads, []);
      const created = await client.requestJson('/api/v1/users', { method: 'POST', json: { username: 'history-operator', password: 'HistoryRole123!', role: 'operator' } });
      assert.equal(created.response.status, 201);
      await getPoolFn().query('UPDATE app_users SET must_change_password=false WHERE id=$1', [created.payload.user.id]);
      await logoutThroughUi(page); await loginThroughUi(page, { baseUrl, username: 'history-operator', password: 'HistoryRole123!' });
      await openArtist(page, baseUrl);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      readPage = async ({ before: cursor }) => ({ entries: [event(cursor === 'initial-cursor' ? 'Second discovery' : 'Final discovery')], pageInfo: { hasMore: cursor === 'initial-cursor', nextCursor: cursor === 'initial-cursor' ? 'second-cursor' : null } });
      const load = page.getByRole('button', { name: 'Load more history', exact: true });
      for (const title of ['Second discovery', 'Final discovery']) {
        const response = page.waitForResponse(candidate => new URL(candidate.url()).pathname === path && candidate.status() === 200);
        await load.press('Enter'); await response; await page.getByText(title, { exact: true }).waitFor();
      }
      assert.deepEqual(reads.map(row => row.before), ['initial-cursor', 'second-cursor']);
      for (const row of reads) { assert.equal(row.artistId, id.artist); assert.equal(row.limit, 10); }
      assert.equal(await page.getByText('Initial discovery', { exact: true }).count(), 1);
      assert.equal(await load.count(), 0); assert.deepEqual(fixture.calls, []); assert.deepEqual(errors, []);
    }, { scenarioName: 'metadata_history_operator_pages' });
  });

  test('reselecting an artist aborts its held page and preserves the new history and user focus', { timeout: config.scenarioTimeoutMs }, async t => {
    await runtime.runScenario(context => withFixtureLifecycle({ signal: t.signal }, async scope => {
      const { baseUrl, page } = context; await prepare(context); await openArtist(page, baseUrl);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const reached = createFixtureGate({ signal: scope.signal }); const hold = createFixtureGate();
      scope.onRelease(() => hold.release()); scope.onRelease(() => reached.release());
      let execution;
      readPage = () => {
        execution = (async () => { reached.release(); await hold.promise; return { entries: [event('Obsolete discovery')], pageInfo: { hasMore: false, nextCursor: null } }; })();
        return scope.track(execution);
      };
      await page.getByRole('button', { name: 'Load more history', exact: true }).press('Enter'); await reached.promise;
      const aborted = page.waitForEvent('requestfailed', { predicate: request => new URL(request.url()).pathname === path });
      await page.getByLabel('Artist name', { exact: true }).fill('Fixture');
      await page.getByRole('button', { name: 'Search MusicBrainz', exact: true }).press('Enter');
      await page.getByRole('button', { name: 'Import artist', exact: true }).press('Enter'); await aborted;
      await page.getByRole('button', { name: 'Import artist', exact: true }).waitFor();
      const load = page.getByRole('button', { name: 'Load more history', exact: true }); await load.waitFor();
      const input = page.getByLabel('Artist name', { exact: true }); await input.focus();
      hold.release(); await execution; await page.waitForLoadState('networkidle'); await assertLocatorFocused(input);
      assert.equal(await page.getByText('Obsolete discovery', { exact: true }).count(), 0);
      assert.equal(await page.getByText('Initial discovery', { exact: true }).count(), 1);
      assert.equal(await page.getByRole('status', { name: 'Detection history status', exact: true }).textContent(), '');
      readPage = async () => ({ entries: [event('Current discovery')], pageInfo: { hasMore: false, nextCursor: null } });
      await load.press('Enter'); await page.getByText('Current discovery', { exact: true }).waitFor();
      assert.deepEqual(reads.map(row => row.before), ['initial-cursor', 'initial-cursor']);
      assert.deepEqual(fixture.calls.map(row => row.command), ['artist']); assert.deepEqual(errors, []);
    }), { scenarioName: 'metadata_history_reselection' });
  });
});
