/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import { assertHistoryTargetVisible, createHistoryCompatibilityFixture, historyPage } from '../../testing/browser/metadata-history-compatibility.js';
import { installBrowserOnboardingFixture } from '../../testing/browser/onboarding-browser-fixture.js';
import { installBrowserSystemOverviewFixture } from '../../testing/browser/system-overview-browser-fixture.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { withFixtureWorkspace } from '../../testing/integration/fixture-workspace.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig(); const fixture = createHistoryCompatibilityFixture(); let runtime;
const evidenceRoot = '.tmp/metadata-history-compatibility-2026-10-21';
const extension = resolve('testing/browser/fixtures/zoom');
before(async () => { runtime = await createIntegrationAppRuntime({ clientDistDir: resolve('dist/client'), config, createAppFn: fixture.createAppFn }); }, { timeout: config.suiteSetupTimeoutMs });
after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

test('actual Chromium 400% tab zoom preserves continuing/final focus and reflow', { timeout: config.scenarioTimeoutMs }, async t => {
  await mkdir(evidenceRoot, { recursive: true }); const evidence = await mkdtemp(`${evidenceRoot}/zoom-`);
  let retired = false; let result;
  await withFixtureWorkspace({ prefix: 'harmoniarr-metadata-zoom-',
    removeDirectory: async (path, options) => {
      if (!retired) throw new Error('Uncertain browser retirement: owned zoom profile retained');
      await rm(path, options);
    },
  }, ({ rootPath }) => runtime.runScenario(context => withFixtureLifecycle({ signal: t.signal }, async scope => {
    const launching = chromium.launchPersistentContext(rootPath, {
      headless: true, channel: 'chromium', viewport: { width: 1280, height: 1024 }, serviceWorkers: 'block',
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    // Register retirement before awaiting launch, including a launch that finishes
    // after parent cancellation. Closing the context retires its routes too.
    scope.onRelease(async () => {
      const ownedContext = await launching; const ownedBrowser = ownedContext.browser();
      await ownedContext.close(); assert.ok(ownedBrowser && !ownedBrowser.isConnected(), 'the owned browser must retire before its profile'); retired = true;
    });
    const browserContext = await launching; scope.signal.throwIfAborted();
    const browser = browserContext.browser();
    await installBrowserOnboardingFixture(browserContext); await installBrowserSystemOverviewFixture(browserContext);
    assert.equal(browserContext.pages().length, 1, 'zoom requires the sole page of a fresh profile');
    const page = browserContext.pages()[0]; page.setDefaultTimeout(config.browserActionTimeoutMs);
    await fixture.open({ ...context, page });
    const worker = browserContext.serviceWorkers()[0] ?? await browserContext.waitForEvent('serviceworker', { timeout: config.browserActionTimeoutMs });
    assert.match(worker.url(), /^chrome-extension:\/\/[a-z]+\/background\.js$/u);
    const zoom = await worker.evaluate(async () => {
      const tabs = await globalThis.chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length !== 1) throw new Error('Expected one active tab in the owned profile');
      await globalThis.chrome.tabs.setZoomSettings(tabs[0].id, { mode: 'automatic', scope: 'per-tab' });
      await globalThis.chrome.tabs.setZoom(tabs[0].id, 4);
      return { factor: await globalThis.chrome.tabs.getZoom(tabs[0].id), settings: await globalThis.chrome.tabs.getZoomSettings(tabs[0].id) };
    });
    // Chromium represents 4 through its zoom-level conversion with a one-ULP difference.
    assert.ok(Math.abs(zoom.factor - 4) <= Number.EPSILON * 4); assert.equal(zoom.settings.scope, 'per-tab');
    await page.waitForFunction(() => globalThis.innerWidth === 320 && globalThis.innerHeight === 256);
    fixture.replyWith(async () => historyPage(10, true));
    const load = page.getByRole('button', { name: 'Load more history', exact: true }); await load.scrollIntoViewIfNeeded(); await load.focus();
    await load.press('Enter'); await page.getByText('Loaded 10 more history entries.', { exact: true }).waitFor();
    const continuing = await assertHistoryTargetVisible(load);
    await page.screenshot({ path: `${evidence}/continuing.png`, animations: 'disabled' });
    fixture.replyWith(async () => historyPage(1, false, 'Final'));
    await load.press('Enter'); await page.getByText('Loaded 1 more history entry. All history loaded.', { exact: true }).waitFor();
    const final = await assertHistoryTargetVisible(page.getByRole('heading', { name: 'Recent discoveries', exact: true }));
    await page.screenshot({ path: `${evidence}/final.png`, animations: 'disabled' }); fixture.assertNoCommands();
    result = { zoom, browser: browser.version(), continuing, final };
  }), { scenarioName: 'metadata_history_actual_zoom' }));
  assert.equal(retired, true);
  await writeFile(`${evidence}/result.json`, JSON.stringify({ ...result, profileRetired: retired }, null, 2), { flag: 'wx' });
  console.log(`[history-zoom] ${evidence} ${result.browser} ${result.zoom.factor}`);
});
