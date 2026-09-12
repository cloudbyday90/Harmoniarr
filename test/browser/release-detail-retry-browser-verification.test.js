/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import {
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import {
  installMetadataBrowserFixtures,
  markBoardsOfCanadaAddedInMetadataBrowserFixture,
} from '../../testing/browser/metadata-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { assertLocatorFocused } from '../../testing/browser/keyboard-accessibility-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailableReason;

async function prepareRetryScenario({ baseUrl, browserContext, page }) {
  await installMetadataBrowserFixtures(browserContext);
  await bootstrapAdminThroughUi(page, { baseUrl });
  await markBoardsOfCanadaAddedInMetadataBrowserFixture(page);
  await page.goto(`${baseUrl}/app/artists/mb-artist-boards`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Boards of Canada', exact: true }).waitFor();
  await page.evaluate(() => {
    const originalFetch = globalThis.fetch.bind(globalThis);
    const state = { calls: [], next: 'failure', release: null };
    globalThis.releaseDetailRetryFixture = state;
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url, globalThis.location.href);
      if (!url.pathname.endsWith('/tracklist')) return originalFetch(input, init);
      state.calls.push(url.pathname + url.search);
      let outcome = state.next;
      state.next = 'deferred';
      if (outcome === 'deferred') {
        outcome = await new Promise((resolve) => { state.release = resolve; });
      }
      if (outcome === 'failure') {
        return new Response(JSON.stringify({ ok: false, error: {
          message: 'Provider token=private-test-secret; limit must be an integer between 1 and 25',
        } }), { status: 502, headers: { 'Content-Type': 'application/json' } });
      }
      // Intentionally allow delivery after an aborted signal to verify ownership,
      // rather than relying on the transport to discard an obsolete response.
      return originalFetch(input, init);
    };
  });
  const opener = page.getByRole('button', { name: 'View details for Music Has the Right to Children' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Music Has the Right to Children' });
  await dialog.getByText('Could not load release details', { exact: true }).waitFor();
  const heading = dialog.getByRole('heading', { level: 2, name: 'Music Has the Right to Children', exact: true });
  await heading.waitFor();
  assert.equal(await dialog.getAttribute('aria-labelledby'), await heading.getAttribute('id'));
  return { dialog, opener, retry: dialog.getByRole('button', { name: /^Retry/u }) };
}

async function releasePendingRead(page, outcome) {
  await page.evaluate((nextOutcome) => globalThis.releaseDetailRetryFixture.release(nextOutcome), outcome);
}

async function settleRendering(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve));
    });
  });
}

suite('Release detail retry browser verification', () => {
  before(async () => {
    try {
      runtime = await createBrowserSmokeRuntime({ config });
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) throw error;
      unavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => runtime?.cleanup(), { timeout: config.suiteTeardownTimeoutMs });

  test('keyboard retry keeps focus, suppresses duplicate reads, and recovers after repeated failure', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) return t.skip(unavailableReason);
    await runtime.runScenario(async (context) => {
      const { page } = context;
      const { dialog, retry } = await prepareRetryScenario(context);
      assert.doesNotMatch(await dialog.innerText(), /private-test-secret|limit must be/u);
      await retry.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => globalThis.releaseDetailRetryFixture.calls.length === 2);
      await assertLocatorFocused(retry, 'Retry retains keyboard focus while loading');
      assert.equal(await retry.getAttribute('aria-disabled'), 'true');
      await dialog.getByRole('status').filter({ hasText: 'Loading release details.' }).waitFor();
      await dialog.getByRole('heading', { level: 2, name: 'Music Has the Right to Children', exact: true }).waitFor();
      await retry.evaluate((button) => { button.click(); button.click(); });
      assert.equal(await page.evaluate(() => globalThis.releaseDetailRetryFixture.calls.length), 2);

      await releasePendingRead(page, 'failure');
      await page.waitForFunction(() => {
        const buttons = [...globalThis.document.querySelectorAll('dialog[open] button')];
        return buttons.some((button) => button.textContent.trim() === 'Retry'
          && button.getAttribute('aria-disabled') !== 'true');
      });
      await assertLocatorFocused(retry, 'A repeated failure keeps Retry focused');
      assert.doesNotMatch(await dialog.innerText(), /private-test-secret|limit must be/u);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => globalThis.releaseDetailRetryFixture.calls.length === 3);
      await releasePendingRead(page, 'success');
      await dialog.getByText('Roygbiv', { exact: true }).waitFor();
      await dialog.getByRole('status').filter({ hasText: 'Release details loaded.' }).waitFor();
      assert.equal(await dialog.getByRole('heading', { level: 2, name: 'Music Has the Right to Children', exact: true }).count(), 1);
      await assertLocatorFocused(dialog.getByRole('button', { name: 'Close', exact: true }),
        'Successful retry moves focus from the removed Retry button to Close');
      const calls = await page.evaluate(() => globalThis.releaseDetailRetryFixture.calls);
      assert.equal(new Set(calls).size, 1, 'Retries preserve the requested release identity');
      await page.goto('about:blank');
    }, { scenarioName: 'release_detail_keyboard_retry_repeated_failure' });
  });

  test('retry completion does not steal focus after the user tabs to another control', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) return t.skip(unavailableReason);
    await runtime.runScenario(async (context) => {
      const { page } = context;
      const { dialog, retry } = await prepareRetryScenario(context);
      await retry.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => globalThis.releaseDetailRetryFixture.calls.length === 2);
      await page.keyboard.press('Tab');
      await page.evaluate(() => { globalThis.focusBeforeRetryCompletion = globalThis.document.activeElement; });
      assert.equal(await retry.evaluate((button) => button === globalThis.document.activeElement), false);
      await releasePendingRead(page, 'success');
      await dialog.getByText('Roygbiv', { exact: true }).waitFor();
      await settleRendering(page);
      assert.equal(await page.evaluate(() => (
        globalThis.document.activeElement === globalThis.focusBeforeRetryCompletion
      )), true);
      await page.goto('about:blank');
    }, { scenarioName: 'release_detail_retry_preserves_moved_focus' });
  });

  test('closing a pending retry prevents its response from moving focus in a reopened dialog', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) return t.skip(unavailableReason);
    await runtime.runScenario(async (context) => {
      const { page } = context;
      const { dialog, opener, retry } = await prepareRetryScenario(context);
      await retry.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => globalThis.releaseDetailRetryFixture.calls.length === 2);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await assertLocatorFocused(opener, 'Closing a pending read restores focus to its opener');
      await page.evaluate(() => { globalThis.releaseDetailRetryFixture.next = 'success'; });
      await opener.click();
      await dialog.getByText('Roygbiv', { exact: true }).waitFor();
      const edition = dialog.getByRole('combobox', { name: 'Preview an edition', exact: true });
      await edition.focus();
      await releasePendingRead(page, 'success');
      await settleRendering(page);
      await assertLocatorFocused(edition, 'An obsolete retry must not focus Close in the new dialog');
      assert.equal(await page.evaluate(() => globalThis.releaseDetailRetryFixture.calls.length), 3);
      assert.equal(await dialog.getByText('Could not load release details', { exact: true }).count(), 0);
      await page.goto('about:blank');
    }, { scenarioName: 'release_detail_retry_close_reopen_ownership' });
  });
});
