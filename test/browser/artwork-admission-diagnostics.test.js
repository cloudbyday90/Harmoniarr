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
const populated = { ok: true, queueState: { pending: 2, running: 1, failed: 3, totalTracked: 6 }, recentRuns: [],
  runtime: { artworkAdmission: { active: 1, queued: 1, queuedInputBytes: 800, reservedBytes: 1350566688, budgetBytes: 2147483648,
    concurrencyLimit: 2, queueLimit: 4, queuedInputLimitBytes: 33554432, queueTimeoutMs: 15000, capturedAt: '2026-10-25T16:00:00.000Z', privatePath: 'private-artwork-marker' },
  processMemory: { capturedAt: '2026-10-25T15:59:00.000Z', rssBytes: 100663296, heapUsedBytes: 33554432, externalBytes: 16777216, arrayBuffersBytes: 8388608 } } };

test('administrator artwork diagnostics render held loading, real field names, unknown/error recovery and narrow layout without moving refresh focus', { timeout: config.scenarioTimeoutMs }, async t => {
  await runtime.runScenario(async ({ baseUrl, page, browserContext }) => {
    await bootstrapAdminThroughUi(page, { baseUrl }); let mode = 'populated'; let requests = 0;
    const started = Promise.withResolvers(); const release = Promise.withResolvers(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await browserContext.route('**/api/v1/system/diagnostics/queue-state', async route => {
      requests++; if (requests === 1) { started.resolve(); await release.promise; }
      await route.fulfill({ status: mode === 'error' ? 503 : 200, contentType: 'application/json',
        body: JSON.stringify(mode === 'error' ? { error: { code: 'unavailable', message: 'Diagnostics temporarily unavailable.' } }
          : mode === 'unavailable' ? { ...populated, runtime: { artworkAdmission: null, processMemory: null } } : populated) });
    });
    try {
      await page.goto(`${baseUrl}/app/settings/recovery`, { waitUntil: 'domcontentloaded' }); await started.promise;
      await page.getByRole('button', { name: 'Open diagnostics', exact: true }).click();
      const disclosure = page.locator('#settings-recovery-diagnostics');
      await disclosure.getByRole('status').filter({ hasText: 'Loading diagnostics' }).waitFor();
      const pendingRefresh = disclosure.getByRole('button', { name: 'Refreshing...', exact: true });
      assert.equal(await pendingRefresh.getAttribute('aria-disabled'), 'true'); await pendingRefresh.focus(); await pendingRefresh.press('Enter'); assert.equal(requests, 1);
      release.resolve(); await disclosure.getByRole('status').filter({ hasText: 'Diagnostics updated.' }).waitFor();
      const panel = page.getByRole('region', { name: 'Artwork processing', exact: true }); await panel.waitFor();
      const value = label => panel.getByText(label, { exact: true }).locator('..').locator('dd');
      assert.equal(await value('Active jobs').textContent(), '1 / 2'); assert.equal(await value('Queued jobs').textContent(), '1 / 4');
      assert.equal(await value('Reserved capacity').textContent(), '1,288 MiB'); assert.equal(await value('Process RSS').textContent(), '96 MiB');
      assert.equal(await panel.locator('time').count(), 2); assert.doesNotMatch(await panel.textContent(), /private-artwork-marker/u);
      const queue = disclosure.locator('.cfg-group').filter({ hasText: 'Queue overview' });
      assert.deepEqual(await queue.locator('dd').allTextContents(), ['2', '1', '3', '6']);
      const refresh = disclosure.getByRole('button', { name: 'Refresh diagnostics', exact: true });
      mode = 'unavailable'; await refresh.click(); await panel.getByText('Artwork admission counters are unavailable.').waitFor();
      await panel.getByText('Process memory has no available sample.').waitFor(); assert.equal(await refresh.evaluate(node => node === globalThis.document.activeElement), true);
      mode = 'error'; await refresh.click(); await disclosure.getByRole('alert').waitFor(); assert.equal(await panel.count(), 0);
      mode = 'populated'; await refresh.click(); await panel.waitFor(); assert.equal(requests, 4);
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await panel.evaluate(node => node.scrollWidth <= node.clientWidth), true);
      if (process.env.HARMONIARR_ADMISSION_SCREENSHOT_DIR) {
        await panel.screenshot({ animations: 'disabled', path: join(process.env.HARMONIARR_ADMISSION_SCREENSHOT_DIR, 'artwork-admission-mobile.png') });
        await page.screenshot({ animations: 'disabled', path: join(process.env.HARMONIARR_ADMISSION_SCREENSHOT_DIR, 'artwork-admission-viewport.png') });
      }
      assert.equal(await panel.evaluate(node => { const bounds = node.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= globalThis.innerWidth; }), true);
      t.diagnostic(JSON.stringify(await panel.evaluate(node => {
        const rows = []; for (let item = node; item && rows.length < 7; item = item.parentElement) { const rect = item.getBoundingClientRect(); rows.push({ tag: item.tagName, class: item.className, left: rect.left, right: rect.right, width: rect.width }); }
        return { viewport: globalThis.innerWidth, documentWidth: globalThis.document.documentElement.scrollWidth, scrollX: globalThis.scrollX, rows };
      })));
      assert.deepEqual(errors, []);
    } finally { release.resolve(); }
  }, { scenarioName: 'artwork_admission_diagnostics' });
});
