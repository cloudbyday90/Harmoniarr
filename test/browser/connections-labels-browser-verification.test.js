/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { after, before, suite, test } from 'node:test';
import { createBrowserSmokeRuntime, isSkippableBrowserRuntimeError, toBrowserRuntimeUnavailableReason } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { runConnectionsLabelsScenario } from '../../testing/browser/connections-labels-scenario.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime, unavailable;
suite('Connections native field labels', () => {
  before(async () => {
    try { runtime = await createBrowserSmokeRuntime({ config }); }
    catch (error) { if (!isSkippableBrowserRuntimeError(error)) throw error; unavailable = toBrowserRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('visible labels name and activate their controls while secrets and drafts retain their owners', { timeout: config.scenarioTimeoutMs }, async t => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async ({ page, browserContext, baseUrl }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      t.diagnostic(JSON.stringify(await runConnectionsLabelsScenario({ page, browserContext, baseUrl })));
    }, { scenarioName: 'connections_labels' });
  });
});
