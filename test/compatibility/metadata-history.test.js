/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import { chromium, firefox, webkit } from 'playwright';
import { createBrowserSmokeRuntime } from '../../testing/browser/playwright-smoke-runtime.js';
import { assertHistoryTargetVisible, createHistoryCompatibilityFixture, historyPage } from '../../testing/browser/metadata-history-compatibility.js';
import { assertLocatorFocused } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createFixtureGate, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';

const config = resolveIntegrationTestRuntimeConfig();
const evidenceRoot = '.tmp/metadata-history-compatibility-2026-10-21';
for (const browserType of [chromium, firefox, webkit]) suite(`Metadata history compatibility: ${browserType.name()}`, () => {
  const fixture = createHistoryCompatibilityFixture(); let runtime; let evidence;
  before(async () => {
    await mkdir(evidenceRoot, { recursive: true }); evidence = await mkdtemp(`${evidenceRoot}/${browserType.name()}-`);
    runtime = await createBrowserSmokeRuntime({ config, createAppFn: fixture.createAppFn, browserType });
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 720 }, { width: 320, height: 256 }]) {
    test(`continuing and final keyboard targets stay visible at ${viewport.width}x${viewport.height}`, { timeout: config.scenarioTimeoutMs }, async () => {
      await runtime.runScenario(async context => {
        const { page, browser } = context; await page.setViewportSize(viewport); await fixture.open(context);
        const status = page.getByRole('status', { name: 'Detection history status', exact: true });
        const node = await status.elementHandle();
        fixture.replyWith(async () => historyPage(10, true));
        const load = page.getByRole('button', { name: 'Load more history', exact: true }); await load.scrollIntoViewIfNeeded(); await load.focus();
        await load.press('Enter'); await status.getByText('Loaded 10 more history entries.', { exact: true }).waitFor();
        await assertHistoryTargetVisible(load); assert.equal(await load.isEnabled(), true);
        await mkdir(evidence, { recursive: true });
        await page.screenshot({ path: `${evidence}/${browserType.name()}-${viewport.width}-continuing.png`, animations: 'disabled' });
        fixture.replyWith(async () => historyPage(1, false, 'Final'));
        await load.press('Enter'); await status.getByText('Loaded 1 more history entry. All history loaded.', { exact: true }).waitFor();
        await assertHistoryTargetVisible(page.getByRole('heading', { name: 'Recent discoveries', exact: true }));
        assert.equal(await status.evaluate((current, original) => current === original, node), true); await node.dispose();
        assert.equal(await status.getAttribute('aria-live'), 'polite'); assert.equal(await status.getAttribute('aria-atomic'), 'true');
        assert.equal(await load.count(), 0); assert.deepEqual(fixture.reads.map(row => row.before), ['initial-cursor', 'next-cursor']); fixture.assertNoCommands();
        await page.screenshot({ path: `${evidence}/${browserType.name()}-${viewport.width}-final.png`, animations: 'disabled' });
        console.log(`[history-compatibility] ${browserType.name()} ${browser.version()} ${viewport.width}x${viewport.height}`);
      }, { scenarioName: `metadata_history_${browserType.name()}_${viewport.width}` });
    });
  }

  test('an already-visible empty continuing page preserves reading position', { timeout: config.scenarioTimeoutMs }, async () => {
    await runtime.runScenario(async context => {
      const { page } = context; await page.setViewportSize({ width: 1280, height: 1000 }); await fixture.open(context, { initialCount: 1 });
      fixture.replyWith(async () => historyPage(0, true));
      const load = page.getByRole('button', { name: 'Load more history', exact: true }); await load.focus();
      const scrollBefore = await page.locator('.hx-main').evaluate(node => node.scrollTop);
      await load.press('Enter'); await page.getByText('No additional history entries were returned.', { exact: true }).waitFor();
      await assertHistoryTargetVisible(load); assert.equal(await page.locator('.hx-main').evaluate(node => node.scrollTop), scrollBefore);
      assert.equal(fixture.reads.length, 1); fixture.assertNoCommands();
    }, { scenarioName: `metadata_history_${browserType.name()}_visible` });
  });

  test('a held continuing page preserves focus and scroll after the user moves elsewhere', { timeout: config.scenarioTimeoutMs }, async t => {
    await runtime.runScenario(context => withFixtureLifecycle({ signal: t.signal }, async scope => {
      const { page } = context; await page.setViewportSize({ width: 320, height: 256 }); await fixture.open(context);
      const reached = createFixtureGate({ signal: scope.signal }); const hold = createFixtureGate();
      scope.onRelease(() => hold.release()); scope.onRelease(() => reached.release());
      fixture.replyWith(() => {
        const operation = (async () => { reached.release(); await hold.promise; return historyPage(10, true); })();
        scope.track(operation); return operation;
      });
      await page.getByRole('button', { name: 'Load more history', exact: true }).press('Enter'); await reached.promise;
      const status = page.getByRole('status', { name: 'Detection history status', exact: true });
      await status.getByText('Loading more history.', { exact: true }).waitFor();
      assert.equal(await status.evaluate(node => node.closest('[aria-busy="true"]') === null), true);
      const input = page.getByLabel('Artist name', { exact: true }); await input.focus();
      const field = await input.elementHandle();
      try {
        // WebKit may apply native focus scrolling on the next rendered frame.
        // Measure reading position only after the focused field is actually visible.
        await page.waitForFunction(node => {
          const doc = node.ownerDocument; const bounds = node.getBoundingClientRect();
          return doc.activeElement === node && bounds.top >= doc.querySelector('.hx-main').getBoundingClientRect().top &&
            bounds.bottom + 4 <= doc.querySelector('.hx-bottom-nav').getBoundingClientRect().top;
        }, field);
      } catch (error) {
        try {
          const state = await input.evaluate(node => {
            const doc = node.ownerDocument; const main = doc.querySelector('.hx-main');
            return { focused: doc.activeElement === node, connected: node.isConnected, field: node.getBoundingClientRect().toJSON(),
              main: main.getBoundingClientRect().toJSON(), navigation: doc.querySelector('.hx-bottom-nav').getBoundingClientRect().toJSON(),
              scroll: main.scrollTop, scrollPadding: doc.defaultView.getComputedStyle(main).scrollPaddingBottom,
              rootScroll: doc.documentElement.scrollTop, shellScroll: doc.querySelector('.hx-app').scrollTop };
          });
          await writeFile(`${evidence}/held-field-failure.json`, JSON.stringify(state, null, 2));
          await page.screenshot({ path: `${evidence}/held-field-failure.png`, timeout: 5000 });
        } catch { /* Preserve the original native failure. */ }
        throw error;
      } finally { await field.dispose(); }
      const scrollBefore = await page.locator('.hx-main').evaluate(node => node.scrollTop); hold.release();
      await status.getByText('Loaded 10 more history entries.', { exact: true }).waitFor(); await assertLocatorFocused(input);
      assert.equal(await page.locator('.hx-main').evaluate(node => node.scrollTop), scrollBefore); fixture.assertNoCommands();
    }), { scenarioName: `metadata_history_${browserType.name()}_moved` });
  });
});
