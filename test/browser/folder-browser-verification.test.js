/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { after, before, suite, test } from 'node:test';
import { createBrowserSmokeRuntime, isSkippableBrowserRuntimeError, toBrowserRuntimeUnavailableReason } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { runFolderBrowserScenario } from '../../testing/browser/folder-browser-scenario.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
const config = resolveIntegrationTestRuntimeConfig(); let runtime, unavailable;
suite('Storage folder browser', () => {
  before(async () => { try { runtime = await createBrowserSmokeRuntime({ config }); } catch (error) { if (!isSkippableBrowserRuntimeError(error)) throw error; unavailable = toBrowserRuntimeUnavailableReason(error); } }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('named invokers, native focus lifecycle and confirmed reads preserve Storage drafts', { timeout: config.scenarioTimeoutMs }, async t => {
    if (unavailable) { t.skip(unavailable); return; }
    await runtime.runScenario(async ({ page, browserContext, baseUrl }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      const proof = await runFolderBrowserScenario({ page, browserContext, baseUrl });
      t.diagnostic(JSON.stringify({ scenes: proof.scenes.length, pageScenes: proof.pageScenes.length, folderReads: proof.folderReads, dismissalPaths: proof.dismissalPaths, retryCases: proof.retryCases, blockedWrites: proof.blockedWrites }));
    }, { scenarioName: 'folder_browser' });
  });
});
