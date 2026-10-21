import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { createMetadataCommandFixture, metadataCommandIds as id } from '../../testing/browser/metadata-command-fixture.js';
import { bootstrapAdminThroughUi, loginThroughUi, logoutThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { assertLocatorFocused } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { createFixtureGate, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const config = resolveIntegrationTestRuntimeConfig();
const fixture = createMetadataCommandFixture();
const privilegedPaths = [`/api/v1/metadata/artists/${id.artist}/refresh`, `/api/v1/metadata/musicbrainz/release-groups/${id.providerGroupMbid}/import`, `/api/v1/metadata/musicbrainz/releases/${id.providerReleaseMbid}/import`];
let runtime;

async function prepareAdmin({ baseUrl, page, client }) {
  await bootstrapAdminThroughUi(page, { baseUrl });
  const session = await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' });
  const configured = await client.requestJson('/api/v1/settings', { method: 'PUT', json: { security: { csrfProtectionMode: 'required' } } });
  assert.equal(configured.response.status, 200); assert.equal(configured.payload.settings.security.csrfProtectionMode, 'required');
  return session.payload.user;
}

async function openArtist(page, baseUrl) {
  await page.goto(`${baseUrl}/app/settings/library-browser?artistId=${id.artist}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open release group', exact: true }).waitFor();
}

async function runScenario(callback, options) {
  return runtime.runScenario(async context => {
    try { return await callback(context); }
    catch (error) {
      try {
        await mkdir('.tmp/metadata-command-authority-2026-10-21', { recursive: true });
        await context.page.screenshot({ path: `.tmp/metadata-command-authority-2026-10-21/${options.scenarioName}-failure.png`, timeout: 5000 });
      } catch { /* Preserve the original scenario failure. */ }
      throw error;
    }
  }, options);
}

suite('Metadata browser command authority with native HTTP guards', () => {
  before(async () => { runtime = await createBrowserSmokeRuntime({ config, createAppFn: fixture.createAppFn }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('admin controls dispatch each guarded command; missing CSRF never reaches its owner', { timeout: config.scenarioTimeoutMs }, async () => {
    await runScenario(async context => {
      const { baseUrl, page, client } = context; const user = await prepareAdmin(context);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      for (const path of privilegedPaths) assert.equal((await client.requestJson(path, { method: 'POST', csrf: false })).response.status, 403);
      assert.deepEqual(fixture.calls, []);
      await openArtist(page, baseUrl);
      const refresh = page.getByRole('button', { name: 'Refresh artist metadata', exact: true });
      await refresh.focus(); await assertLocatorFocused(refresh);
      const refreshed = page.waitForResponse(response => new URL(response.url()).pathname === privilegedPaths[0] && response.status() === 202);
      await refresh.press('Enter'); await refreshed; await page.getByText('Refresh queued as run fixture-refresh-run.', { exact: true }).waitFor();
      const groupImported = page.waitForResponse(response => new URL(response.url()).pathname === privilegedPaths[1] && response.status() === 201);
      await page.getByRole('button', { name: 'Import release group', exact: true }).press('Enter'); await groupImported;
      await page.getByRole('heading', { name: 'Choose a release to import', exact: true }).waitFor();
      const releaseImported = page.waitForResponse(response => new URL(response.url()).pathname === privilegedPaths[2] && response.status() === 201);
      await page.getByRole('button', { name: 'Import release', exact: true }).press('Enter'); await releaseImported;
      await page.getByRole('button', { name: 'Re-import release', exact: true }).waitFor();
      assert.deepEqual(fixture.calls.map(row => row.command), ['refresh', 'group', 'release']);
      for (const row of fixture.calls) assert.equal(row.args.actorUserId ?? row.args.triggeredByUserId, user.id);
      assert.deepEqual(errors, []);
    }, { scenarioName: 'metadata_admin_native_commands' });
  });

  test('operator keeps native reads and authenticated artist import while all privileged APIs refuse other actors', { timeout: config.scenarioTimeoutMs }, async () => {
    await runScenario(async context => {
      const { baseUrl, page, client, getPoolFn } = context; await prepareAdmin(context);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      let operatorUserId;
      for (const role of ['operator', 'requester']) {
        const created = await client.requestJson('/api/v1/users', { method: 'POST', json: { username: `metadata-${role}`, password: 'MetadataRole123!', role } });
        assert.equal(created.response.status, 201);
        if (role === 'operator') operatorUserId = created.payload.user.id;
        await getPoolFn().query('UPDATE app_users SET must_change_password=false WHERE id=$1', [created.payload.user.id]);
      }
      const anonymous = createSessionHttpClient(baseUrl);
      for (const path of privilegedPaths) assert.equal((await anonymous.requestJson(path, { method: 'POST' })).response.status, 401);
      for (const role of ['operator', 'requester']) {
        const own = createSessionHttpClient(baseUrl); await loginWithPassword(own, { username: `metadata-${role}`, password: 'MetadataRole123!' });
        for (const path of privilegedPaths) assert.equal((await own.requestJson(path, { method: 'POST' })).response.status, 403);
      }
      assert.deepEqual(fixture.calls, []);
      await logoutThroughUi(page); await loginThroughUi(page, { baseUrl, username: 'metadata-operator', password: 'MetadataRole123!' });
      await openArtist(page, baseUrl);
      assert.equal(await page.getByRole('button', { name: 'Refresh artist metadata', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Import release group', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: /^(Re-import release|Import release)$/ }).count(), 0);
      assert.equal(await page.getByRole('heading', { name: 'Artist Detail cache baseline', exact: true }).count(), 0);
      const openGroup = page.getByRole('button', { name: 'Open release group', exact: true });
      await openGroup.focus(); await openGroup.press('Enter');
      await page.waitForURL(url => url.searchParams.get('releaseGroupId') === id.group);
      await page.getByRole('heading', { name: 'Saved group', exact: true }).last().waitFor();
      const openRelease = page.getByRole('button', { name: 'Open local release', exact: true });
      await openRelease.focus(); await openRelease.press('Enter');
      await page.waitForURL(url => url.searchParams.get('releaseId') === id.release);
      await page.getByRole('heading', { name: 'Saved edition', exact: true }).last().waitFor();
      assert.deepEqual(fixture.calls, []);
      await page.getByLabel('Artist name', { exact: true }).fill('Fixture');
      await page.getByRole('button', { name: 'Search MusicBrainz', exact: true }).press('Enter');
      const imported = page.waitForResponse(response => new URL(response.url()).pathname.endsWith(`/artists/${id.artistMbid}/import`) && response.status() === 201);
      await page.getByRole('button', { name: 'Import artist', exact: true }).press('Enter'); await imported;
      await page.getByRole('button', { name: 'Open release group', exact: true }).waitFor();
      assert.deepEqual(fixture.calls.map(row => row.command), ['artist']);
      assert.equal(fixture.calls[0].args.actorUserId, operatorUserId);
      assert.equal(await page.getByRole('button', { name: 'Refresh artist metadata', exact: true }).count(), 0);
      await mkdir('.tmp/metadata-command-authority-2026-10-21', { recursive: true });
      for (const [width, theme] of [[390, 'light'], [1280, 'dark']]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
        await page.screenshot({ path: `.tmp/metadata-command-authority-2026-10-21/operator-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
      }
      assert.deepEqual(errors, []);
    }, { scenarioName: 'metadata_operator_reads_artist_import' });
  });

  test('a cached admin control is refused by fresh server authority after revocation with no command result', { timeout: config.scenarioTimeoutMs }, async t => {
    await runScenario(async context => withFixtureLifecycle({ signal: t.signal }, async scope => {
      const { baseUrl, page, browserContext, getPoolFn } = context; const user = await prepareAdmin(context);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await openArtist(page, baseUrl);
      await getPoolFn().query("UPDATE app_users SET role='operator' WHERE id=$1", [user.id]);
      const refresh = page.getByRole('button', { name: 'Refresh artist metadata', exact: true });
      await refresh.focus();
      const refused = page.waitForResponse(response => new URL(response.url()).pathname === privilegedPaths[0] && response.status() === 403);
      await refresh.press('Enter'); await refused;
      await page.getByRole('heading', { name: 'Action failed', exact: true }).waitFor();
      await assertLocatorFocused(refresh); assert.deepEqual(fixture.calls, []);
      assert.equal(await page.getByText(/Refresh queued as run/).count(), 0);
      const hold = createFixtureGate({ signal: scope.signal }); const reached = createFixtureGate({ signal: scope.signal });
      scope.onRelease(() => hold.release()); scope.onRelease(() => reached.release());
      await browserContext.route(`**${privilegedPaths[0]}`, route => scope.track((async () => {
        const response = await route.fetch({ maxRetries: 0 }); assert.equal(response.status(), 403);
        reached.release(); await hold.promise; await route.fulfill({ response });
      })()));
      await refresh.press('Enter'); await reached.promise;
      const search = page.getByLabel('Artist name', { exact: true }); await search.focus(); hold.release();
      await page.waitForFunction(() => [...globalThis.document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Refresh artist metadata' && !button.disabled));
      await assertLocatorFocused(search); assert.deepEqual(fixture.calls, []);
      await page.reload(); await page.getByRole('button', { name: 'Open release group', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Refresh artist metadata', exact: true }).count(), 0);
      assert.deepEqual(fixture.calls, []); assert.deepEqual(errors, []);
    }), { scenarioName: 'metadata_native_revocation_refusal' });
  });
});
