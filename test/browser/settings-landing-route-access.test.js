import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { before, after, suite, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi, loginThroughUi, logoutThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { assertLocatorFocused, assertVisibleFocusOutline } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { createFixtureGate, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
const protectedPaths = ['/api/v1/settings', '/api/v1/slskd/status'];
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
    if (protectedPaths.includes(path)) reads.push(path);
    if (path.startsWith('/api/') && !path.startsWith('/api/v1/auth/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(path);
  });
  page.on('pageerror', error => errors.push(error.message));
  return { reads, mutations, errors };
}

suite('role-aware Settings landing and protected Setup admission', () => {
  before(async () => { runtime = await createBrowserSmokeRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('native administrator session must complete before keyboard Setup entry mounts its real readers', { timeout: config.scenarioTimeoutMs }, async t => {
    await runtime.runScenario(async ({ baseUrl, page, browserContext, client }) => withFixtureLifecycle({ signal: t.signal }, async scope => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' });
      assert.equal((await client.requestJson('/api/v1/settings', { method: 'PUT', json: { slskd: { providerMode: 'disabled' } } })).response.status, 200);
      const nav = await openAccount(page, baseUrl); const observations = observe(page);
      const setup = nav.getByRole('link', { name: 'Setup', exact: true });
      await setup.focus(); await assertVisibleFocusOutline(setup);
      const hold = createFixtureGate({ signal: scope.signal }); const reached = createFixtureGate({ signal: scope.signal });
      scope.onRelease(() => hold.release()); scope.onRelease(() => reached.release());
      await browserContext.route('**/api/v1/auth/session', route => scope.track((async () => {
        const response = await route.fetch({ maxRetries: 0 }); assert.equal(response.status(), 200);
        reached.release(); await hold.promise; await route.fulfill({ response });
      })()));
      await setup.press('Enter'); await reached.promise;
      assert.equal(new URL(page.url()).pathname, '/app/settings/account');
      assert.deepEqual(observations.reads, []);
      assert.equal(await page.getByRole('heading', { name: 'Setup readiness', exact: true }).count(), 0);
      const loaded = protectedPaths.map(path => page.waitForResponse(response => new URL(response.url()).pathname === path && response.status() === 200));
      hold.release(); await page.waitForURL(`${baseUrl}/app/settings`); await Promise.all(loaded);
      await page.getByRole('heading', { name: 'Setup readiness', exact: true }).waitFor();
      assert.equal(await setup.getAttribute('aria-current'), 'page');
      assert.deepEqual(observations.mutations, []); assert.deepEqual(observations.errors, []);
    }), { scenarioName: 'settings_setup_native_admission' });
  });

  test('bootstrap/login precede role landing; non-admin roots reach Account without reads or history loops', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async ({ baseUrl, page, client, getPoolFn }) => {
      await page.goto(`${baseUrl}/app/settings`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Create the first admin account', exact: true }).waitFor();
      await bootstrapAdminThroughUi(page, { baseUrl });
      await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' });
      await logoutThroughUi(page); const observations = observe(page);
      const target = '/app/settings/?role=admin&redirect=//other.test#setup';
      await page.goto(`${baseUrl}${target}`, { waitUntil: 'domcontentloaded' }); await page.waitForURL(url => url.pathname === '/login');
      assert.equal(new URL(page.url()).searchParams.get('redirect'), target);
      for (const role of ['operator', 'requester']) {
        const username = `settings-${role}`; const password = 'SettingsRole123!';
        const created = await client.requestJson('/api/v1/users', { method: 'POST', json: { username, password, role } });
        assert.equal(created.response.status, 201);
        await getPoolFn().query('UPDATE app_users SET must_change_password=false WHERE id=$1', [created.payload.user.id]);
        await loginThroughUi(page, { baseUrl, username, password });
        await page.goto(`${baseUrl}${target}`, { waitUntil: 'domcontentloaded' });
        await page.waitForURL(`${baseUrl}/app/settings/account`);
        await page.getByRole('heading', { name: 'My account', exact: true }).waitFor();
        const nav = page.getByRole('navigation', { name: 'Settings sections', exact: true });
        assert.deepEqual(await nav.getByRole('link').allTextContents(), ['Media & storage', 'Notifications', 'Library']);
        const more = page.getByRole('button', { name: 'Hide more settings', exact: true });
        assert.equal(await more.getAttribute('aria-expanded'), 'true');
        await page.getByRole('navigation', { name: 'More settings sections', exact: true }).getByRole('link', { name: 'Account', exact: true }).waitFor();
        if (role === 'operator') {
          await page.goto(`${baseUrl}/app/account-security?prior=1`);
          await page.getByRole('heading', { name: 'My account', exact: true }).waitFor();
          await page.goto(`${baseUrl}/app/account-security?prior=2`);
          await page.getByRole('heading', { name: 'My account', exact: true }).waitFor();
          const length = await page.evaluate(() => globalThis.history.length);
          const settings = page.getByRole('complementary', { name: 'Primary', exact: true }).getByRole('link', { name: 'Settings', exact: true });
          assert.equal(await settings.getAttribute('href'), '/app/settings');
          await settings.focus(); await settings.press('Enter'); await page.waitForURL(`${baseUrl}/app/settings/account`);
          assert.equal(await page.evaluate(() => globalThis.history.length), length);
          await page.goBack(); await page.waitForURL(`${baseUrl}/app/account-security?prior=1`);
          await page.goForward(); await page.waitForURL(`${baseUrl}/app/settings/account`);
          await page.setViewportSize({ width: 390, height: 1000 });
          await page.goto(`${baseUrl}/app/account-security`); await page.getByRole('heading', { name: 'My account', exact: true }).waitFor();
          await page.getByRole('navigation', { name: 'Mobile navigation', exact: true }).getByRole('link', { name: 'Settings', exact: true }).press('Enter');
          await page.waitForURL(`${baseUrl}/app/settings/account`);
          await mkdir('.tmp/settings-landing-2026-10-21', { recursive: true });
          await page.screenshot({ path: '.tmp/settings-landing-2026-10-21/operator-account-mobile.png', fullPage: true, animations: 'disabled' });
          await page.setViewportSize({ width: 1280, height: 1000 });
        }
        await page.goto(`${baseUrl}/app/account-security`); await page.getByRole('heading', { name: 'My account', exact: true }).waitFor();
        await logoutThroughUi(page);
      }
      assert.deepEqual(observations.reads, []); assert.deepEqual(observations.mutations, []); assert.deepEqual(observations.errors, []);
    }, { scenarioName: 'settings_nonadmin_landing' });
  });

  test('failed verification retains focus/retry and current password/role changes precede Setup entry', { timeout: config.scenarioTimeoutMs }, async t => {
    await runtime.runScenario(async ({ baseUrl, page, browserContext, client, getPoolFn }) => withFixtureLifecycle({ signal: t.signal }, async scope => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const authenticated = await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' });
      const id = authenticated.payload.user.id; const observations = observe(page);
      let nav = await openAccount(page, baseUrl);
      const pattern = '**/api/v1/auth/session';
      await browserContext.route(pattern, route => route.fulfill({ status: 503, json: { message: 'private-session-failure' } }));
      const setup = nav.getByRole('link', { name: 'Setup', exact: true });
      await setup.focus(); await setup.press('Enter');
      const alert = page.getByRole('alert').filter({ hasText: 'Could not verify administrator access. Try again.' }); await alert.waitFor();
      assert.equal(new URL(page.url()).pathname, '/app/settings/account'); assert.deepEqual(observations.reads, []);
      await assertLocatorFocused(setup); assert.doesNotMatch(await alert.textContent(), /private-session/);
      await browserContext.unroute(pattern); await setup.press('Enter');
      await page.waitForURL(`${baseUrl}/app/settings`); await page.getByRole('heading', { name: 'Setup readiness', exact: true }).waitFor();
      nav = await openAccount(page, baseUrl); observations.reads.length = 0;
      await getPoolFn().query('UPDATE app_users SET must_change_password=true WHERE id=$1', [id]);
      await nav.getByRole('link', { name: 'Setup', exact: true }).press('Enter');
      await page.waitForURL(url => url.pathname === '/app/account-security');
      assert.equal(new URL(page.url()).searchParams.get('redirect'), '/app/settings'); assert.deepEqual(observations.reads, []);
      await getPoolFn().query('UPDATE app_users SET must_change_password=false WHERE id=$1', [id]);
      nav = await openAccount(page, baseUrl);
      await getPoolFn().query("UPDATE app_users SET role='operator' WHERE id=$1", [id]);
      await nav.getByRole('link', { name: 'Setup', exact: true }).press('Enter');
      await nav.getByRole('link', { name: 'Setup', exact: true }).waitFor({ state: 'hidden' });
      assert.equal(new URL(page.url()).pathname, '/app/settings/account'); assert.deepEqual(observations.reads, []);
      await assertLocatorFocused(page.getByRole('button', { name: 'Hide more settings', exact: true }));
      for (const path of protectedPaths) assert.equal((await client.requestJson(path)).response.status, 403);

      await getPoolFn().query("UPDATE app_users SET role='admin' WHERE id=$1", [id]);
      nav = await openAccount(page, baseUrl);
      await getPoolFn().query("UPDATE app_users SET role='operator' WHERE id=$1", [id]);
      const hold = createFixtureGate({ signal: scope.signal }); const reached = createFixtureGate({ signal: scope.signal });
      scope.onRelease(() => hold.release()); scope.onRelease(() => reached.release());
      await browserContext.route(pattern, route => scope.track((async () => {
        const response = await route.fetch({ maxRetries: 0 }); reached.release(); await hold.promise; await route.fulfill({ response });
      })()));
      await nav.getByRole('link', { name: 'Setup', exact: true }).press('Enter'); await reached.promise;
      const notifications = nav.getByRole('link', { name: 'Notifications', exact: true });
      await notifications.focus(); hold.release();
      await nav.getByRole('link', { name: 'Setup', exact: true }).waitFor({ state: 'hidden' });
      await assertLocatorFocused(notifications); assert.deepEqual(observations.reads, []);
      assert.deepEqual(observations.mutations, []); assert.deepEqual(observations.errors, []);
    }), { scenarioName: 'settings_current_authority_retry' });
  });
});
