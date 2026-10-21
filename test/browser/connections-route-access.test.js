import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { before, after, suite, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi, loginThroughUi, logoutThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { assertLocatorFocused, assertVisibleFocusOutline } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { createFixtureGate, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const config = resolveIntegrationTestRuntimeConfig();
const readPaths = new Set(['/api/v1/settings', '/api/v1/slskd/status']);
let runtime;

async function openAccount(page, baseUrl) {
  await page.goto(`${baseUrl}/app/settings/account`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'My account', exact: true }).waitFor();
  return page.getByRole('navigation', { name: 'Settings sections', exact: true });
}

function observe(page) {
  const reads = []; const mutations = []; const errors = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (readPaths.has(path)) reads.push(path);
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(path);
  });
  page.on('pageerror', error => errors.push(error.message));
  return { reads, mutations, errors };
}

async function assertApiRefusal(client, status) {
  const requests = [
    ...[...readPaths].map(path => [path, { method: 'GET' }]),
    ['/api/v1/settings', { method: 'PUT', json: {} }],
    ...['plex/link/start', 'plex/link/clear', 'spotify/oauth/start', 'spotify/oauth/clear', 'youtube/oauth/start', 'youtube/oauth/clear']
      .map(path => [`/api/v1/providers/${path}`, { method: 'POST', json: {} }]),
    ['/api/v1/providers/collection-access-check', { method: 'POST', json: { sourceUrl: 'not-a-provider-url' } }],
  ];
  for (const [path, options] of requests) assert.equal((await client.requestJson(path, options)).response.status, status, `${options.method} ${path}`);
}

