/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import { createBrowserSmokeRuntime, isSkippableBrowserRuntimeError, toBrowserRuntimeUnavailableReason } from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
const requestId = '11111111-2222-4333-8444-555555555555';
const detailPath = `/api/v1/library/media-requests/${requestId}`;
const reviewPath = `${detailPath}/external-review`;
const reviewMatcher = new RegExp(`${reviewPath}(?:\\?.*)?$`);
let runtime;
let unavailableReason;

async function installDetail(browserContext) {
  const user = { id: '22222222-2222-4333-8444-555555555555', username: 'Household listener', role: 'requester' };
  await browserContext.route(`**${detailPath}`, (route) => route.fulfill({ json: {
    ok: true, mediaRequest: { id: requestId, requestKind: 'external_url', requestState: 'needs_fetch',
      sourceProvider: 'spotify', sourceUrl: 'https://open.spotify.com/playlist/fixture',
      createdAt: '2026-09-11T12:00:00.000Z', requestedByUser: user, requestedForUser: user,
      fulfillmentStatus: { code: 'under_review', detail: 'Review the captured collection selection.' } },
    events: [], hasMoreEvents: false,
  } }));
  await browserContext.route(`**${detailPath}/pipeline`, (route) => route.fulfill({ json: { ok: true, candidates: [] } }));
}

