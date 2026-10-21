/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { assertLocatorFocused } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { armBootstrapAdminRecovery } from '../../testing/integration/admin-recovery-helpers.js';
import { bootstrapAdminSession } from '../../testing/integration/auth-helpers.js';
import { createFixtureGate, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
const root = '.tmp/recovery-countdown-2026-10-21';
const statusPath = '/api/v1/recovery/bootstrap-admin/status';

test('built recovery timer advances with unchanged server expiry, catches controlled wake before held refresh and retires on navigation', {
  timeout: config.suiteSetupTimeoutMs + config.scenarioTimeoutMs + config.suiteTeardownTimeoutMs,
}, async t => {
  const runtime = await createBrowserSmokeRuntime({ config });
  try {
    await runtime.runScenario(context => withFixtureLifecycle({ signal: t.signal }, async scope => {
      const { page, baseUrl, client, getPoolFn } = context;
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      assert.equal((await bootstrapAdminSession(client)).response.status, 201);
      const armed = await armBootstrapAdminRecovery({ reason: 'owned recovery countdown fixture' });
      const row = (await getPoolFn().query('SELECT expires_at FROM admin_recovery_runs WHERE id=$1', [armed.runId])).rows[0];
      const deadline = new Date(row.expires_at).getTime();
      // Only browser time is controlled; server/database clocks remain native.
      await page.clock.install({ time: new Date(deadline - 90_100) });
      await page.clock.pauseAt(new Date(deadline - 90_000));
      let reads = 0; let posts = 0; let holdWake = false;
      const reached = createFixtureGate({ signal: scope.signal }); const hold = createFixtureGate();
      scope.onRelease(() => hold.release());
      await page.route(`**${statusPath}`, route => scope.track((async () => {
        reads++; const response = await route.fetch({ maxRetries: 0 });
        if (holdWake) { reached.release(); await hold.promise; }
        await route.fulfill({ response });
      })()));
      page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname.includes('/recovery/')) posts++; });
      await page.goto(`${baseUrl}/recover/bootstrap-admin`);
      const timer = page.getByRole('timer', { name: 'Time remaining', exact: true });
      await page.waitForFunction(() => globalThis.document.querySelector('[role="timer"]')?.textContent === '1:30');
      assert.equal(await timer.getAttribute('aria-live'), null); // timer has implicit live=off.
      assert.equal(await timer.evaluate(el => el.parentElement.closest('[role="status"], [role="alert"], [aria-live="polite"], [aria-live="assertive"]')), null);
      const feedback = page.getByRole('region', { name: 'Recovery feedback', exact: true }).getByRole('status');
      await feedback.evaluate(el => { el.dataset.clockFeedback = 'stable'; });
      await page.clock.runFor(1000); assert.equal(await timer.textContent(), '1:29'); assert.equal(reads, 1);
      assert.equal((await feedback.textContent()).trim(), '');
      const poll = page.waitForResponse(response => new URL(response.url()).pathname === statusPath);
      await page.clock.runFor(9000); await poll;
      await page.waitForFunction(() => globalThis.document.querySelector('[role="timer"]')?.textContent === '1:20');
      await page.clock.runFor(1000); assert.equal(await timer.textContent(), '1:19'); assert.equal(reads, 2);
      const login = page.getByRole('link', { name: 'Return to local login', exact: true }); await login.focus();
      // Controlled visibility input, not a claim of physical tab/OS suspension.
      await page.evaluate(() => {
        Object.defineProperty(globalThis.document, 'hidden', { configurable: true, value: true });
        globalThis.document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.clock.setSystemTime(new Date(deadline + 1));
      holdWake = true;
      await page.evaluate(() => {
        Object.defineProperty(globalThis.document, 'hidden', { configurable: true, value: false });
        globalThis.document.dispatchEvent(new Event('visibilitychange'));
      });
      await reached.promise;
      assert.equal(await timer.textContent(), 'Expired');
      assert.equal(await page.getByRole('button', { name: 'Complete recovery', exact: true }).isDisabled(), true);
      assert.equal((await feedback.textContent()).trim(), 'This recovery run has expired. Arm a new run from the command line.');
      assert.equal(await feedback.getAttribute('data-clock-feedback'), 'stable'); await assertLocatorFocused(login);
      assert.equal(posts, 0);
      const native = (await getPoolFn().query('SELECT status, invalid_attempt_count FROM admin_recovery_runs WHERE id=$1', [armed.runId])).rows[0];
      assert.deepEqual(native, { status: 'armed', invalid_attempt_count: 0 });
      for (const [theme, width] of [['light', 1280], ['dark', 390]]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(value => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
        assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth), true);
        await mkdir(root, { recursive: true });
        await page.screenshot({ path: `${root}/expired-${theme}-${width}.png`, fullPage: true,
          mask: [page.locator('input[name="recoveryCode"]'), page.locator('input[type="password"]')] });
      }
      const response = page.waitForResponse(result => new URL(result.url()).pathname === statusPath);
      hold.release(); await response;
      await login.click(); await page.waitForURL('**/login');
      const after = reads;
      await page.evaluate(() => globalThis.document.dispatchEvent(new Event('visibilitychange')));
      await page.clock.runFor(20_000); assert.equal(reads, after); assert.equal(posts, 0); assert.deepEqual(errors, []);
    }), { scenarioName: 'recovery_countdown' });
  } finally { await runtime.cleanup(); }
});
