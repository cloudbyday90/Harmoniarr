/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
const config = resolveIntegrationTestRuntimeConfig(); let runtime;
before(async () => { runtime = await createBrowserSmokeRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
const messages = { unavailable: 'Database migration status is unavailable. Refresh to try again.', attention: '1 migration still needs attention.', complete: 'Database migrations are current.' };
function payload(status) {
  const issueCount = status === 'complete' ? 0 : 1;
  return { summary: { status: issueCount ? 'attention' : 'complete', issueCount, completeStepCount: 1 - issueCount, totalStepCount: 1, message: issueCount ? '1 setup item needs attention.' : 'Setup is ready.' },
    nextAction: null, steps: [{ id: 'database', title: 'Check database migrations', status, message: messages[status] }] };
}
const fulfill = (route, mode) => route.fulfill({ status: mode === 'error' ? 503 : 200, contentType: 'application/json',
  body: JSON.stringify(mode === 'error' ? { error: { message: 'private SELECT /secret 42P01' } } : payload(mode)) });
const focused = locator => locator.evaluate(node => node === globalThis.document.activeElement);

test('setup feedback distinguishes unknown state and retains results, status identity and keyboard focus across refresh', { timeout: config.scenarioTimeoutMs }, async () => {
  await runtime.runScenario(async ({ baseUrl, page, browserContext }) => {
    await bootstrapAdminThroughUi(page, { baseUrl });
    const first = Promise.withResolvers(), firstRelease = Promise.withResolvers(), refreshing = Promise.withResolvers(), refreshRelease = Promise.withResolvers();
    let requests = 0, mode = 'unavailable'; const errors = []; page.on('pageerror', error => errors.push(error.message));
    await browserContext.route('**/api/v1/system/onboarding', async route => {
      requests++;
      if (requests === 1) { first.resolve(); await firstRelease.promise; }
      if (requests === 2) { refreshing.resolve(); await refreshRelease.promise; }
      await fulfill(route, mode);
    });
    try {
      await page.goto(baseUrl + '/app/onboarding', { waitUntil: 'domcontentloaded' }); await first.promise;
      const panel = page.locator('.onboarding-panel'), status = panel.getByRole('status'), refresh = panel.getByRole('button', { name: 'Refresh', exact: true });
      const hide = panel.getByRole('button', { name: 'Hide setup mode', exact: true });
      const statusNode = await status.elementHandle(); assert.equal(await status.getAttribute('aria-atomic'), 'true');
      assert.equal(await status.evaluate(node => node.closest('[aria-busy]') === null), true);
      await status.getByText('Checking setup readiness…', { exact: true }).waitFor();
      assert.equal(await refresh.getAttribute('aria-disabled'), 'true');
      const results = page.locator('#' + await refresh.getAttribute('aria-controls')); assert.equal(await results.getAttribute('aria-busy'), 'true');
      await refresh.focus(); await refresh.press('Enter'); await refresh.press('Space'); assert.equal(requests, 1);
      firstRelease.resolve(); await status.getByText('Setup status updated. Database migration status is unavailable.', { exact: true }).waitFor();
      await panel.getByText('Unavailable', { exact: true }).waitFor(); assert.equal(await focused(refresh), true);
      assert.doesNotMatch(await panel.textContent(), /1 migration|migration_status_unavailable/u); assert.equal(await results.getAttribute('aria-busy'), 'false');
      await page.setViewportSize({ width: 390, height: 1000 }); assert.equal(await panel.evaluate(node => node.scrollWidth <= node.clientWidth), true);
      if (process.env.HARMONIARR_ONBOARDING_SCREENSHOT_DIR) await panel.screenshot({ animations: 'disabled', path: join(process.env.HARMONIARR_ONBOARDING_SCREENSHOT_DIR, 'unavailable-mobile.png') });
      mode = 'attention'; await refresh.press('Enter'); await refreshing.promise;
      await status.getByText('Refreshing setup status…', { exact: true }).waitFor(); await refresh.press('Enter'); await refresh.press('Space'); assert.equal(requests, 2);
      await panel.getByText('Unavailable', { exact: true }).waitFor(); await hide.focus(); refreshRelease.resolve();
      await panel.getByText('1 migration still needs attention.', { exact: true }).waitFor(); assert.equal(await focused(hide), true);
      mode = 'error'; await refresh.click(); await status.getByText(/last successful checklist is still shown/u).waitFor();
      await panel.getByText('1 migration still needs attention.', { exact: true }).waitFor(); assert.equal(await focused(refresh), true);
      assert.doesNotMatch(await panel.textContent(), /private|SELECT|secret|42P01/u);
      mode = 'complete'; await refresh.press('Space'); await status.getByText('Setup status updated.', { exact: true }).waitFor();
      await panel.getByText('Database migrations are current.', { exact: true }).waitFor(); assert.equal(await focused(refresh), true);
      assert.equal(await statusNode.evaluate(node => node.isConnected), true); assert.equal(await panel.getByRole('status').count(), 1);
      assert.equal(requests, 4); assert.deepEqual(errors, []);
    } finally { firstRelease.resolve(); refreshRelease.resolve(); }
  }, { scenarioName: 'onboarding_unknown_refresh' });
});

test('initial setup failure can retry and navigating away retires a held refresh without restoring the panel', { timeout: config.scenarioTimeoutMs }, async () => {
  await runtime.runScenario(async ({ baseUrl, page, browserContext }) => {
    await bootstrapAdminThroughUi(page, { baseUrl }); let requests = 0;
    const held = Promise.withResolvers(), release = Promise.withResolvers(), finished = Promise.withResolvers();
    await browserContext.route('**/api/v1/system/onboarding', async route => {
      requests++;
      if (requests === 3) { held.resolve(); await release.promise; }
      try { await fulfill(route, requests === 1 ? 'error' : 'complete'); } finally { if (requests === 3) finished.resolve(); }
    });
    try {
      await page.goto(baseUrl + '/app/onboarding', { waitUntil: 'domcontentloaded' });
      const panel = page.locator('.onboarding-panel'), refresh = panel.getByRole('button', { name: 'Refresh', exact: true });
      await panel.getByRole('status').getByText('Setup status is unavailable. Refresh to try again.', { exact: true }).waitFor();
      assert.equal(await panel.locator('.onboarding-step-card').count(), 0);
      await refresh.press('Enter'); await panel.getByText('Database migrations are current.', { exact: true }).waitFor();
      await refresh.press('Enter'); await held.promise; await panel.getByRole('button', { name: 'Hide setup mode', exact: true }).click();
      await page.waitForURL(url => url.pathname !== '/app/onboarding'); release.resolve(); await finished.promise;
      assert.equal(await page.locator('.onboarding-panel').count(), 0); assert.equal(requests, 3);
    } finally { release.resolve(); }
  }, { scenarioName: 'onboarding_error_navigation' });
});
