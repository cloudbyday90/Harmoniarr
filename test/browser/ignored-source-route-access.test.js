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

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const ignoredPaths = new Set(['/api/v1/activity/ignored-source-users', '/api/v1/activity/source-user-ignore-suggestions']);
async function openDiagnostics(page, baseUrl) {
  await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
  const summary = page.locator('details.activity-diagnostics > summary');
  await summary.press('Enter');
  const nav = page.getByRole('navigation', { name: 'Advanced Activity diagnostics', exact: true }); await nav.waitFor(); return nav;
}
function observe(page) {
  const reads = []; const mutations = []; const errors = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (ignoredPaths.has(path)) reads.push(path);
    if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(request.method());
  });
  page.on('pageerror', error => errors.push(error.message)); return { reads, mutations, errors };
}
suite('administrator-only ignored-source navigation', () => {
  before(async () => { runtime = await createBrowserSmokeRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('administrator keyboard entry waits for a current native session before mounting the page', { timeout: config.scenarioTimeoutMs }, async t => {
    await runtime.runScenario(async c => withFixtureLifecycle({ signal: t.signal }, async scope => {
      const { baseUrl, browserContext, page } = c; await bootstrapAdminThroughUi(page, { baseUrl });
      const nav = await openDiagnostics(page, baseUrl); const observations = observe(page);
      const ignored = nav.getByRole('link', { name: 'Ignored source users', exact: true });
      await ignored.focus(); await assertVisibleFocusOutline(ignored);
      const hold = createFixtureGate({ signal: scope.signal }); const reached = createFixtureGate({ signal: scope.signal });
      scope.onRelease(() => hold.release()); scope.onRelease(() => reached.release());
      await browserContext.route('**/api/v1/auth/session', route => scope.track((async () => {
        const response = await route.fetch({ maxRetries: 0 }); assert.equal(response.status(), 200);
        reached.release(); await hold.promise; await route.fulfill({ response });
      })()));
      await ignored.press('Enter'); await reached.promise;
      assert.equal(new URL(page.url()).pathname, '/app/activity/feed');
      assert.deepEqual(observations.reads, []);
      assert.equal(await page.getByRole('heading', { name: 'Ignored source users', exact: true }).count(), 0);
      const loaded = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/activity/ignored-source-users' && response.status() === 200);
      hold.release(); await page.waitForURL(`${baseUrl}/app/activity/ignored`); await loaded;
      await page.getByRole('heading', { name: 'Ignored source users', exact: true }).waitFor();
      assert.ok(observations.reads.length >= 1); assert.deepEqual(observations.mutations, []); assert.deepEqual(observations.errors, []);
    }), { scenarioName: 'ignored_admin_current_session' });
  });
  test('operator/requester/anonymous direct links refuse page admission while ordinary navigation and API denials remain intact', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async ({ baseUrl, page, client, getPoolFn }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' });
      const beforeList = (await client.requestJson('/api/v1/activity/ignored-source-users')).payload;
      await logoutThroughUi(page); const observations = observe(page);
      const target = `${baseUrl}/app/activity/ignored?role=admin&returnTo=missing_music_decision&returnReleaseId=forged`;
      await page.goto(target, { waitUntil: 'domcontentloaded' }); await page.waitForURL(url => url.pathname === '/login');
      assert.deepEqual(observations.reads, []);
      assert.equal((await createSessionHttpClient(baseUrl).requestJson('/api/v1/activity/ignored-source-users')).response.status, 401);
      for (const role of ['operator', 'requester']) {
        const username = `access-${role}`; const password = 'AccessRolePass123!';
        const created = await client.requestJson('/api/v1/users', { method: 'POST', json: { username, password, role } });
        assert.equal(created.response.status, 201);
        await getPoolFn().query('UPDATE app_users SET must_change_password=false WHERE id=$1', [created.payload.user.id]);
        await loginThroughUi(page, { baseUrl, username, password });
        await page.goto(target, { waitUntil: 'domcontentloaded' }); await page.waitForURL(`${baseUrl}/app`);
        await page.getByRole('heading', { name: 'Home', exact: true }).waitFor(); assert.deepEqual(observations.reads, []);
        const own = createSessionHttpClient(baseUrl); await loginWithPassword(own, { username, password });
        for (const path of ignoredPaths) assert.equal((await own.requestJson(path)).response.status, 403);
        assert.equal((await own.requestJson('/api/v1/activity/ignored-source-users', { method: 'POST', json: { username: 'never-ignored', reason: 'forged role' } })).response.status, 403);
        assert.equal((await own.requestJson('/api/v1/activity/ignored-source-users/never-ignored', { method: 'DELETE' })).response.status, 403);
        if (role === 'operator') {
          const nav = await openDiagnostics(page, baseUrl);
          assert.equal(await nav.getByRole('link', { name: 'Ignored source users', exact: true }).count(), 0);
          assert.equal(await nav.getByRole('link', { name: 'Request records', exact: true }).count(), 1);
          assert.equal(await nav.getByRole('link', { name: 'Match diagnostics', exact: true }).count(), 1);
          await mkdir('.tmp/ignored-route-access-2026-10-20', { recursive: true });
          for (const [width, theme] of [[390, 'light'], [800, 'dark'], [1280, 'light']]) {
            await page.setViewportSize({ width, height: 1100 });
            await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
            const capture = width === 390 ? nav.locator('.activity-diagnostic-group').last() : nav;
            await capture.screenshot({ path: `.tmp/ignored-route-access-2026-10-20/operator-nav-${width}-${theme}.png`, animations: 'disabled' });
          }
          await page.setViewportSize({ width: 1280, height: 1100 });
          const blocklist = nav.getByRole('link', { name: 'Source blocklist', exact: true });
          await blocklist.focus(); await blocklist.press('Tab');
          const history = nav.getByRole('link', { name: 'System history', exact: true });
          await assertLocatorFocused(history); await assertVisibleFocusOutline(history);
        }
        await page.goto(`${baseUrl}/app/missing`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Missing Music', exact: true }).waitFor(); await logoutThroughUi(page);
      }
      assert.deepEqual(observations.reads, []);
      assert.deepEqual((await client.requestJson('/api/v1/activity/ignored-source-users')).payload, beforeList);
      assert.deepEqual(observations.errors, []);
    }, { scenarioName: 'ignored_route_role_refusal' });
  });
  test('cached administrator revocation and failed verification cannot admit the shell; password-change precedence and retry stay usable', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async ({ baseUrl, browserContext, page, client, getPoolFn }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const authenticated = await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' });
      const id = authenticated.payload.user.id; const observations = observe(page);
      let nav = await openDiagnostics(page, baseUrl);
      await getPoolFn().query('UPDATE app_users SET must_change_password=true WHERE id=$1', [id]);
      await nav.getByRole('link', { name: 'Ignored source users', exact: true }).press('Enter');
      await page.waitForURL(url => url.pathname === '/app/account-security'); assert.deepEqual(observations.reads, []);
      await getPoolFn().query('UPDATE app_users SET must_change_password=false WHERE id=$1', [id]);
      nav = await openDiagnostics(page, baseUrl);
      await getPoolFn().query("UPDATE app_users SET role='operator' WHERE id=$1", [id]);
      await nav.getByRole('link', { name: 'Ignored source users', exact: true }).press('Enter');
      await page.waitForURL(`${baseUrl}/app`); assert.deepEqual(observations.reads, []);
      assert.equal((await client.requestJson('/api/v1/activity/ignored-source-users')).response.status, 403);
      await getPoolFn().query("UPDATE app_users SET role='admin' WHERE id=$1", [id]);
      nav = await openDiagnostics(page, baseUrl);
      const pattern = '**/api/v1/auth/session';
      await browserContext.route(pattern, route => route.fulfill({ status: 503, json: { message: 'private-session-failure' } }));
      const ignored = nav.getByRole('link', { name: 'Ignored source users', exact: true }); await ignored.focus(); await ignored.press('Enter');
      const alert = page.getByRole('alert').filter({ hasText: 'Could not verify administrator access. Try again.' }); await alert.waitFor();
      assert.equal(new URL(page.url()).pathname, '/app/activity/feed'); assert.deepEqual(observations.reads, []);
      await assertLocatorFocused(ignored); assert.doesNotMatch(await alert.textContent(), /private-session/);
      await browserContext.unroute(pattern); await ignored.press('Enter'); await page.waitForURL(`${baseUrl}/app/activity/ignored`);
      await page.getByRole('heading', { name: 'Ignored source users', exact: true }).waitFor();
      assert.deepEqual(observations.mutations, []); assert.deepEqual(observations.errors, []);
    }, { scenarioName: 'ignored_route_current_authority' });
  });
});
