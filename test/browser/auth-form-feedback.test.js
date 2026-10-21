/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { assertLocatorFocused } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { createFixtureGate, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
const evidence = '.tmp/auth-form-feedback-2026-10-21';
let runtime;

async function scenario(t, name, run) {
  await runtime.runScenario(context => withFixtureLifecycle({ signal: t.signal }, async scope => {
    const errors = []; context.page.on('pageerror', error => errors.push(error.message));
    try { await run(context, scope); assert.deepEqual(errors, []); }
    catch (error) {
      try { await mkdir(evidence, { recursive: true }); await context.page.screenshot({ path: `${evidence}/${name}-failure.png`, fullPage: true, timeout: 5000 }); }
      catch { /* Preserve the scenario failure. */ }
      throw error;
    }
  }), { scenarioName: name });
}

async function holdResponse(page, scope, path, { controlled = false } = {}) {
  const reached = createFixtureGate({ signal: scope.signal }); const hold = createFixtureGate();
  const requests = [];
  scope.onRelease(() => hold.release());
  await page.route(`**${path}`, route => scope.track((async () => {
    requests.push(route.request().postDataJSON());
    const response = controlled ? null : await route.fetch({ maxRetries: 0 });
    reached.release(response?.status()); await hold.promise;
    if (controlled) await route.fulfill({ status: 503, json: { error: { message: 'Plex sign-in unavailable' } } });
    else await route.fulfill({ response });
  })()));
  return { reached, hold, requests };
}

async function mismatch(page, button, hintId, passwordLabel = 'Password') {
  const confirm = page.getByLabel('Confirm password', { exact: true });
  assert.equal(await confirm.getAttribute('aria-invalid'), null);
  await page.getByLabel(passwordLabel, { exact: true }).fill('BrowserPass123!');
  await confirm.fill('DifferentPass123!'); await button.press('Enter');
  await assertLocatorFocused(confirm);
  assert.equal(await confirm.getAttribute('aria-invalid'), 'true');
  assert.equal(await confirm.getAttribute('aria-describedby'), hintId);
  assert.equal(await page.locator(`#${hintId}`).textContent().then(text => text.trim()), 'Passwords do not match.');
  assert.equal(await page.getByRole('alert').textContent(), '');
  await confirm.fill('BrowserPass123!');
  await page.waitForFunction(id => globalThis.document.getElementById(id).textContent.trim() === 'Passwords match.', hintId);
  assert.equal(await confirm.getAttribute('aria-invalid'), null);
}

suite('Authentication form feedback through built UI and native auth routes', () => {
  before(async () => { runtime = await createBrowserSmokeRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('bootstrap mismatch is linked and corrected before one real successful administrator submission', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'auth_feedback_bootstrap', async ({ page, baseUrl, getPoolFn }, scope) => {
      await page.goto(`${baseUrl}/bootstrap`);
      await page.getByLabel('Username', { exact: true }).fill('admin');
      const control = await holdResponse(page, scope, '/api/v1/bootstrap/admin');
      const button = page.getByRole('button', { name: 'Create bootstrap admin', exact: true });
      await mismatch(page, button, 'bootstrap-password-match'); assert.deepEqual(control.requests, []);
      await page.getByRole('alert').evaluate(el => { el.dataset.feedbackFixture = 'initial'; });
      await button.press('Enter'); assert.equal(await control.reached.promise, 201);
      await page.getByRole('status').filter({ hasText: 'Creating account…' }).waitFor();
      await page.locator('form').evaluate(el => el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      assert.equal(control.requests.length, 1);
      control.hold.release(); await page.waitForURL(/\/app(?:\/onboarding)?$/u);
      assert.equal((await getPoolFn().query('SELECT count(*)::int AS count FROM app_users')).rows[0].count, 1);
    });
  });

  test('login pending/error regions persist, async failure preserves focus, retry succeeds and Plex shares admission', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'auth_feedback_login', async ({ page, baseUrl, browserContext }, scope) => {
      await bootstrapAdminThroughUi(page, { baseUrl }); await browserContext.clearCookies(); await page.goto(`${baseUrl}/login`);
      const username = page.getByLabel('Username or email'); const password = page.getByLabel('Password', { exact: true });
      const button = page.getByRole('button', { name: /^(Log in|Logging in\.\.\.)$/u });
      const plex = page.getByRole('button', { name: 'Continue with Plex', exact: true });
      const alert = page.getByRole('alert');
      await alert.evaluate(el => { el.dataset.feedbackFixture = 'initial'; globalThis.authFeedbackStates = [];
        new globalThis.MutationObserver(() => globalThis.authFeedbackStates.push(el.textContent.trim())).observe(el, { childList: true, subtree: true, characterData: true }); });
      await username.fill('admin'); await password.fill('WrongPassword123!');
      const control = await holdResponse(page, scope, '/api/v1/auth/login');
      await button.press('Enter'); assert.equal(await control.reached.promise, 401);
      await page.getByRole('status').filter({ hasText: 'Logging in…' }).waitFor();
      assert.equal(await button.isDisabled(), true); assert.equal(await plex.isDisabled(), true);
      await page.locator('form').evaluate(el => el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      await username.focus(); control.hold.release();
      await alert.getByText('Username or email and password combination is incorrect', { exact: true }).waitFor();
      await assertLocatorFocused(username); assert.equal(await alert.getAttribute('data-feedback-fixture'), 'initial');
      assert.equal(await username.getAttribute('aria-invalid'), null); assert.equal(await password.getAttribute('aria-invalid'), null);
      assert.equal(control.requests.length, 1);
      await button.press('Enter');
      await page.waitForFunction(() => globalThis.authFeedbackStates.filter(text => text === 'Username or email and password combination is incorrect').length === 2);
      assert.equal(control.requests.length, 2);
      const history = await page.evaluate(() => globalThis.authFeedbackStates);
      assert.ok(history.slice(history.indexOf('Username or email and password combination is incorrect') + 1).includes(''));
      await mkdir(evidence, { recursive: true });
      for (const theme of ['light', 'dark']) for (const width of [1280, 800, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
        assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true);
        await alert.scrollIntoViewIfNeeded(); assert.equal(await alert.isVisible(), true);
        await page.screenshot({ path: `${evidence}/login-${theme}-${width}.png`, fullPage: true });
      }
      const plexControl = await holdResponse(page, scope, '/api/v1/auth/plex/start', { controlled: true });
      await plex.press('Enter'); await plexControl.reached.promise;
      await page.getByRole('status').filter({ hasText: 'Opening Plex sign-in…' }).waitFor();
      assert.equal(await button.isDisabled(), true);
      await page.locator('form').evaluate(el => el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      await password.focus(); plexControl.hold.release(); await alert.getByText('Plex sign-in unavailable', { exact: true }).waitFor();
      await assertLocatorFocused(password); assert.equal(control.requests.length, 2); assert.equal(plexControl.requests.length, 1);
      await password.fill('BrowserPass123!'); await button.press('Enter'); await page.waitForURL(/\/app(?:\/onboarding)?$/u);
      assert.equal(control.requests.length, 3);
      assert.equal(control.requests[2].password, 'BrowserPass123!');
    });
  });

  test('account claim mismatch sends no request and real claim refusal is announced without credential-specific invalid state', { timeout: config.scenarioTimeoutMs }, async t => {
    await scenario(t, 'auth_feedback_claim', async ({ page, baseUrl, browserContext, getPoolFn }, scope) => {
      await bootstrapAdminThroughUi(page, { baseUrl }); await browserContext.clearCookies(); await page.goto(`${baseUrl}/claim-account`);
      await page.getByLabel('Username or email').fill('unclaimed-fixture');
      await page.getByLabel('Claim code', { exact: true }).fill('HCLM-AAAA-BBBB-CCCC');
      const control = await holdResponse(page, scope, '/api/v1/auth/claim');
      const button = page.getByRole('button', { name: 'Claim account', exact: true });
      await mismatch(page, button, 'claim-password-match', 'New password'); assert.deepEqual(control.requests, []);
      await button.press('Enter'); const status = await control.reached.promise; assert.ok(status >= 400 && status < 500);
      await page.getByRole('status').filter({ hasText: 'Claiming account…' }).waitFor();
      await page.getByLabel('Username or email').focus(); control.hold.release();
      await page.getByRole('alert').locator('p').waitFor();
      await assertLocatorFocused(page.getByLabel('Username or email'));
      assert.equal(control.requests.length, 1);
      assert.equal((await getPoolFn().query('SELECT count(*)::int AS count FROM app_users')).rows[0].count, 1);
    });
  });
});
