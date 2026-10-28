/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { after, before, suite, test } from 'node:test';
import { createBrowserSmokeRuntime, isSkippableBrowserRuntimeError, toBrowserRuntimeUnavailableReason } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { runConnectionsLayoutScenario } from '../../testing/browser/connections-layout-scenario.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
const config = resolveIntegrationTestRuntimeConfig();
let runtime, unavailable;
suite('Connections responsive form layout', () => {
  before(async () => { try { runtime = await createBrowserSmokeRuntime({ config }); } catch (error) { if (!isSkippableBrowserRuntimeError(error)) throw error; unavailable = toBrowserRuntimeUnavailableReason(error); } }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('native keyboard scrolling preserves field sizing, save-bar clearance and drafts', { timeout: config.scenarioTimeoutMs }, async t => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async ({ page, browserContext, baseUrl }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const result = await runConnectionsLayoutScenario({ page, browserContext, baseUrl });
      t.diagnostic(JSON.stringify({ ...result, scenes: result.scenes.map(({ label, theme, forward, reverse }) => ({ label, theme, forward, reverse })) }));
    }, { scenarioName: 'connections_layout' });
  });
});