suite('administrator-only Connections admission with ordinary Account access', () => {
  before(async () => { runtime = await createBrowserSmokeRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('administrator keyboard entry holds the native session before settings/status reads and preserves Account navigation', { timeout: config.scenarioTimeoutMs }, async t => {
    await runtime.runScenario(async ({ baseUrl, page, browserContext, client }) => withFixtureLifecycle({ signal: t.signal }, async scope => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' });
      const configured = await client.requestJson('/api/v1/settings', { method: 'PUT', json: { slskd: { providerMode: 'disabled' } } });
      assert.equal(configured.response.status, 200);
      const nav = await openAccount(page, baseUrl); const observations = observe(page);
      const setup = nav.getByRole('link', { name: 'Setup', exact: true });
      await setup.focus(); await setup.press('Tab');
      const connections = nav.getByRole('link', { name: 'Connections', exact: true });
      await assertLocatorFocused(connections); await assertVisibleFocusOutline(connections);
      const hold = createFixtureGate({ signal: scope.signal }); const reached = createFixtureGate({ signal: scope.signal });
      scope.onRelease(() => hold.release()); scope.onRelease(() => reached.release());
      await browserContext.route('**/api/v1/auth/session', route => scope.track((async () => {
        const response = await route.fetch({ maxRetries: 0 }); assert.equal(response.status(), 200);
        reached.release(); await hold.promise; await route.fulfill({ response });
      })()));
      await connections.press('Enter'); await reached.promise;
      assert.equal(new URL(page.url()).pathname, '/app/settings/account');
      assert.deepEqual(observations.reads, []);
      assert.equal(await page.getByRole('heading', { name: 'Soulseek downloads', exact: true }).count(), 0);
      const loaded = [...readPaths].map(path => page.waitForResponse(response => new URL(response.url()).pathname === path && response.status() === 200));
      hold.release(); await page.waitForURL(`${baseUrl}/app/settings/connections`); await Promise.all(loaded);
      await page.getByRole('heading', { name: 'Soulseek downloads', exact: true }).waitFor();
      assert.equal(await connections.getAttribute('aria-current'), 'page');
      assert.deepEqual(observations.mutations, []); assert.deepEqual(observations.errors, []);
    }), { scenarioName: 'connections_admin_current_session' });
  });

  test('direct links and protected API calls refuse other roles while Account and surviving native links remain usable', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async ({ baseUrl, page, client, getPoolFn }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' });
      await logoutThroughUi(page); const observations = observe(page);
      const target = `${baseUrl}/app/settings/connections?role=admin&returnTo=missing_music_decision&returnReleaseId=forged`;
      await page.goto(target, { waitUntil: 'domcontentloaded' }); await page.waitForURL(url => url.pathname === '/login');
      await assertApiRefusal(createSessionHttpClient(baseUrl), 401);
      for (const role of ['operator', 'requester']) {
        const username = `connections-${role}`; const password = 'ConnectionsRole123!';
        const created = await client.requestJson('/api/v1/users', { method: 'POST', json: { username, password, role } });
        assert.equal(created.response.status, 201);
        await getPoolFn().query('UPDATE app_users SET must_change_password=false WHERE id=$1', [created.payload.user.id]);
        await loginThroughUi(page, { baseUrl, username, password });
        await page.goto(target, { waitUntil: 'domcontentloaded' }); await page.waitForURL(`${baseUrl}/app`);
        const nav = await openAccount(page, baseUrl);
        assert.deepEqual(await nav.getByRole('link').allTextContents(), ['Notifications']);
        await page.getByRole('navigation', { name: 'More settings sections', exact: true }).getByRole('link', { name: 'Account', exact: true }).waitFor();
        if (role === 'operator') {
          const notifications = nav.getByRole('link', { name: 'Notifications', exact: true });
          const more = nav.getByRole('button', { name: 'Hide more settings', exact: true });
          await more.focus(); await more.press('Shift+Tab');
          await assertLocatorFocused(notifications); await assertVisibleFocusOutline(notifications);
          await mkdir('.tmp/connections-route-access-2026-10-21', { recursive: true });
          for (const [width, theme] of [[390, 'light'], [800, 'dark'], [1280, 'light']]) {
            await page.setViewportSize({ width, height: 1100 });
            await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
            await more.focus(); await more.press('Shift+Tab');
            await assertLocatorFocused(notifications); await assertVisibleFocusOutline(notifications);
            await nav.screenshot({ path: `.tmp/connections-route-access-2026-10-21/operator-nav-${width}-${theme}.png`, animations: 'disabled' });
            if (width === 390) await page.getByRole('navigation', { name: 'More settings sections', exact: true }).screenshot({ path: '.tmp/connections-route-access-2026-10-21/operator-account-390.png', animations: 'disabled' });
          }
          const health = page.locator('.hx-topbar-health-wrap > button');
          await health.click();
          assert.equal(await page.getByRole('link', { name: 'View in Settings', exact: true }).count(), 0);
          await health.click();
        }
        const own = createSessionHttpClient(baseUrl); await loginWithPassword(own, { username, password });
        await assertApiRefusal(own, 403);
        await page.goto(`${baseUrl}/app/account-security`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'My account', exact: true }).waitFor();
        await logoutThroughUi(page);
      }
      assert.deepEqual(observations.reads, []); assert.deepEqual(observations.errors, []);
    }, { scenarioName: 'connections_role_refusal_account_preserved' });
  });

  test('cached revocation, password-change precedence and bounded failed verification/retry use the common guard', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async ({ baseUrl, page, browserContext, client, getPoolFn }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const authenticated = await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' });
      const id = authenticated.payload.user.id; const observations = observe(page);
      let nav = await openAccount(page, baseUrl);
      await getPoolFn().query('UPDATE app_users SET must_change_password=true WHERE id=$1', [id]);
      await nav.getByRole('link', { name: 'Connections', exact: true }).press('Enter');
      await page.waitForURL(url => url.pathname === '/app/account-security'); assert.deepEqual(observations.reads, []);
      await getPoolFn().query('UPDATE app_users SET must_change_password=false WHERE id=$1', [id]);
      nav = await openAccount(page, baseUrl);
      await getPoolFn().query("UPDATE app_users SET role='operator' WHERE id=$1", [id]);
      await nav.getByRole('link', { name: 'Connections', exact: true }).press('Enter');
      await page.waitForURL(`${baseUrl}/app`); assert.deepEqual(observations.reads, []);
      assert.equal((await client.requestJson('/api/v1/settings')).response.status, 403);
      await getPoolFn().query("UPDATE app_users SET role='admin' WHERE id=$1", [id]);
      nav = await openAccount(page, baseUrl);
      const pattern = '**/api/v1/auth/session';
      await browserContext.route(pattern, route => route.fulfill({ status: 503, json: { message: 'private-session-failure' } }));
      const connections = nav.getByRole('link', { name: 'Connections', exact: true });
      await connections.focus(); await connections.press('Enter');
      const alert = page.getByRole('alert').filter({ hasText: 'Could not verify administrator access. Try again.' }); await alert.waitFor();
      assert.equal(new URL(page.url()).pathname, '/app/settings/account'); assert.deepEqual(observations.reads, []);
      await assertLocatorFocused(connections); assert.doesNotMatch(await alert.textContent(), /private-session/);
      await browserContext.unroute(pattern); await connections.press('Enter');
      await page.waitForURL(`${baseUrl}/app/settings/connections`);
      await page.getByRole('heading', { name: 'Soulseek downloads', exact: true }).waitFor();
      assert.deepEqual(observations.mutations, []); assert.deepEqual(observations.errors, []);
    }, { scenarioName: 'connections_current_authority_retry' });
  });
});
