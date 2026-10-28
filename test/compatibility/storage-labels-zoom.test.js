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
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { withFixtureWorkspace } from '../../testing/integration/fixture-workspace.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { installBrowserOnboardingFixture } from '../../testing/browser/onboarding-browser-fixture.js';
import { installBrowserSystemOverviewFixture } from '../../testing/browser/system-overview-browser-fixture.js';
import { runStorageLabelsScenario } from '../../testing/browser/storage-labels-scenario.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
before(async () => { runtime = await createIntegrationAppRuntime({ clientDistDir: resolve('dist/client'), config }); }, { timeout: config.suiteSetupTimeoutMs });
after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

test('actual 400% Chromium tab zoom preserves Storage row labels, identity and drafts', { timeout: config.scenarioTimeoutMs }, async t => {
  const root = '.tmp/storage-labels-2026-10-28'; await mkdir(root, { recursive: true });
  const evidence = await mkdtemp(root + '/native-zoom-'); let retired = false, ownedProfile, result;
  await withFixtureWorkspace({ prefix: 'harmoniarr-storage-zoom-', removeDirectory: async (path, options) => {
    assert.equal(resolve(path), ownedProfile, 'Only the exact owned profile may be removed');
    assert.equal(retired, true, 'Browser retirement must precede profile removal'); await rm(path, options);
  } }, ({ rootPath }) => {
    ownedProfile = resolve(rootPath);
    return runtime.runScenario(context => withFixtureLifecycle({ signal: t.signal }, async scope => {
      const extension = resolve('testing/browser/fixtures/zoom');
      const launching = chromium.launchPersistentContext(rootPath, { headless: true, channel: 'chromium', viewport: { width: 1280, height: 1024 }, serviceWorkers: 'block', args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`] });
      scope.onRelease(async () => { const browserContext = await launching, browser = browserContext.browser(); await browserContext.close(); assert.ok(browser && !browser.isConnected()); retired = true; });
      const browserContext = await launching; scope.signal.throwIfAborted();
      await installBrowserOnboardingFixture(browserContext); await installBrowserSystemOverviewFixture(browserContext);
      assert.equal(browserContext.pages().length, 1); const page = browserContext.pages()[0]; page.setDefaultTimeout(config.browserActionTimeoutMs);
      await bootstrapAdminThroughUi(page, { baseUrl: context.baseUrl });
      const worker = browserContext.serviceWorkers()[0] ?? await browserContext.waitForEvent('serviceworker', { timeout: config.browserActionTimeoutMs });
      assert.match(worker.url(), /^chrome-extension:\/\/[a-z]+\/background\.js$/u);
      let zoom;
      const scenario = await runStorageLabelsScenario({ page, browserContext, baseUrl: context.baseUrl, evidenceDir: evidence, configureZoom: async () => {
        zoom = await worker.evaluate(async () => {
          const tabs = await globalThis.chrome.tabs.query({ active: true, currentWindow: true }); if (tabs.length !== 1) throw new Error('Expected sole active owned tab');
          await globalThis.chrome.tabs.setZoomSettings(tabs[0].id, { mode: 'automatic', scope: 'per-tab' }); await globalThis.chrome.tabs.setZoom(tabs[0].id, 4);
          return { factor: await globalThis.chrome.tabs.getZoom(tabs[0].id), settings: await globalThis.chrome.tabs.getZoomSettings(tabs[0].id) };
        });
        assert.ok(Math.abs(zoom.factor - 4) <= Number.EPSILON * 4); assert.equal(zoom.settings.scope, 'per-tab');
        await page.waitForFunction(() => globalThis.innerWidth === 320 && globalThis.innerHeight === 256);
      } });
      result = { zoom, browser: browserContext.browser().version(), ...scenario };
      const finalZoom = await worker.evaluate(async () => { const [tab] = await globalThis.chrome.tabs.query({ active: true, currentWindow: true }); return globalThis.chrome.tabs.getZoom(tab.id); });
      assert.ok(Math.abs(finalZoom - 4) <= Number.EPSILON * 4, 'Native zoom must survive the complete scenario');
    }), { scenarioName: 'storage_native_zoom' });
  });
  assert.equal(retired, true); await writeFile(evidence + '/result.json', JSON.stringify({ ...result, profileRetired: retired }, null, 2), { flag: 'wx' });
  t.diagnostic(JSON.stringify({ evidence, zoom: result.zoom.factor, scenes: result.scenes.length, profileRetired: retired }));
});
