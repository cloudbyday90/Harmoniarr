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
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailableReason;

async function installEditionCatalog(page, remote) {
  await page.evaluate((isRemote) => {
    const originalFetch = globalThis.fetch.bind(globalThis);
    const editions = Array.from({ length: 9 }, (_, index) => ({
      id: isRemote ? null : `local-edition-${index + 1}`,
      musicbrainzReleaseId: `mb-edition-${index + 1}`,
      title: isRemote && index === 8 ? 'Edition 9: An expanded anniversary collection of alternate recordings and previously unheard performances' : `Edition ${index + 1}`,
      country: 'GB',
      releaseDate: `2000-${String(index + 1).padStart(2, '0')}-01`,
      trackCount: index + 1,
      mediumCount: 1,
      status: 'Official',
      disambiguation: index === 8 ? 'Expanded anniversary edition with additional recordings and alternate packaging' : null,
      isCanonical: false,
    }));
    globalThis.editionSelectorFixture = { reads: [], mutations: [] };
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url, globalThis.location.href);
      const method = (init?.method ?? input?.method ?? 'GET').toUpperCase();
      if (!['GET', 'HEAD'].includes(method)
        && /\/operator(?:\/|$)|\/canonical$|\/media-requests(?:\/|$)/u.test(url.pathname)) {
        globalThis.editionSelectorFixture.mutations.push({ method, path: url.pathname });
      }
      if (url.pathname.endsWith('/tracklist')) {
        globalThis.editionSelectorFixture.reads.push(Object.fromEntries(url.searchParams));
        const selected = editions.find((edition) => (
          isRemote
            ? edition.musicbrainzReleaseId === url.searchParams.get('preferReleaseMbid')
            : edition.id === url.searchParams.get('preferReleaseId')
        )) ?? editions[0];
        return new Response(JSON.stringify({
          ok: true, release: selected, allReleases: editions,
          media: [], ownership: null, requestState: null, source: isRemote ? 'musicbrainz' : 'local',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return originalFetch(input, init);
    };
  }, remote);
}

suite('Release edition selector browser verification', () => {
  before(async () => {
    try {
      runtime = await createBrowserSmokeRuntime({ config });
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) throw error;
      unavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => runtime?.cleanup(), { timeout: config.suiteTeardownTimeoutMs });

  for (const remote of [false, true]) {
    test(`${remote ? 'remote editions with null local IDs' : 'local editions'} remain distinct and keyboard reachable beyond six`, {
      timeout: config.scenarioTimeoutMs,
    }, async (t) => {
      if (unavailableReason) return t.skip(unavailableReason);
      await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
        await installMetadataBrowserFixtures(browserContext);
        await bootstrapAdminThroughUi(page, { baseUrl });
        await markBoardsOfCanadaAddedInMetadataBrowserFixture(page);
        await page.goto(`${baseUrl}/app/artists/mb-artist-boards`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Boards of Canada', exact: true }).waitFor();
        await installEditionCatalog(page, remote);
        await page.getByRole('button', { name: 'View details for Music Has the Right to Children' }).click();
        const dialog = page.getByRole('dialog').filter({ has: page.locator('h2.rdm-release-title') });
        const picker = dialog.getByRole('combobox', { name: 'Preview an edition', exact: true });
        await picker.waitFor();
        await page.getByRole('dialog', { name: 'Edition 1', exact: true }).waitFor();
        assert.equal(await dialog.getByRole('heading', { level: 2, name: 'Edition 1', exact: true }).count(), 1);
        const prefix = remote ? 'musicbrainz:mb-edition-' : 'local:local-edition-';
        assert.equal(await picker.locator('option').count(), 9);
        assert.equal(await picker.inputValue(), `${prefix}1`);
        assert.equal(await picker.locator('option:checked').count(), 1);
        await picker.focus();
        await page.keyboard.press('End');
        assert.equal(await picker.inputValue(), `${prefix}9`);
        assert.equal(await page.evaluate(() => globalThis.editionSelectorFixture.reads.length), 1,
          'Choosing an option must not load it before explicit preview');
        const preview = dialog.getByRole('button', { name: 'Preview edition', exact: true });
        await preview.focus();
        await page.keyboard.press('Enter');
        await page.waitForFunction(({ parameter, value }) => (
          globalThis.editionSelectorFixture.reads.some((query) => query[parameter] === value)
        ), { parameter: remote ? 'preferReleaseMbid' : 'preferReleaseId',
          value: remote ? 'mb-edition-9' : 'local-edition-9' });
        await picker.waitFor();
        assert.equal(await picker.inputValue(), `${prefix}9`);
        assert.equal(await picker.locator('option:checked').count(), 1);
        const selectedTitle = remote
          ? 'Edition 9: An expanded anniversary collection of alternate recordings and previously unheard performances'
          : 'Edition 9';
        await page.getByRole('dialog', { name: selectedTitle, exact: true }).waitFor();
        const heading = dialog.getByRole('heading', { level: 2, name: selectedTitle, exact: true });
        assert.equal(await heading.count(), 1);
        assert.equal(await dialog.getAttribute('aria-labelledby'), await heading.getAttribute('id'));
        assert.equal(await page.getByRole('dialog', { name: 'Edition 1', exact: true }).count(), 0);
        assert.equal(await dialog.getByRole('button', { name: 'Close', exact: true }).evaluate((button) => (
          button === globalThis.document.activeElement
        )), true, 'Preview keeps focus on the persistent Close control');
        const reads = await page.evaluate(() => globalThis.editionSelectorFixture.reads);
        const lastRead = reads.at(-1);
        assert.equal(Object.hasOwn(lastRead, remote ? 'preferReleaseId' : 'preferReleaseMbid'), false);
        assert.deepEqual(await page.evaluate(() => globalThis.editionSelectorFixture.mutations), []);
        if (remote) {
          assert.equal(await dialog.getByRole('button', { name: 'Edition actions', exact: true }).count(), 0);
        }
        for (const theme of ['light', 'dark']) {
          await page.evaluate((value) => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
          for (const width of [390, 800, 1280]) {
            await page.setViewportSize({ width, height: 844 });
            await heading.scrollIntoViewIfNeeded();
            const headingBounds = await heading.boundingBox();
            const closeBounds = await dialog.getByRole('button', { name: 'Close', exact: true }).boundingBox();
            assert.ok(headingBounds && closeBounds && headingBounds.x >= 0
              && headingBounds.x + headingBounds.width <= closeBounds.x
              && closeBounds.x + closeBounds.width <= width
              && closeBounds.y >= 0 && closeBounds.y + closeBounds.height <= 844,
            `${theme} title and Close remain visible without overlap at ${width}px`);
            if (remote && width === 390) await page.screenshot({ path: `.tmp/heading-long-title-${theme}.png` });
            await picker.scrollIntoViewIfNeeded();
            const bounds = await picker.boundingBox();
            assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width,
              `${theme} edition selector fits a ${width}px viewport`);
            assert.equal(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1), true,
              `${theme} dialog has no horizontal content overflow at ${width}px`);
            if (remote) await page.screenshot({ path: `.tmp/release-edition-selector-${theme}-${width}.png` });
          }
        }
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        await page.goto('about:blank');
      }, { scenarioName: `release_edition_selector_${remote ? 'remote' : 'local'}_keyboard` });
    });
  }
});
