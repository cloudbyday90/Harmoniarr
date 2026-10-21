import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { createMetadataCommandFixture, metadataCommandIds as id } from '../../testing/browser/metadata-command-fixture.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { assertLocatorFocused } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { createFixtureGate, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
const fixture = createMetadataCommandFixture();
let runtime;

async function prepare({ baseUrl, page, client }) {
  await bootstrapAdminThroughUi(page, { baseUrl });
  await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' });
  const configured = await client.requestJson('/api/v1/settings', { method: 'PUT', json: { security: { csrfProtectionMode: 'required' } } });
  assert.equal(configured.response.status, 200);
  assert.equal(configured.payload.settings.security.csrfProtectionMode, 'required');
  await page.goto(`${baseUrl}/app/settings/library-browser?artistId=${id.artist}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Refresh artist metadata', exact: true }).waitFor();
}

async function holdNativeCommand(context, scope, path, status) {
  // Cleanup must deliver an already fetched response even after the body fails.
  const hold = createFixtureGate(); const reached = createFixtureGate({ signal: scope.signal });
  scope.onRelease(() => hold.release()); scope.onRelease(() => reached.release());
  const pattern = `**${path}`;
  await context.browserContext.route(pattern, route => scope.track((async () => {
    const response = await route.fetch({ maxRetries: 0 }); assert.equal(response.status(), status);
    reached.release(); await hold.promise; await route.fulfill({ response });
  })()));
  return { reached: reached.promise, async release() {
    const delivered = context.page.waitForResponse(response => new URL(response.url()).pathname === path && response.status() === status);
    hold.release(); await delivered;
    await context.page.waitForLoadState('networkidle');
    await context.browserContext.unroute(pattern);
  } };
}

suite('Metadata command results retain workspace ownership', () => {
  before(async () => { runtime = await createBrowserSmokeRuntime({ config, createAppFn: fixture.createAppFn }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  for (const command of ['group', 'release']) test(`accepted ${command} import cannot replace a later saved-group selection`, { timeout: config.scenarioTimeoutMs }, async t => {
    await runtime.runScenario(context => withFixtureLifecycle({ signal: t.signal }, async scope => {
      await prepare(context); const { page } = context;
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      if (command === 'release') {
        await page.getByRole('button', { name: 'Import release group', exact: true }).press('Enter');
        await page.getByRole('button', { name: 'Import release', exact: true }).waitFor();
      }
      const target = command === 'group' ? `release-groups/${id.providerGroupMbid}` : `releases/${id.providerReleaseMbid}`;
      const path = `/api/v1/metadata/musicbrainz/${target}/import`;
      const held = await holdNativeCommand(context, scope, path, 201);
      const requests = []; page.on('request', request => requests.push(new URL(request.url()).pathname));
      await page.getByRole('button', { name: command === 'group' ? 'Import release group' : 'Import release', exact: true }).press('Enter');
      await held.reached;
      assert.equal(fixture.calls.filter(row => row.command === command).length, 1);
      const savedGroup = page.locator('article.metadata-card').filter({ has: page.getByRole('heading', { name: 'Saved group', exact: true }) }).getByRole('button', { name: 'Open local release group', exact: true });
      await savedGroup.press('Enter'); await page.waitForURL(url => url.searchParams.get('releaseGroupId') === id.group);
      await page.getByRole('heading', { name: 'Saved group', exact: true }).last().waitFor();
      const input = page.getByLabel('Artist name', { exact: true }); await input.focus();
      await held.release(); await assertLocatorFocused(input);
      assert.equal(new URL(page.url()).searchParams.get('releaseGroupId'), id.group);
      const selected = page.getByText('Selected release group', { exact: true }).locator('..');
      assert.equal(await selected.getByRole('heading', { name: 'Saved group', exact: true }).count(), 1);
      assert.equal(await page.getByRole('heading', { name: 'Provider edition', exact: true }).count(), 0);
      assert.equal(requests.filter(request => request === `/api/v1/metadata/musicbrainz/${target}/local`).length, 0);
      assert.equal(requests.filter(request => request === path).length, 1);
      assert.equal(fixture.calls.filter(row => row.command === command).length, 1); assert.deepEqual(errors, []);
    }), { scenarioName: `metadata_${command}_accepted_selection` });
  });

  test('accepted old refresh cannot announce its run after reselecting the same artist', { timeout: config.scenarioTimeoutMs }, async t => {
    await runtime.runScenario(context => withFixtureLifecycle({ signal: t.signal }, async scope => {
      await prepare(context); const { page } = context;
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const held = await holdNativeCommand(context, scope, `/api/v1/metadata/artists/${id.artist}/refresh`, 202);
      const refresh = page.getByRole('button', { name: 'Refresh artist metadata', exact: true });
      await refresh.press('Enter'); await held.reached;
      await page.getByLabel('Artist name', { exact: true }).fill('Fixture');
      await page.getByRole('button', { name: 'Search MusicBrainz', exact: true }).press('Enter');
      await page.getByRole('button', { name: 'Import artist', exact: true }).press('Enter');
      await page.getByRole('button', { name: 'Import artist', exact: true }).waitFor();
      await refresh.waitFor(); await page.waitForFunction(() => [...globalThis.document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Refresh artist metadata' && !button.disabled));
      const input = page.getByLabel('Artist name', { exact: true }); await input.focus();
      await held.release(); await assertLocatorFocused(input);
      assert.equal(await page.getByText('Refresh queued as run fixture-refresh-run.', { exact: true }).count(), 0);
      assert.deepEqual(fixture.calls.map(row => row.command), ['refresh', 'artist']);
      await refresh.press('Enter'); await page.getByText('Refresh queued as run fixture-refresh-run.', { exact: true }).waitFor();
      assert.deepEqual(fixture.calls.map(row => row.command), ['refresh', 'artist', 'refresh']); assert.deepEqual(errors, []);
    }), { scenarioName: 'metadata_refresh_accepted_reselection' });
  });
});
