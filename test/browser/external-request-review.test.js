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
import {
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailableReason;
const requestId = '11111111-2222-4333-8444-555555555555';
const detailPath = `/api/v1/library/media-requests/${requestId}`;
const reviewPath = `${detailPath}/external-review`;

async function installRequestDetail(browserContext) {
  const user = { id: '22222222-2222-4333-8444-555555555555', username: 'Household listener', role: 'requester' };
  await browserContext.route(`**${detailPath}`, (route) => route.fulfill({ json: {
    ok: true,
    mediaRequest: {
      id: requestId, requestKind: 'external_url', requestState: 'needs_fetch',
      sourceProvider: 'spotify', sourceUrl: 'https://open.spotify.com/album/fixture',
      createdAt: '2026-09-10T12:00:00.000Z', requestedByUser: user, requestedForUser: user,
      fulfillmentStatus: { code: 'under_review', detail: 'Provider details are prepared for review.' },
    },
    events: [], hasMoreEvents: false,
  } }));
  await browserContext.route(`**${detailPath}/pipeline`, (route) => route.fulfill({ json: { ok: true, candidates: [] } }));
}

suite('external request review', () => {
  before(async () => {
    try {
      runtime = await createBrowserSmokeRuntime({ config });
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) throw error;
      unavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });

  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('administrator explicitly selects an edition, retains a rejected draft, and sees accepted target search', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      await installRequestDetail(browserContext);
      let accepted = false;
      let attempts = 0;
      let reviewReads = 0;
      const selectedBodies = [];
      await browserContext.route(`**${reviewPath}`, async (route) => {
        reviewReads += 1;
        await route.fulfill({ json: {
          items: [{ id: 'provider-album', providerKey: 'spotify:album:fixture', sourceProvider: 'spotify',
            title: 'Prepared Album', artistName: 'Prepared Artist', releaseDate: '2026-09-01', trackCount: 10,
            status: 'completed', reviewable: !accepted }],
          intents: accepted ? [{ id: 'intent1', releaseTitle: 'Prepared Album', artistName: 'Prepared Artist', status: 'queued' }] : [],
          preparation: { canRecover: false, action: null },
        } });
      });
      await browserContext.route(`**${reviewPath}/releases?**`, async (route) => {
        const url = new URL(route.request().url());
        assert.equal(url.searchParams.get('artistName'), 'Prepared Artist');
        await route.fulfill({ json: { releases: [{
          id: 'local-release', title: 'Prepared Album', artistName: 'Prepared Artist',
          releaseDate: '2026-09-01', country: 'US', trackCount: 10,
        }] } });
      });
      await browserContext.route(`**${reviewPath}/approve`, async (route) => {
        selectedBodies.push(route.request().postDataJSON());
        attempts += 1;
        if (attempts === 1) {
          await route.fulfill({ status: 409, json: { error: { code: 'review_conflict', message: 'The request changed. Review this selection before trying again.' } } });
          return;
        }
        accepted = true;
        await route.fulfill({ json: { accepted: true, reusedExistingIntent: false, intent: { id: 'intent1' } } });
      });

      await page.goto(`${baseUrl}/app/requests/${requestId}`, { waitUntil: 'domcontentloaded' });
      const panel = page.getByRole('article', { name: 'Review external music' });
      const approve = panel.getByRole('button', { name: 'Search this release for Household listener', exact: true });
      await approve.waitFor();
      assert.equal(await approve.isDisabled(), true);
      await panel.getByRole('button', { name: 'Find local editions' }).click();
      const edition = panel.getByLabel('Matching local edition', { exact: true });
      await edition.waitFor();
      assert.equal(await edition.inputValue(), '');
      assert.equal(await approve.isDisabled(), true);
      await edition.focus();
      await page.keyboard.press('ArrowDown');
      assert.equal(await edition.inputValue(), 'local-release');
      assert.equal(await approve.isEnabled(), true);
      assert.match(await panel.locator('.hx-external-review-edition').innerText(), /2026-09-01 · US · 10 tracks/u);

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
        assert.equal(await panel.getByLabel('Matching local edition').isVisible(), true);
        if (width === 390) assert.ok((await approve.boundingBox()).height >= 44);
        await panel.screenshot({ path: `.tmp/external-request-review-${width}-${theme}.png` });
      }

      const firstResponse = page.waitForResponse((response) => response.url().endsWith(`${reviewPath}/approve`));
      await approve.click();
      assert.equal((await firstResponse).status(), 409);
      await panel.getByRole('alert').filter({ hasText: 'The request changed.' }).waitFor();
      assert.equal(await edition.inputValue(), 'local-release');
      assert.equal(await panel.getByLabel('Release in local catalog').inputValue(), 'Prepared Album');
      await approve.click();
      await panel.getByRole('status').filter({ hasText: 'Release search queued.' }).waitFor();
      await panel.getByRole('heading', { name: 'Accepted release searches' }).waitFor();
      assert.ok(reviewReads >= 2);
      assert.deepEqual(selectedBodies, [
        { providerIngestRequestId: 'provider-album', metadataReleaseId: 'local-release' },
        { providerIngestRequestId: 'provider-album', metadataReleaseId: 'local-release' },
      ]);
      assert.equal(await panel.locator('form').count(), 0);
      assert.deepEqual(errors, []);
      await page.goto('about:blank');
    }, { scenarioName: 'external_request_edition_review' });
  });

  test('administrator explicitly recovers missing preparation and sees refreshed recovery state', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      await installRequestDetail(browserContext);
      let queued = false;
      let recoveryCalls = 0;
      await browserContext.route(`**${reviewPath}`, (route) => route.fulfill({ json: {
        items: [], intents: [], preparation: { canRecover: !queued, action: queued ? null : 'plan' },
      } }));
      await browserContext.route(`**${reviewPath}/recover`, async (route) => {
        assert.equal(route.request().method(), 'POST');
        assert.deepEqual(route.request().postDataJSON(), {});
        recoveryCalls += 1;
        queued = true;
        await route.fulfill({ json: { accepted: true, reusedExistingRun: false, run: { id: 'planning1' } } });
      });
      await page.goto(`${baseUrl}/app/requests/${requestId}`, { waitUntil: 'domcontentloaded' });
      const panel = page.getByRole('article', { name: 'Review external music' });
      const recover = panel.getByRole('button', { name: 'Plan this external request', exact: true });
      await recover.waitFor();
      assert.equal(recoveryCalls, 0);
      await recover.click();
      await panel.getByRole('status').filter({ hasText: 'External request planning queued.' }).waitFor();
      assert.equal(await recover.count(), 0);
      assert.equal(recoveryCalls, 1);
      await page.goto('about:blank');
    }, { scenarioName: 'external_request_preparation_recovery' });
  });

  test('accepted provider items retain their previous target and cannot be silently approved again', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) { t.skip(unavailableReason); return; }
    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      await installRequestDetail(browserContext);
      await browserContext.route(`**${reviewPath}`, (route) => route.fulfill({ json: {
        items: [{ id: 'p1', providerKey: 'spotify:album:fixture', sourceProvider: 'spotify', title: 'Album', artistName: 'Artist', reviewable: true }],
        intents: [{ id: 'i1', providerKey: 'spotify:album:fixture', releaseTitle: 'Album', artistName: 'Artist', requestedForUserId: 'previous-target', status: 'completed' }],
        preparation: { canRecover: false, action: null },
      } }));
      await page.goto(`${baseUrl}/app/requests/${requestId}`, { waitUntil: 'domcontentloaded' });
      const panel = page.getByRole('article', { name: 'Review external music' });
      await panel.getByText('Accepted for a previous target. Create a separate request to search for the current target.', { exact: true }).waitFor();
      assert.equal(await panel.locator('form').count(), 0);
      assert.equal(await panel.getByRole('button', { name: /Search this release/u }).count(), 0);
      await panel.getByText('Search completed', { exact: true }).waitFor();
      await page.goto('about:blank');
    }, { scenarioName: 'external_request_previous_target' });
  });
});
