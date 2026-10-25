/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createRecoveryDiagnosticsService } from '../../src/server/recovery/recovery-diagnostics-service.js';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
before(async () => { runtime = await createBrowserSmokeRuntime({ config }); }, { timeout: config.suiteSetupTimeoutMs });
after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
const time = '2026-10-25T16:00:00.000Z';
const failure = id => ({ id: `run-${id}`, operationType: 'backup_restore_apply', status: 'failed', finishedAt: time,
  errorMessage: `Failure ${id} at "/private/音乐 Room/Album Name/restore.json" for ops@example.invalid token=private-token <img src=x onerror="globalThis.recoveryDiagnosticExecuted=true">` });

test('Recovery diagnostic events render current redacted service fields with stable rows and truthful refresh states', { timeout: config.scenarioTimeoutMs }, async t => {
  await runtime.runScenario(async ({ baseUrl, page, browserContext }) => {
    await bootstrapAdminThroughUi(page, { baseUrl }); let mode = 'populated'; const errors = []; const warnings = [];
    page.on('pageerror', error => errors.push(error.message)); page.on('console', message => { if (message.type() === 'warning') warnings.push(message.text()); });
    const service = createRecoveryDiagnosticsService({ loadSettingsFn: async () => ({ paths: { music: "/private/音乐 Room" } }), listRecentOperationRuns: async () => mode === 'populated' ? [failure(1), failure(2)] : mode === 'replacement' ? [failure(2)] : [],
      listRecentAuditEvents: async () => ['populated', 'replacement'].includes(mode) ? [
        { id: 'audit-1', eventType: 'maintenance_lock_entered', occurredAt: time, summary: 'private-summary-marker' },
        { id: 'audit-2', eventType: 'maintenance_lock_released', occurredAt: time, details: { token: 'private-audit-token' } },
      ] : [],
    });
    await browserContext.route('**/api/v1/system/diagnostics/recovery-state', async route => {
      const data = mode === 'missing' ? { recentFailedRuns: [{ id: 'missing-run', operationType: 'unrecognized_type' }], recentPrivilegedActions: [{ id: 'missing-audit', eventType: 'unrecognized_type' }] }
        : mode === 'malformed' ? { recentFailedRuns: null, recentPrivilegedActions: {} } : await service.getRecoveryDiagnostics();
      await route.fulfill({ status: mode === 'error' ? 503 : 200, contentType: 'application/json', body: JSON.stringify(mode === 'error' ? { error: { message: 'Diagnostics temporarily unavailable.' } } : { ok: true, ...data }) });
    });
    await page.goto(`${baseUrl}/app/settings/recovery`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Open diagnostics', exact: true }).click();
    const failures = page.getByRole('region', { name: 'Recent failures', exact: true });
    const actions = page.getByRole('region', { name: 'Recent privileged actions', exact: true });
    await failures.getByText('Backup restore apply', { exact: true }).first().waitFor();
    assert.equal(await failures.getByRole('listitem').count(), 2); assert.equal(await failures.locator('time').count(), 2);
    assert.deepEqual(await actions.locator('strong').allTextContents(), ['Maintenance lock entered', 'Maintenance lock released']);
    const text = await failures.textContent(); assert.match(text, /\[REDACTED_PATH\]/u); assert.match(text, /\[REDACTED_EMAIL\]/u); assert.match(text, /<img/u);
    assert.doesNotMatch(text, /音乐 Room|Album Name|ops@example|private-token|0 failures/u); assert.equal(await failures.locator('img').count(), 0);
    assert.equal(await page.evaluate(() => globalThis.recoveryDiagnosticExecuted), undefined);
    assert.doesNotMatch(await actions.textContent(), /private-summary-marker|private-audit-token|unrecognized_type/u);
    const refresh = page.getByRole('button', { name: 'Refresh diagnostics', exact: true });
    mode = 'replacement'; await refresh.click(); await failures.getByText(/Failure 2/u).waitFor(); await failures.getByText(/Failure 1/u).waitFor({ state: 'detached' }); assert.equal(await failures.getByRole('listitem').count(), 1);
    mode = 'missing'; await refresh.click(); await failures.getByText('Finish time unavailable.').waitFor(); await actions.getByText('Event time unavailable.').waitFor();
    await failures.getByText('No failure message is available.').waitFor(); await actions.getByText('Privileged recovery action', { exact: true }).waitFor();
    mode = 'malformed'; await refresh.click(); await failures.getByText('Some failure records are unavailable.').waitFor(); await actions.getByText('Some privileged action records are unavailable.').waitFor();
    mode = 'empty'; await refresh.click(); await failures.getByText('No recent failures to display.').waitFor(); await actions.getByText('No recent privileged actions to display.').waitFor();
    mode = 'error'; await refresh.click(); await page.locator('#settings-recovery-diagnostics').getByRole('alert').waitFor(); assert.equal(await failures.count(), 0);
    mode = 'populated'; await refresh.click(); await failures.getByText('Backup restore apply', { exact: true }).first().waitFor();
    assert.equal(await refresh.evaluate(node => node === globalThis.document.activeElement), true);
    await page.setViewportSize({ width: 390, height: 844 });
    if (process.env.HARMONIARR_RECOVERY_EVENT_SCREENSHOT_DIR) await failures.screenshot({ animations: 'disabled', path: join(process.env.HARMONIARR_RECOVERY_EVENT_SCREENSHOT_DIR, 'recovery-events-mobile.png') });
    assert.equal(await failures.evaluate(node => { const box = node.getBoundingClientRect(); return node.scrollWidth <= node.clientWidth && box.left >= 0 && box.right <= globalThis.innerWidth; }), true);
    assert.equal(warnings.some(message => /duplicate.*key/iu.test(message)), false); assert.deepEqual(errors, []);
    t.diagnostic(JSON.stringify({ serviceDerivedPayload: true, sameTypeTimeDistinctRows: 2, escapedHtml: true, redactionPreserved: true, refreshFocusRetained: true, viewport: 390 }));
  }, { scenarioName: 'recovery_diagnostic_events' });
});
