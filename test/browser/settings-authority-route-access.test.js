import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi, loginThroughUi, logoutThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { assertLocatorFocused, assertVisibleFocusOutline } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { loginWithPassword } from '../../testing/integration/auth-helpers.js';
import { createFixtureGate, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const config = resolveIntegrationTestRuntimeConfig();
const pages = [
  { path: 'media-storage', label: 'Media & storage', heading: 'Media folders', reads: ['/api/v1/settings', '/api/v1/artwork/quota', '/api/v1/artwork/quota/history'] },
  { path: 'library', label: 'Library', heading: 'Discovery scheduling', reads: ['/api/v1/settings'] },
  { path: 'system', label: 'System & security', heading: 'Security configuration', reads: ['/api/v1/settings'] },
  { path: 'users', label: 'Users & access', heading: 'Account access', reads: ['/api/v1/users', '/api/v1/users/linked-accounts/plex'] },
  { path: 'users/:id', label: 'View user details', heading: 'admin', reads: ['/api/v1/users/:id/detail', '/api/v1/users/:id/activity'] },
  { path: 'recovery', label: 'Backup & restore', heading: 'Recovery status', reads: ['/api/v1/recovery/backups', '/api/v1/recovery/maintenance-locks', '/api/v1/system/diagnostics/queue-state', '/api/v1/system/diagnostics/recovery-state'] },
];
const resolveId = (value, id) => value.replace(':id', id);
const apiPaths = id => [...new Set(pages.flatMap(spec => spec.reads.map(path => resolveId(path, id)))), '/api/v1/system/fs/browse'];
let runtime;

async function runScenario(callback, options) {
  return runtime.runScenario(async context => {
    try {
      return await callback(context);
    } catch (error) {
      await mkdir('.tmp/settings-authority-2026-10-21', { recursive: true });
      await context.page.screenshot({ path: `.tmp/settings-authority-2026-10-21/${options.scenarioName}-failure.png`, timeout: 5000 }).catch(() => {});
      throw error;
    }
  }, options);
}

async function openAccount(page, baseUrl) {
  await page.goto(`${baseUrl}/app/settings/account`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'My account', exact: true }).waitFor();
}

function observe(page, paths) {
  const reads = []; const mutations = []; const errors = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (paths.includes(path)) reads.push(path);
    if (path.startsWith('/api/') && !path.startsWith('/api/v1/auth/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(path);
  });
  page.on('pageerror', error => errors.push(error.message));
  return { reads, mutations, errors };
}

