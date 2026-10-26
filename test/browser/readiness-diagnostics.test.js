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
const snapshot = { scope: 'process', failureCount: 25, lastCheck: { outcome: 'healthy', observedAt: '2026-10-26T12:00:00Z' },
  log: { loggedCount: 2, suppressedCount: 23, backpressured: true }, recentFailures: Array.from({ length: 16 }, (_, index) => ({
    reference: '00000000-0000-4000-8000-' + String(index).padStart(12, '0'), stage: 'active_jobs', category: 'database_query', code: '42P01',
    httpStatus: 500, observedAt: '2026-10-26T12:00:00Z', message: 'private-readiness-marker' })) };

test('administrator readiness history renders bounded facts and unavailable/error recovery without moving refresh focus', { timeout: config.scenarioTimeoutMs }, async () => {
  await runtime.runScenario(async ({ baseUrl, page, browserContext }) => {
    await bootstrapAdminThroughUi(page, { baseUrl });
    let mode = 'populated', requests = 0;
    const started = Promise.withResolvers(), release = Promise.withResolvers(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await browserContext.route('**/api/v1/system/diagnostics/recovery-state*', async route => {
      requests++; if (requests === 1) { started.resolve(); await release.promise; }
      await route.fulfill({ status: mode === 'error' ? 503 : 200, contentType: 'application/json', body: JSON.stringify(mode === 'error'
        ? { error: { message: 'Diagnostics temporarily unavailable.' } }
        : { ok: true, recentFailedRuns: [], recentPrivilegedActions: [], readiness: mode === 'unavailable' ? null
          : mode === 'log_error' ? { ...snapshot, log: { ...snapshot.log, outputUnavailable: true } } : snapshot }) });
    });
    try {
      await page.goto(`${baseUrl}/app/settings/recovery`, { waitUntil: 'domcontentloaded' }); await started.promise;
      await page.getByRole('button', { name: 'Open diagnostics', exact: true }).click();
      const disclosure = page.locator('#settings-recovery-diagnostics');
      await disclosure.getByRole('status').filter({ hasText: 'Loading diagnostics' }).waitFor();
      release.resolve();
      const panel = page.getByRole('region', { name: 'Readiness checks', exact: true }); await panel.waitFor();
      assert.equal(await panel.locator('li').count(), 5); assert.doesNotMatch(await panel.textContent(), /private-readiness-marker/u);
      assert.match(await panel.textContent(), /Active job count/u); assert.match(await panel.textContent(), /42P01/u);
      assert.match(await panel.textContent(), /resets on restart/u); assert.match(await panel.textContent(), /waiting to drain/u);
      const refresh = disclosure.getByRole('button', { name: 'Refresh diagnostics', exact: true });
      mode = 'log_error'; await refresh.click(); await panel.getByText('Diagnostic log output is unavailable. Failure history remains available in this process.').waitFor();
      mode = 'unavailable'; await refresh.click(); await panel.getByText('Readiness diagnostics are unavailable.').waitFor();
      assert.equal(await refresh.evaluate(node => node === globalThis.document.activeElement), true);
      mode = 'error'; await refresh.click(); await disclosure.getByRole('alert').waitFor(); assert.equal(await panel.count(), 0);
      mode = 'populated'; await refresh.click(); await panel.waitFor(); assert.equal(requests, 5);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await panel.evaluate(node => node.scrollWidth <= node.clientWidth), true);
      if (process.env.HARMONIARR_READINESS_SCREENSHOT_DIR) await panel.screenshot({ animations: 'disabled', path: join(process.env.HARMONIARR_READINESS_SCREENSHOT_DIR, 'readiness-mobile.png') });
      assert.deepEqual(errors, []);
    } finally { release.resolve(); }
  }, { scenarioName: 'readiness_diagnostics' });
});
