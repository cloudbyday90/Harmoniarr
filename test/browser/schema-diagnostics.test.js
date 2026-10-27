/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from '../../src/server/app.js';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
before(async () => { runtime = await createBrowserSmokeRuntime({ config, createAppFn: options => {
  const application = createApp(options); application.systemModule.schemaMaintenanceService.start(); return application;
} }); }, { timeout: config.suiteSetupTimeoutMs });
after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
const endpoint = '/api/v1/system/diagnostics/schema-state';
const summary = state => ({ ok: true, schemaDiagnostics: { state, checkedAt: '2026-10-27T12:00:00Z', private: 'private-schema-marker',
  lineage: { state: state === 'current' ? 'current' : 'not_current', expectedRows: 115, observedRows: 115, incomplete: false,
    pendingCount: 1, unknownAppliedCount: 0, checksumDriftCount: 0, migrationKeyDriftCount: 0, nonAppliedCount: 1 },
  anchors: { state: state === 'current' ? 'current' : 'drift', checkedCount: 164, missingCount: state === 'current' ? 0 : 2, alteredCount: state === 'current' ? 0 : 1 } } });

test('schema maintenance status loads automatically without a manual check, preserves focus and shows safe lifecycle states', { timeout: config.scenarioTimeoutMs }, async t => {
  await runtime.runScenario(async ({ baseUrl, page, browserContext }) => {
    await bootstrapAdminThroughUi(page, { baseUrl }); let requests = 0;
    const errors = [], gates = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).pathname === endpoint) requests++; });
    await page.goto(baseUrl + '/app/settings/recovery', { waitUntil: 'domcontentloaded' });
    const open = page.getByRole('button', { name: 'Open diagnostics', exact: true });
    const close = page.getByRole('button', { name: 'Hide diagnostics', exact: true });
    assert.equal(requests, 0);
    const actual = page.waitForResponse(response => new URL(response.url()).pathname === endpoint);
    await open.click(); const response = await actual;
    assert.equal(response.status(), 200); assert.equal(response.headers()['cache-control'], 'no-store');
    const firstSummary = (await response.json()).schemaDiagnostics;
    if (firstSummary.state === 'current') assert.equal(firstSummary.anchors.checkedCount, 164);
    else assert.ok(['pending', 'running'].includes(firstSummary.state));
    let panel = page.getByRole('region', { name: 'Database schema', exact: true });
    await panel.getByRole('status').filter({ hasText: 'are current' }).waitFor();
    assert.equal(await panel.getByRole('button').count(), 0);
    assert.equal(await close.evaluate(node => node === globalThis.document.activeElement), true);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(value => { globalThis.document.documentElement.dataset.theme = value; }, theme);
      await page.setViewportSize({ width: theme === 'light' ? 1280 : 390, height: theme === 'light' ? 900 : 844 });
      await panel.scrollIntoViewIfNeeded();
      assert.equal(await panel.evaluate(node => node.scrollWidth <= node.clientWidth), true);
      if (process.env.HARMONIARR_SCHEMA_UI_SCREENSHOT_DIR) await panel.screenshot({ animations: 'disabled', path: join(process.env.HARMONIARR_SCHEMA_UI_SCREENSHOT_DIR, 'schema-' + theme + '.png') });
    }
    await close.click(); let mode = 'running', pending = Promise.withResolvers(), release = Promise.withResolvers(); gates.push(release);
    await browserContext.route('**' + endpoint, async route => {
      if (mode === 'hold') { pending.resolve(); await release.promise; }
      const code = mode === 'error' ? 503 : mode === 'forbidden' ? 403 : 200;
      const body = ['error', 'forbidden'].includes(mode) ? { error: { code: 'admin_required', message: 'private-schema-marker SQL' } }
        : ['current', 'attention'].includes(mode) ? summary(mode) : { ok: true, schemaDiagnostics: { state: mode } };
      await route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.clock.install();
    try {
      await open.click(); panel = page.getByRole('region', { name: 'Database schema', exact: true });
      const status = panel.getByRole('status'); await status.filter({ hasText: 'are running' }).waitFor();
      const live = await status.elementHandle();
      assert.equal(await status.getAttribute('aria-atomic'), 'true');
      assert.equal(await status.evaluate(node => node.closest('[aria-busy="true"]') === null), true);
      const other = page.getByRole('button', { name: 'Refresh diagnostics', exact: true }); await other.focus();
      mode = 'attention'; await page.clock.fastForward(5_000); await status.filter({ hasText: 'need attention' }).waitFor();
      assert.equal(await status.evaluate((node, previous) => node === previous, live), true); await live.dispose();
      assert.equal(await other.evaluate(node => node === globalThis.document.activeElement), true);
      assert.equal(await panel.getByText('Pending migrations', { exact: true }).locator('..').locator('dd').textContent(), '1');
      assert.doesNotMatch(await panel.textContent(), /private-schema-marker|SQL/u);
      const completed = requests; await page.clock.fastForward(60_000); assert.equal(requests, completed);
      for (const [nextMode, text] of [['paused', 'paused during recovery'], ['stale', 'out of date'], ['unavailable', 'is unavailable'], ['busy', 'waiting for database preparation'], ['error', 'is unavailable'], ['forbidden', 'Administrator access']]) {
        await close.click(); mode = nextMode; await open.click();
        panel = page.getByRole('region', { name: 'Database schema', exact: true });
        await panel.getByRole('status').filter({ hasText: text }).waitFor(); assert.equal(await panel.locator('dd').count(), 0);
        assert.doesNotMatch(await panel.textContent(), /private-schema-marker|SQL/u);
      }
      await close.click(); mode = 'hold'; await open.click(); await pending.promise; await page.clock.fastForward(25_000);
      panel = page.getByRole('region', { name: 'Database schema', exact: true }); await panel.getByRole('status').filter({ hasText: 'is unavailable' }).waitFor();
      assert.equal(await panel.locator('dd').count(), 0); release.resolve();
      await close.click(); mode = 'current'; await open.click(); await panel.getByRole('status').filter({ hasText: 'are current' }).waitFor();
      assert.deepEqual(errors, []);
      t.diagnostic(JSON.stringify({ automaticViewLoad: true, actualMaintainedSnapshot: true, noManualSchemaButton: true,
        noStore: true, boundedPendingFollowup: true, noOngoingUiPoll: true, focusPreserved: true, safeStates: true,
        permanentPoliteStatus: true, lightDesktopAndDarkMobile: true, requestDeadline: true, requests }));
    } finally { for (const gate of gates) gate.resolve(); }
  }, { scenarioName: 'schema_maintenance_ui' });
});