suite('Settings deployment authority and personal/operator destinations', () => {
  before(async () => { runtime = await createBrowserSmokeRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  for (const spec of pages) test(`${spec.label}: native current-session verification precedes every mounted reader`, { timeout: config.scenarioTimeoutMs }, async t => {
    await runScenario(async ({ baseUrl, page, browserContext, client }) => withFixtureLifecycle({ signal: t.signal }, async scope => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const session = await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' });
      const id = session.payload.user.id;
      await openAccount(page, baseUrl);
      if (spec.path === 'users/:id') {
        await page.goto(`${baseUrl}/app/settings/users`); await page.getByRole('link', { name: spec.label, exact: true }).waitFor();
      }
      const paths = spec.reads.map(path => resolveId(path, id)); const observations = observe(page, paths);
      const link = page.getByRole('link', { name: spec.label, exact: true }); await link.focus();
      const from = page.url(); const hold = createFixtureGate({ signal: scope.signal }); const reached = createFixtureGate({ signal: scope.signal });
      scope.onRelease(() => hold.release()); scope.onRelease(() => reached.release());
      await browserContext.route('**/api/v1/auth/session', route => scope.track((async () => {
        const response = await route.fetch({ maxRetries: 0 }); assert.equal(response.status(), 200);
        reached.release(); await hold.promise; await route.fulfill({ response });
      })()));
      await link.press('Enter'); await reached.promise;
      assert.equal(page.url(), from); assert.deepEqual(observations.reads, []);
      const loaded = paths.map(path => page.waitForResponse(response => new URL(response.url()).pathname === path && response.status() === 200));
      hold.release(); await page.waitForURL(`${baseUrl}/app/settings/${resolveId(spec.path, id)}`); await Promise.all(loaded);
      await page.getByRole('heading', { name: spec.heading, exact: true }).waitFor();
      assert.deepEqual(observations.mutations, []); assert.deepEqual(observations.errors, []);
    }), { scenarioName: `settings_authority_${spec.path.replace(/[^a-z]/gu, '_')}` });
  });

  test('anonymous/operator/requester direct and legacy links refuse deployment pages and their APIs', { timeout: config.scenarioTimeoutMs }, async () => {
    await runScenario(async ({ baseUrl, page, client, getPoolFn }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const admin = await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' }); const id = admin.payload.user.id;
      await logoutThroughUi(page); const observations = observe(page, apiPaths(id));
      for (const role of [null, 'operator', 'requester']) {
        const own = createSessionHttpClient(baseUrl);
        if (role) {
          const username = `authority-${role}`; const password = 'AuthorityRole123!';
          const created = await client.requestJson('/api/v1/users', { method: 'POST', json: { username, password, role } }); assert.equal(created.response.status, 201);
          await getPoolFn().query('UPDATE app_users SET must_change_password=false WHERE id=$1', [created.payload.user.id]);
          await loginThroughUi(page, { baseUrl, username, password }); await loginWithPassword(own, { username, password });
        }
        for (const path of [...pages.map(spec => `/app/settings/${resolveId(spec.path, id)}`), '/app/recovery']) {
          await page.goto(`${baseUrl}${path}?role=admin&returnTo=missing_music_decision&returnReleaseId=forged`, { waitUntil: 'domcontentloaded' });
          await page.waitForURL(url => url.pathname === (role ? '/app' : '/login'));
        }
        for (const path of apiPaths(id)) assert.equal((await own.requestJson(path)).response.status, role ? 403 : 401, path);
        for (const [path, method] of [['/api/v1/settings', 'PUT'], [`/api/v1/users/${id}`, 'PATCH'], ['/api/v1/recovery/maintenance-locks', 'POST']]) {
          assert.equal((await own.requestJson(path, { method, json: {} })).response.status, role ? 403 : 401, `${method} ${path}`);
        }
        if (role) {
          await openAccount(page, baseUrl);
          assert.deepEqual(await page.getByRole('navigation', { name: 'Settings sections', exact: true }).getByRole('link').allTextContents(), ['Notifications']);
          assert.deepEqual(await page.getByRole('navigation', { name: 'More settings sections', exact: true }).getByRole('link').allTextContents(), role === 'operator' ? ['Account', 'Metadata browser'] : ['Account']);
          await logoutThroughUi(page);
        }
      }
      assert.deepEqual(observations.reads, []); assert.deepEqual(observations.mutations, []); assert.deepEqual(observations.errors, []);
    }, { scenarioName: 'settings_authority_role_refusal' });
  });

  test('personal notifications persist only to the current user and operator metadata browsing remains available', { timeout: config.scenarioTimeoutMs }, async () => {
    await runScenario(async ({ baseUrl, page, client, getPoolFn }) => {
      await bootstrapAdminThroughUi(page, { baseUrl }); await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' });
      const initialAdmin = (await client.requestJson('/api/v1/users/me/preferences')).payload.preferences;
      await logoutThroughUi(page); const observations = observe(page, apiPaths('unselected'));
      for (const role of ['operator', 'requester']) {
        const username = `personal-${role}`; const password = 'PersonalRole123!';
        const created = await client.requestJson('/api/v1/users', { method: 'POST', json: { username, password, role } }); assert.equal(created.response.status, 201);
        await getPoolFn().query('UPDATE app_users SET must_change_password=false WHERE id=$1', [created.payload.user.id]);
        const own = createSessionHttpClient(baseUrl); await loginWithPassword(own, { username, password });
        await loginThroughUi(page, { baseUrl, username, password }); await openAccount(page, baseUrl);
        const notifications = page.getByRole('navigation', { name: 'Settings sections', exact: true }).getByRole('link', { name: 'Notifications', exact: true });
        await notifications.focus(); await assertVisibleFocusOutline(notifications); await notifications.press('Enter');
        await page.getByRole('heading', { name: 'Notification categories', exact: true }).waitFor();
        const toggle = page.getByRole('checkbox', { name: /^Request fulfilled/ }); await toggle.waitFor();
        await page.waitForFunction(() => !globalThis.document.querySelector('.sn-category input')?.disabled);
        const old = await toggle.isChecked();
        const saved = page.waitForResponse(response => new URL(response.url()).pathname === '/api/v1/users/me/preferences' && response.request().method() === 'PATCH' && response.status() === 200);
        await toggle.focus(); await toggle.press('Space'); await saved;
        assert.equal((await own.requestJson('/api/v1/users/me/preferences')).payload.preferences.notificationPreferences.requestFulfilled, !old);
        assert.deepEqual((await client.requestJson('/api/v1/users/me/preferences')).payload.preferences, initialAdmin);
        await page.goto(`${baseUrl}/app/settings/notifications`); await page.getByRole('heading', { name: 'Notification categories', exact: true }).waitFor();
        await page.waitForFunction(expected => globalThis.document.querySelector('.sn-category input')?.checked === expected, !old);
        if (role === 'operator') {
          await page.goto(`${baseUrl}/app/metadata`); await page.waitForURL(`${baseUrl}/app/settings/library-browser`);
          await page.getByRole('heading', { name: 'Artist Metadata', exact: true }).waitFor();
        } else {
          await page.goto(`${baseUrl}/app/metadata`); await page.waitForURL(`${baseUrl}/app`);
          await page.goto(`${baseUrl}/app/settings/library-browser`); await page.waitForURL(`${baseUrl}/app`);
        }
        await page.goto(`${baseUrl}/app/account-security`); await page.getByRole('heading', { name: 'My account', exact: true }).waitFor();
        if (role === 'requester') {
          await page.setViewportSize({ width: 390, height: 1000 });
          await openAccount(page, baseUrl); await mkdir('.tmp/settings-authority-2026-10-21', { recursive: true });
          await page.screenshot({ path: '.tmp/settings-authority-2026-10-21/requester-account-mobile.png', fullPage: true, animations: 'disabled' });
        }
        await logoutThroughUi(page);
      }
      assert.deepEqual(observations.reads, []);
      assert.deepEqual(observations.mutations, ['/api/v1/users/me/preferences', '/api/v1/users/me/preferences']); assert.deepEqual(observations.errors, []);
    }, { scenarioName: 'settings_personal_preferences_metadata' });
  });

  test('Media verification failure/retry and cached revocation keep bounded feedback and owned focus', { timeout: config.scenarioTimeoutMs }, async () => {
    await runScenario(async ({ baseUrl, page, browserContext, client, getPoolFn }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const session = await loginWithPassword(client, { username: 'admin', password: 'BrowserPass123!' }); const id = session.payload.user.id;
      await openAccount(page, baseUrl); const observations = observe(page, apiPaths(id));
      const media = page.getByRole('link', { name: 'Media & storage', exact: true }); const pattern = '**/api/v1/auth/session';
      await browserContext.route(pattern, route => route.fulfill({ status: 503, json: { message: 'private-session-failure' } }));
      await media.focus(); await media.press('Enter');
      const alert = page.getByRole('alert').filter({ hasText: 'Could not verify administrator access. Try again.' }); await alert.waitFor();
      assert.equal(new URL(page.url()).pathname, '/app/settings/account'); assert.deepEqual(observations.reads, []); await assertLocatorFocused(media);
      assert.doesNotMatch(await alert.textContent(), /private-session/);
      await browserContext.unroute(pattern); await media.press('Enter'); await page.getByRole('heading', { name: 'Media folders', exact: true }).waitFor();
      await openAccount(page, baseUrl); observations.reads.length = 0;
      await getPoolFn().query("UPDATE app_users SET role='operator' WHERE id=$1", [id]);
      await page.getByRole('link', { name: 'Media & storage', exact: true }).press('Enter'); await page.waitForURL(`${baseUrl}/app`);
      assert.deepEqual(observations.reads, []); assert.deepEqual(observations.mutations, []); assert.deepEqual(observations.errors, []);
    }, { scenarioName: 'settings_media_current_authority' });
  });
});
