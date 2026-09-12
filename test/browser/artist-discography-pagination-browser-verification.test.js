/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { assertComputedColorContrast } from '../../testing/browser/color-contrast-helpers.js';
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

async function installRemoteCatalogPages(page) {
  await page.evaluate(() => {
    const originalFetch = globalThis.fetch.bind(globalThis);
    const fixture = { reads: [], mutations: [], finishPage: null };
    globalThis.artistCatalogPagesFixture = fixture;
    const rows = Array.from({ length: 28 }, (_, index) => ({
      id: `catalog-group-${index + 1}`,
      musicbrainzReleaseGroupId: `catalog-group-${index + 1}`,
      sourceProvider: 'musicbrainz',
      title: `Catalog album ${String(index + 1).padStart(2, '0')}`,
      artistCredit: 'Boards of Canada',
      primaryType: 'Album',
      secondaryTypes: [],
      firstReleaseDate: '2020-01-01',
    }));
    const json = (body, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json' },
    });
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url, globalThis.location.href);
      const method = (init?.method ?? input?.method ?? 'GET').toUpperCase();
      if (!['GET', 'HEAD'].includes(method) && url.pathname.startsWith('/api/v1/metadata/')) {
        fixture.mutations.push({ method, path: url.pathname });
      }
      if (method === 'GET' && url.pathname === '/api/v1/metadata/artists/metadata-artist-boards/operator') {
        const response = await originalFetch(input, init);
        const payload = await response.json();
        return json({ ...payload, releaseGroups: [] }, response.status);
      }
      if (method === 'GET' && url.pathname === '/api/v1/metadata/musicbrainz/artists/mb-artist-boards/release-groups') {
        const offset = Number(url.searchParams.get('offset') ?? 0);
        fixture.reads.push({ offset, limit: Number(url.searchParams.get('limit')) });
        if (offset === 0) {
          return json({ provider: 'musicbrainz', browse: { offset: 0, limit: 25, total: 29, results: rows.slice(0, 25) } });
        }
        return new Promise((resolve) => {
          fixture.finishPage = (succeed) => {
            fixture.finishPage = null;
            resolve(succeed
              ? json({ provider: 'musicbrainz', browse: {
                offset, limit: 25, total: 29, results: [rows[24], ...rows.slice(25)],
              } })
              : json({ ok: false, error: { code: 'provider_unavailable', message: 'Fixture catalog page unavailable.' } }, 503));
          };
        });
      }
      return originalFetch(input, init);
    };
  });
}

suite('Artist discography pagination browser verification', () => {
  before(async () => {
    try {
      runtime = await createBrowserSmokeRuntime({ config });
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) throw error;
      unavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => runtime?.cleanup(), { timeout: config.suiteTeardownTimeoutMs });

  test('remote catalog pages preserve cards on retry, suppress duplicates, and keep terminal focus without claiming completeness', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) return t.skip(unavailableReason);
    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await markBoardsOfCanadaAddedInMetadataBrowserFixture(page);
      await page.goto(`${baseUrl}/app/discover`, { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Search for an artist').waitFor();
      await installRemoteCatalogPages(page);
      await page.getByLabel('Search for an artist').fill('Boards of Canada');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await page.getByRole('link', { name: 'View Boards of Canada', exact: true }).click();
      const discography = page.getByRole('article', { name: 'Discography', exact: true });
      const cards = discography.getByRole('button', { name: /^View details for Catalog album /u });
      const pagination = discography.locator('.artist-discography-pagination');
      const button = pagination.getByRole('button');
      await discography.getByRole('button', { name: 'View details for Catalog album 25', exact: true }).waitFor();
      assert.equal(await cards.count(), 25);
      await pagination.getByRole('status').filter({ hasText: '25 of 29' }).waitFor();
      await button.focus();
      await assertComputedColorContrast(button, { kind: 'outline', minimumRatio: 3 });
      await page.keyboard.press('Enter');
      await pagination.getByRole('status').filter({ hasText: 'Loading more release groups' }).waitFor();
      assert.equal(await button.getAttribute('aria-disabled'), 'true');
      await assertLocatorFocused(button, 'Loading retains focus on the catalog control');
      await button.evaluate((element) => { element.click(); element.click(); });
      assert.deepEqual(await page.evaluate(() => globalThis.artistCatalogPagesFixture.reads), [
        { limit: 25, offset: 0 }, { limit: 25, offset: 25 },
      ], 'Repeated activation during loading must not start additional requests');
      await page.evaluate(() => globalThis.artistCatalogPagesFixture.finishPage(false));
      await pagination.getByRole('alert').waitFor();
      await pagination.getByRole('button', { name: 'Retry loading release groups', exact: true }).waitFor();
      assert.equal(await cards.count(), 25, 'A failed page preserves the previous catalog');
      await assertLocatorFocused(button, 'Failure preserves focus for a keyboard retry');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => typeof globalThis.artistCatalogPagesFixture.finishPage === 'function');
      await page.evaluate(() => globalThis.artistCatalogPagesFixture.finishPage(true));
      await discography.getByRole('button', { name: 'View details for Catalog album 28', exact: true }).waitFor();
      assert.equal(await cards.count(), 28, 'An overlapping provider row must not duplicate a card');
      assert.equal(await discography.getByRole('button', { name: 'View details for Catalog album 25', exact: true }).count(), 1);
      await pagination.getByRole('button', { name: 'No further catalog page available', exact: true }).waitFor();
      await pagination.getByRole('status').filter({ hasText: '28 of 29' }).waitFor();
      assert.equal(await pagination.getByRole('button', { name: 'All catalog release groups loaded', exact: true }).count(), 0);
      assert.equal(await button.getAttribute('aria-disabled'), 'true');
      await assertLocatorFocused(button, 'Terminal catalog control remains mounted and focused');
      await page.keyboard.press('Enter');
      assert.deepEqual(await page.evaluate(() => globalThis.artistCatalogPagesFixture.reads), [
        { limit: 25, offset: 0 }, { limit: 25, offset: 25 }, { limit: 25, offset: 25 },
      ], 'Retry reuses the failed offset and terminal activation performs no fetch');
      assert.deepEqual(await page.evaluate(() => globalThis.artistCatalogPagesFixture.mutations), []);
      assert.deepEqual(pageErrors, []);
      await pagination.scrollIntoViewIfNeeded();
      await page.screenshot({ path: '.tmp/catalog-pagination.png' });
    }, { scenarioName: 'artist_remote_catalog_pagination_retry' });
  });
});
