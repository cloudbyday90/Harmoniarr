/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { after, before, suite, test } from 'node:test';
import { createBrowserSmokeRuntime, isSkippableBrowserRuntimeError, toBrowserRuntimeUnavailableReason } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { runProviderAuthorizationStatusScenario } from '../../testing/browser/provider-authorization-status-scenario.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
const config = resolveIntegrationTestRuntimeConfig();
let runtime, unavailable;
suite('Saved authorization status', () => {
  before(async () => {
    try { runtime = await createBrowserSmokeRuntime({ config }); }
    catch (error) { if (!isSkippableBrowserRuntimeError(error)) throw error; unavailable = toBrowserRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('read recovery preserves drafts and focus under session, command and scope changes', { timeout: config.scenarioTimeoutMs }, async t => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async ({ page, browserContext, baseUrl }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      t.diagnostic(JSON.stringify(await runProviderAuthorizationStatusScenario({ page, browserContext, baseUrl })));
    }, { scenarioName: 'provider_authorization_status' });
  });
});
