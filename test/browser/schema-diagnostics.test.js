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
const endpoint = '/api/v1/system/diagnostics/schema-state';
const summary = state => ({ ok: true, schemaDiagnostics: { state, checkedAt: '2026-10-26T12:00:00Z', private: 'private-schema-marker',
  lineage: { state: state === 'current' ? 'current' : 'not_current', expectedRows: 115, observedRows: 115, incomplete: false,
    pendingCount: 1, unknownAppliedCount: 0, checksumDriftCount: 0, migrationKeyDriftCount: 0, nonAppliedCount: 1 },
  anchors: { state: state === 'current' ? 'current' : 'drift', checkedCount: 164, missingCount: state === 'current' ? 0 : 2, alteredCount: state === 'current' ? 0 : 1 } } });

test('schema checks are explicit, use real current data, announce held states and preserve focus across safe retry and responsive themes', { timeout: config.scenarioTimeoutMs }, async t => {
  await runtime.runScenario(async ({ baseUrl, page, browserContext }) => {
    await bootstrapAdminThroughUi(page, { baseUrl }); let requests = 0;
    const errors = [], gates = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (new URL(request.url()).pathname === endpoint) requests++; });
    await page.goto(`${baseUrl}/app/settings/recovery`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Open diagnostics', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Database schema', exact: true });
    const button = panel.getByRole('button', { name: 'Refresh schema checks', exact: true });
    const status = panel.getByRole('status');
    await status.filter({ hasText: 'have not run' }).waitFor(); assert.equal(requests, 0);
    const actual = page.waitForResponse(response => new URL(response.url()).pathname === endpoint);
    await button.click(); const response = await actual;
    assert.equal(response.status(), 200); assert.equal(response.headers()['cache-control'], 'no-store');
    assert.equal((await response.json()).schemaDiagnostics.anchors.checkedCount, 164);
    await status.filter({ hasText: 'are current' }).waitFor(); assert.equal(requests, 1);
    assert.equal(await button.evaluate(node => node === globalThis.document.activeElement), true);
    const liveNode = await status.elementHandle();
    let mode = 'held-attention', pending = Promise.withResolvers(), release = Promise.withResolvers(); gates.push(release);
    await browserContext.route('**' + endpoint, async route => {
      if (mode.startsWith('held-')) { pending.resolve(); await release.promise; }
      const state = mode === 'held-attention' ? 'attention' : mode === 'held-current' ? 'current' : mode;
      const code = state === 'error' ? 503 : state === 'forbidden' ? 403 : 200;
      const body = ['error', 'forbidden'].includes(state)
        ? { error: { code: 'admin_required', message: 'private-schema-marker SQL' } }
        : ['busy', 'unavailable'].includes(state) ? { ok: true, schemaDiagnostics: { state } } : summary(state);
      await route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(body) });
    });
    try {
      await button.click(); await pending.promise;
      await status.filter({ hasText: 'Checking database schema' }).waitFor();
      assert.equal(await button.getAttribute('aria-disabled'), 'true'); assert.equal(await status.getAttribute('aria-atomic'), 'true');
      assert.equal(await status.evaluate(node => node.closest('[aria-busy="true"]') === null), true);
      assert.equal(await panel.locator('[aria-busy="true"]').count(), 1);
      await button.press('Enter'); await button.press('Space'); assert.equal(requests, 2);
      release.resolve(); await status.filter({ hasText: 'needs attention' }).waitFor();
      assert.equal(await status.evaluate((node, previous) => node === previous, liveNode), true);
      assert.equal(await button.evaluate(node => node === globalThis.document.activeElement), true);
      assert.equal(await panel.getByText('Pending migrations', { exact: true }).locator('..').locator('dd').textContent(), '1');
      assert.doesNotMatch(await panel.textContent(), /private-schema-marker|SQL/u);
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => { globalThis.document.documentElement.dataset.theme = value; }, theme);
        await page.setViewportSize({ width: theme === 'light' ? 1280 : 390, height: theme === 'light' ? 900 : 844 });
        await button.scrollIntoViewIfNeeded();
        assert.equal(await panel.evaluate(node => node.scrollWidth <= node.clientWidth), true);
        assert.equal(await panel.evaluate(node => { const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= globalThis.innerWidth; }), true);
        assert.ok(await button.evaluate(node => node.getBoundingClientRect().height >= 44));
        if (process.env.HARMONIARR_SCHEMA_UI_SCREENSHOT_DIR) await panel.screenshot({ animations: 'disabled', path: join(process.env.HARMONIARR_SCHEMA_UI_SCREENSHOT_DIR, `schema-${theme}.png`) });
      }
      for (const [nextMode, text] of [['unavailable', 'are unavailable'], ['busy', 'already running'], ['error', 'are unavailable'], ['forbidden', 'Administrator access']]) {
        mode = nextMode; await button.click(); await status.filter({ hasText: text }).waitFor();
        assert.equal(await panel.locator('dd').count(), 0); assert.equal(await panel.locator('time').count(), 0);
        assert.doesNotMatch(await panel.textContent(), /private-schema-marker|SQL/u);
      }
      mode = 'held-current'; pending = Promise.withResolvers(); release = Promise.withResolvers(); gates.push(release);
      await button.click(); await pending.promise;
      const other = page.getByRole('button', { name: 'Refresh diagnostics', exact: true }); await other.focus();
      release.resolve(); await status.filter({ hasText: 'are current' }).waitFor();
      assert.equal(await other.evaluate(node => node === globalThis.document.activeElement), true);
      assert.equal(requests, 7); assert.deepEqual(errors, []);
      t.diagnostic(JSON.stringify({ actualCurrentEndpoint: true, noStore: true, explicitOnly: true, duplicateActivationSuppressed: true,
        permanentPoliteStatus: true, statusOutsideBusy: true, focusPreserved: true, userFocusRespected: true,
        staleResultsCleared: true, privateDetailsOmitted: true, lightDesktopAndDarkMobile: true, requests }));
    } finally { for (const gate of gates) gate.resolve(); await liveNode.dispose(); }
  }, { scenarioName: 'schema_diagnostics_ui' });
});
