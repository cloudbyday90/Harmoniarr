/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { assertLocatorFocused } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { armBootstrapAdminRecovery } from '../../testing/integration/admin-recovery-helpers.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { acquireIntegrationLock, releaseIntegrationLock } from '../../testing/integration/recovery-helpers.js';
import { createFixtureGate, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createSessionHttpClient } from '../../testing/server/http-session-client.js';

const config = resolveIntegrationTestRuntimeConfig();
const root = '.tmp/recovery-form-feedback-2026-10-21';
const completePath = '/api/v1/recovery/bootstrap-admin/complete';
const statusPath = '/api/v1/recovery/bootstrap-admin/status';
let runtime;

async function snapshot(page, name) {
  await mkdir(root, { recursive: true });
  await page.screenshot({ path: `${root}/${name}.png`, fullPage: true, timeout: 5000,
    mask: [page.locator('input[name="recoveryCode"]'), page.locator('input[type="password"]')] });
}
async function scenario(t, name, run) {
  await runtime.runScenario(context => withFixtureLifecycle({ signal: t.signal }, async scope => {
    const errors = []; context.page.on('pageerror', error => errors.push(error.message));
    try { await run(context, scope); assert.deepEqual(errors, []); }
    catch (error) { try { await snapshot(context.page, `${name}-failure`); } catch { /* Keep original failure. */ } throw error; }
  }), { scenarioName: name });
}
async function prepare({ client, baseUrl, page }) {
  assert.equal((await bootstrapAdminSession(client)).response.status, 201);
  const armed = await armBootstrapAdminRecovery({ reason: 'native recovery feedback qualification' });
  await page.goto(`${baseUrl}/recover/bootstrap-admin`);
  await page.getByRole('button', { name: 'Complete recovery', exact: true }).waitFor();
  return armed;
}
async function fill(page, code) {
  await page.getByLabel('Recovery code', { exact: true }).fill(code);
  await page.getByLabel('Username', { exact: true }).fill('recoveredadmin');
  await page.getByLabel('Password', { exact: true }).fill('RecoveredPass123!');
  await page.getByLabel('Confirm password', { exact: true }).fill('RecoveredPass123!');
}
const submitButton = page => page.getByRole('button', { name: /^(Complete recovery|Recovering\.\.\.)$/u });
async function runRow(pool, id) {
  return (await pool.query('SELECT status, invalid_attempt_count FROM admin_recovery_runs WHERE id=$1', [id])).rows[0];
}
async function submitted(page) {
  const response = page.waitForResponse(r => new URL(r.url()).pathname === completePath);
  await submitButton(page).press('Enter'); return response;
}

