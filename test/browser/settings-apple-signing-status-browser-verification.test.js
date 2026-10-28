/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { after, before, suite, test } from 'node:test';
import { createBrowserSmokeRuntime, isSkippableBrowserRuntimeError, toBrowserRuntimeUnavailableReason } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { runAppleSigningStatusScenario } from '../../testing/browser/apple-signing-status-scenario.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime, unavailable;
suite('Settings saved Apple signing status', () => {
  before(async () => {
    try { runtime = await createBrowserSmokeRuntime({ config }); }
    catch (error) { if (!isSkippableBrowserRuntimeError(error)) throw error; unavailable = toBrowserRuntimeUnavailableReason(error); }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('saved checks remain distinct from drafts and provider acceptance across request/save lifetimes', { timeout: config.scenarioTimeoutMs }, async t => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async ({ page, browserContext, baseUrl }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      t.diagnostic(JSON.stringify(await runAppleSigningStatusScenario({ page, browserContext, baseUrl })));
    }, { scenarioName: 'settings_apple_signing_status' });
  });
});