suite('external collection review', () => {
  before(async () => {
    try { runtime = await createBrowserSmokeRuntime({ config }); }
    catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) throw error;
      unavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('administrator pages by keyboard, decides every leaf, retains conflict drafts and finalizes the reviewed selection', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      await installDetail(browserContext);
      let included = false;
      let excluded = false;
      let reviewed = false;
      let conflict = true;
      let revision = 1;
      const decisions = [];
      await browserContext.route(reviewMatcher, async (route) => {
        const url = new URL(route.request().url());
        assert.equal(url.searchParams.get('limit'), '25');
        const secondPage = url.searchParams.has('cursor');
        await route.fulfill({ json: {
          collection: { status: reviewed ? 'reviewed' : 'ready', revision, pagesCompleted: 2, itemsSeen: 3,
            leafCount: 2, includedCount: Number(included), excludedCount: Number(excluded),
            pendingCount: 2 - Number(included) - Number(excluded), canFinalize: included && excluded && !reviewed,
            canRestart: false, targetMatches: true, reviewedAt: reviewed ? '2026-09-11T12:10:00Z' : null },
          items: secondPage ? [{ id: 'unsupported', collectionItemId: 'leaf2', sourceProvider: 'spotify',
            title: 'Unavailable provider entry', itemKind: 'unsupported', reviewable: false,
            decision: excluded ? 'excluded' : 'pending', exclusionReason: excluded ? 'Unavailable in this storefront' : null }]
            : [{ id: 'album1', collectionItemId: 'leaf1', sourceProvider: 'spotify', providerKey: 'spotify:album:fixture',
              title: 'Prepared Album', artistName: 'Prepared Artist', itemKind: 'album', reviewable: !included && !reviewed,
              decision: included ? 'included' : 'pending' }],
          intents: included && !secondPage ? [{ id: 'intent1', releaseTitle: 'Prepared Album', artistName: 'Prepared Artist', status: 'queued' }] : [],
          preparation: { canRecover: false, action: null },
          pagination: { nextCursor: secondPage ? null : '11111111-2222-4333-8444-555555555556', hasMore: !secondPage, limit: 25 },
        } });
      });
      await browserContext.route(`**${reviewPath}/releases?**`, (route) => route.fulfill({ json: {
        releases: [{ id: 'edition1', title: 'Prepared Album', artistName: 'Prepared Artist', country: 'US', trackCount: 10 }],
      } }));
      await browserContext.route(`**${reviewPath}/approve`, async (route) => {
        decisions.push(route.request().postDataJSON());
        included = true;
        revision += 1;
        await route.fulfill({ json: { accepted: true } });
      });
      await browserContext.route(`**${reviewPath}/collection/items/leaf2/exclude`, async (route) => {
        decisions.push(route.request().postDataJSON());
        revision += 1;
        if (conflict) {
          conflict = false;
          await route.fulfill({ status: 409, json: { error: { code: 'review_conflict', message: 'Collection changed. Refresh the review before retrying.' } } });
          return;
        }
        excluded = true;
        await route.fulfill({ json: { accepted: true } });
      });
      await browserContext.route(`**${reviewPath}/collection/finalize`, async (route) => {
        decisions.push(route.request().postDataJSON());
        reviewed = true;
        revision += 1;
        await route.fulfill({ json: { accepted: true } });
      });

      await page.goto(`${baseUrl}/app/requests/${requestId}`, { waitUntil: 'domcontentloaded' });
      const panel = page.getByRole('article', { name: 'Review external music' });
      const finalize = panel.getByRole('button', { name: 'Finalize collection selection', exact: true });
      await finalize.waitFor();
      assert.equal(await finalize.isDisabled(), true);
      await panel.getByRole('button', { name: 'Find local editions' }).click();
      await panel.getByLabel('Matching local edition', { exact: true }).selectOption('edition1');
      await panel.getByRole('button', { name: 'Search this release for Household listener', exact: true }).click();
      await panel.getByText('Included', { exact: true }).waitFor();
      const next = panel.getByRole('button', { name: 'Next review page', exact: true });
      await next.focus();
      await page.keyboard.press('Enter');
      await panel.getByText('Unavailable provider entry', { exact: true }).waitFor();
      assert.equal(await next.isDisabled(), true);
      const exclude = panel.getByRole('button', { name: 'Exclude this item', exact: true });
      assert.equal(await exclude.isDisabled(), true);
      const reason = panel.getByLabel('Reason for exclusion', { exact: true });
      await reason.fill('Unavailable in this storefront');

      await mkdir('.tmp', { recursive: true });
      for (const { width, height, theme } of [
        { width: 1280, height: 960, theme: 'light' },
        { width: 768, height: 1024, theme: 'dark' },
        { width: 390, height: 844, theme: 'light' },
      ]) {
        await page.setViewportSize({ width, height });
        await page.evaluate((value) => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
        await panel.scrollIntoViewIfNeeded();
        assert.equal(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth), true);
        if (width === 390) assert.ok((await exclude.boundingBox()).height >= 44);
        await panel.screenshot({ path: `.tmp/external-collection-review-${width}-${theme}.png` });
      }
      await exclude.click();
      await panel.getByRole('alert').filter({ hasText: 'Collection changed.' }).waitFor();
      assert.equal(await reason.inputValue(), 'Unavailable in this storefront');
      await panel.getByRole('button', { name: 'Refresh review', exact: true }).click();
      await panel.getByText('Included', { exact: true }).waitFor();
      await next.click();
      await reason.waitFor();
      assert.equal(await reason.inputValue(), 'Unavailable in this storefront');
      await exclude.click();
      await panel.getByText('Page 1', { exact: true }).waitFor();
      await panel.getByRole('status').filter({ hasText: '1 included · 1 excluded · 0 pending' }).waitFor();
      assert.equal(await finalize.isEnabled(), true);
      await finalize.click();
      await panel.getByText('This reviewed collection selection is final. Fulfillment requires successful import of every included release.', { exact: true }).waitFor();
      assert.equal(await finalize.count(), 0);
      assert.deepEqual(decisions, [
        { providerIngestRequestId: 'album1', metadataReleaseId: 'edition1', expectedRevision: 1 },
        { reason: 'Unavailable in this storefront', expectedRevision: 2 },
        { reason: 'Unavailable in this storefront', expectedRevision: 3 },
        { expectedRevision: 4 },
      ]);
      assert.deepEqual(errors, []);
      await page.goto('about:blank');
    }, { scenarioName: 'external_collection_paged_decisions' });
  });

  test('legacy collection preparation, next batch and blocked restart only run after explicit actions', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      await installDetail(browserContext);
      let stage = 'legacy';
      const calls = [];
      await browserContext.route(reviewMatcher, (route) => route.fulfill({ json: {
        collection: stage === 'legacy' ? null : { status: stage === 'blocked' ? 'blocked' : 'preparing', revision: 1,
          pagesCompleted: 1, itemsSeen: 25, leafCount: 25, includedCount: 0, excludedCount: 0, pendingCount: 25,
          canFinalize: false, canRestart: stage === 'blocked', targetMatches: true,
          blockedReason: stage === 'blocked' ? 'Provider continuation repeated. Restart to capture the collection again.' : null },
        canStartCollection: stage === 'legacy', items: [], intents: [],
        preparation: { canRecover: stage === 'started', action: 'execute' },
        pagination: { hasMore: false, nextCursor: null, limit: 25 },
      } }));
      await browserContext.route(`**${reviewPath}/collection/start`, async (route) => {
        calls.push(route.request().postDataJSON());
        stage = calls.length === 1 ? 'started' : 'restarted';
        await route.fulfill({ json: { accepted: true } });
      });
      await browserContext.route(`**${reviewPath}/recover`, async (route) => {
        calls.push(route.request().postDataJSON());
        stage = 'blocked';
        await route.fulfill({ json: { accepted: true } });
      });
      await page.goto(`${baseUrl}/app/requests/${requestId}`, { waitUntil: 'domcontentloaded' });
      const panel = page.getByRole('article', { name: 'Review external music' });
      const start = panel.getByRole('button', { name: 'Start collection preparation', exact: true });
      await start.waitFor();
      assert.deepEqual(calls, []);
      await start.click();
      const next = panel.getByRole('button', { name: 'Prepare next collection batch', exact: true });
      await next.waitFor();
      assert.deepEqual(calls, [{ restart: false }]);
      await next.click();
      await panel.getByRole('alert').filter({ hasText: 'Provider continuation repeated.' }).waitFor();
      assert.equal(await panel.getByRole('button', { name: 'Finalize collection selection', exact: true }).count(), 0);
      await panel.getByRole('button', { name: 'Restart collection preparation', exact: true }).click();
      await panel.getByRole('status').filter({ hasText: 'Collection preparation restart queued.' }).waitFor();
      assert.deepEqual(calls, [{ restart: false }, {}, { restart: true }]);
      await page.goto('about:blank');
    }, { scenarioName: 'external_collection_explicit_batches' });
  });

  test('preparation counts refresh by keyboard, preserve unknown totals, and stop active copy for blocked or inactive requests', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      await installDetail(browserContext);
      let stage = 'queued';
      let reads = 0;
      await browserContext.route(reviewMatcher, async (route) => {
        reads += 1;
        if (stage === 'inactive') {
          await route.fulfill({ status: 409, json: { error: { code: 'external_request_inactive', message: 'This request is no longer awaiting acquisition.' } } });
          return;
        }
        const exhausted = stage === 'exhausted';
        const blocked = stage === 'blocked';
        await route.fulfill({ json: {
          collection: { status: blocked ? 'blocked' : 'preparing', revision: reads, targetMatches: true,
            pagesCompleted: exhausted ? 2 : 1, itemsSeen: 3, leafCount: 3,
            includedCount: 0, excludedCount: 0, pendingCount: 3, canFinalize: false, canRestart: blocked },
          preparation: { canRecover: exhausted, action: exhausted ? 'execute' : null, progress: {
            revision: reads, work: { total: 5, completed: exhausted ? 4 : 1, pending: exhausted ? 1 : 3,
              failed: exhausted ? 0 : 1, processing: 0, unsupported: 0 },
            operations: { queued: stage === 'queued' ? 1 : 0, running: stage === 'running' ? 1 : 0 },
            pages: { completed: exhausted ? 2 : 1, pending: exhausted ? 0 : 1, failed: 0,
              total: exhausted ? 2 : null, traversalComplete: exhausted },
            entriesSeen: 3, leavesCaptured: 3,
          } },
          items: [], intents: [], pagination: { hasMore: false, nextCursor: null, limit: 25 },
        } });
      });
      await page.goto(`${baseUrl}/app/requests/${requestId}`, { waitUntil: 'domcontentloaded' });
      const panel = page.getByRole('article', { name: 'Review external music' });
      const progress = panel.getByRole('region', { name: 'Metadata preparation', exact: true });
      const refresh = panel.getByRole('button', { name: 'Refresh review', exact: true });
      await progress.getByRole('status').getByText('1 preparation batch queued', { exact: true }).waitFor();
      await progress.getByText('1 provider page captured · total pages unknown').waitFor();
      assert.equal(await progress.getByRole('progressbar').count(), 0);
      assert.equal(reads, 1);
      stage = 'running';
      await refresh.focus();
      await refresh.press('Enter');
      await progress.getByRole('status').getByText('1 preparation batch running', { exact: true }).waitFor();
      assert.equal(await refresh.evaluate((element) => element === globalThis.document.activeElement), true);
      assert.equal(reads, 2);
      stage = 'exhausted';
      await refresh.press('Enter');
      await progress.getByText('2 provider pages captured · page traversal complete').waitFor();
      await progress.getByText('5 captured metadata tasks · 4 completed · 1 pending · 0 failed').waitFor();
      await progress.getByText(/Album metadata may still need preparation/).waitFor();
      assert.equal(await panel.getByRole('button', { name: 'Finalize collection selection', exact: true }).count(), 0);
      await mkdir('.tmp', { recursive: true });
      for (const [width, theme] of [[1280, 'light'], [800, 'dark'], [390, 'light'], [390, 'dark']]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.evaluate((value) => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
        assert.equal(await progress.evaluate((element) => element.scrollWidth > element.clientWidth), false);
        await progress.screenshot({ path: `.tmp/collection-preparation-progress-${width}-${theme}.png` });
      }
      stage = 'blocked';
      await refresh.click();
      await progress.getByRole('status').getByText('Metadata preparation blocked', { exact: true }).waitFor();
      assert.equal(await progress.getByText('1 preparation batch running', { exact: true }).count(), 0);
      assert.equal(await progress.getByText('2 provider pages captured · page traversal complete', { exact: true }).count(), 0);
      stage = 'inactive';
      await refresh.click();
      await panel.getByRole('alert').getByText('This request is no longer awaiting acquisition.').waitFor();
      assert.equal(await progress.count(), 0);
      assert.equal(reads, 5);
      await page.goto('about:blank');
    }, { scenarioName: 'external_collection_preparation_progress' });
  });
});