suite('Recovery feedback with actual armed runs and server safeguards', () => {
  before(async () => { runtime = await createBrowserSmokeRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('local correction sends no POST; one failed attempt survives held refresh; success revokes sessions and owns completion focus', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'recovery_feedback_lifecycle', async (context, scope) => {
      const { page, baseUrl, client, getPoolFn, browserContext } = context;
      const armed = await prepare(context); let posts = 0;
      const postReached = createFixtureGate({ signal: scope.signal }); const postHold = createFixtureGate();
      const refreshReached = createFixtureGate({ signal: scope.signal }); const refreshHold = createFixtureGate();
      scope.onRelease(() => postHold.release()); scope.onRelease(() => refreshHold.release());
      await page.route(`**${completePath}`, route => scope.track((async () => {
        posts++; const response = await route.fetch({ maxRetries: 0 });
        assert.equal(response.headers()['set-cookie'], undefined);
        postReached.release(response.status()); await postHold.promise; await route.fulfill({ response });
      })()));
      await fill(page, 'HARM-WRONG-CODE-1234');
      const confirm = page.getByLabel('Confirm password', { exact: true });
      assert.equal(await confirm.getAttribute('aria-invalid'), null);
      await confirm.fill('DifferentPass123!'); await submitButton(page).press('Enter'); await assertLocatorFocused(confirm);
      assert.equal(await confirm.getAttribute('aria-invalid'), 'true'); assert.equal(await confirm.getAttribute('aria-describedby'), 'recovery-password-match');
      assert.equal(posts, 0); assert.equal((await runRow(getPoolFn(), armed.runId)).invalid_attempt_count, 0);
      await confirm.fill('RecoveredPass123!');
      await page.waitForFunction(() => !globalThis.document.querySelector('#confirm-new-password').hasAttribute('aria-invalid'));
      const alert = page.getByRole('alert'); await alert.evaluate(el => { el.dataset.recoveryFeedback = 'initial'; });
      await page.route(`**${statusPath}`, route => scope.track((async () => {
        const response = await route.fetch({ maxRetries: 0 }); refreshReached.release(); await refreshHold.promise; await route.fulfill({ response });
      })()));
      await submitButton(page).press('Enter'); assert.equal(await postReached.promise, 401);
      await page.getByRole('status').filter({ hasText: 'Completing recovery…' }).waitFor();
      await page.locator('form').evaluate(el => el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      const loginLink = page.getByRole('link', { name: 'Return to local login', exact: true }); await loginLink.focus();
      postHold.release(); await refreshReached.promise;
      await alert.getByText('Recovery code is invalid or expired', { exact: true }).waitFor();
      assert.equal(await submitButton(page).isDisabled(), true); assert.equal(posts, 1);
      refreshHold.release(); await page.waitForFunction(() => !globalThis.document.querySelector('form button[type="submit"]').disabled);
      await assertLocatorFocused(loginLink); assert.equal(await alert.getAttribute('data-recovery-feedback'), 'initial');
      assert.equal((await runRow(getPoolFn(), armed.runId)).invalid_attempt_count, 1);
      assert.equal(await alert.textContent().then(text => text.trim()), 'Recovery code is invalid or expired');
      for (const theme of ['light', 'dark']) for (const width of [1280, 800, 390]) {
        await page.setViewportSize({ width, height: 900 }); await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
        assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true);
        await alert.scrollIntoViewIfNeeded(); assert.equal(await alert.isVisible(), true); await snapshot(page, `recovery-${theme}-${width}`);
      }
      await page.getByLabel('Recovery code', { exact: true }).fill(armed.recoveryCode);
      assert.equal((await submitted(page)).status(), 200);
      const heading = page.getByRole('heading', { name: 'Admin account recovered successfully', exact: true });
      await heading.waitFor(); await assertLocatorFocused(heading); assert.equal(posts, 2);
      assert.equal((await client.requestJson('/api/v1/auth/session')).payload.user, null);
      assert.deepEqual(await browserContext.cookies(), []);
      assert.equal((await runRow(getPoolFn(), armed.runId)).status, 'completed');
      const anonymous = createSessionHttpClient(baseUrl);
      assert.equal((await anonymous.requestJson(completePath, { method: 'POST', json: { recoveryCode: armed.recoveryCode,
        username: 'recoveredadmin', password: 'RecoveredPass123!', confirmPassword: 'RecoveredPass123!' } })).response.status, 401);
      await page.getByRole('button', { name: 'Go to login', exact: true }).press('Enter');
      await page.getByLabel('Username or email').fill('recoveredadmin'); await page.getByLabel('Password', { exact: true }).fill('RecoveredPass123!');
      await page.getByRole('button', { name: 'Log in', exact: true }).press('Enter'); await page.waitForURL(/\/app(?:\/onboarding)?$/u);
    });
  });

  test('fresh server safety hold and expiry refuse a formerly enabled form without consuming invalid attempts', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'recovery_feedback_safeguards', async (context, scope) => {
      const { page, client, getPoolFn } = context; const armed = await prepare(context); await fill(page, armed.recoveryCode);
      const lock = await acquireIntegrationLock(getPoolFn(), { lockType: 'restore', reason: 'owned recovery refusal fixture' });
      scope.onRelease(() => releaseIntegrationLock(getPoolFn(), lock.id));
      const held = await submitted(page); assert.equal(held.status(), 409);
      await page.getByRole('alert').getByText('Recovery cannot complete while conflicting maintenance locks are active', { exact: true }).waitFor();
      await page.waitForFunction(() => globalThis.document.querySelector('form button[type="submit"]').disabled);
      await assertLocatorFocused(page.getByRole('region', { name: 'Recovery feedback', exact: true }));
      assert.equal((await runRow(getPoolFn(), armed.runId)).invalid_attempt_count, 0);
      await releaseIntegrationLock(getPoolFn(), lock.id); await page.reload(); await fill(page, armed.recoveryCode);
      await getPoolFn().query("UPDATE admin_recovery_runs SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1", [armed.runId]);
      assert.equal((await submitted(page)).status(), 401);
      await page.getByRole('alert').locator('p').waitFor();
      await page.waitForFunction(() => !globalThis.document.querySelector('form'));
      await assertLocatorFocused(page.getByRole('region', { name: 'Recovery feedback', exact: true }));
      assert.deepEqual(await runRow(getPoolFn(), armed.runId), { status: 'expired', invalid_attempt_count: 0 });
      assert.equal((await client.requestJson('/api/v1/auth/session')).payload.user.username, 'admin');
      assert.equal((await getPoolFn().query("SELECT count(*)::int AS count FROM app_users WHERE username='recoveredadmin'")).rows[0].count, 0);
    });
  });

  test('five native invalid attempts exhaust the server budget and retain the terminal refusal after the form disappears', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'recovery_feedback_attempts', async context => {
      const { page, client, getPoolFn } = context; const armed = await prepare(context); await fill(page, 'HARM-WRONG-CODE-1234');
      for (let attempt = 1; attempt <= 5; attempt++) {
        assert.equal((await submitted(page)).status(), attempt === 5 ? 429 : 401);
        await page.getByRole('alert').locator('p').waitFor();
        if (attempt < 5) {
          await page.waitForFunction(() => !globalThis.document.querySelector('form button[type="submit"]').disabled);
          await assertLocatorFocused(submitButton(page));
        } else {
          await page.waitForFunction(() => !globalThis.document.querySelector('form'));
          await assertLocatorFocused(page.getByRole('region', { name: 'Recovery feedback', exact: true }));
        }
        assert.equal((await runRow(getPoolFn(), armed.runId)).invalid_attempt_count, attempt);
      }
      assert.equal((await runRow(getPoolFn(), armed.runId)).status, 'invalidated');
      assert.equal(await page.getByRole('alert').textContent().then(text => text.trim()), 'Too many invalid attempts');
      assert.equal((await client.requestJson('/api/v1/auth/session')).payload.user.username, 'admin');
      assert.equal((await getPoolFn().query('SELECT count(*)::int AS count FROM app_users')).rows[0].count, 1);
    });
  });
});
