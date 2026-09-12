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
        const prefix = 'musicbrainz:mb-edition-';
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
  test('remote continuation retains preview and selection, retries exact page and keeps terminal focus', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) return t.skip(unavailableReason);
    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await markBoardsOfCanadaAddedInMetadataBrowserFixture(page);
      await page.goto(`${baseUrl}/app/artists/mb-artist-boards`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Boards of Canada', exact: true }).waitFor();
      await page.evaluate(() => {
        const originalFetch = globalThis.fetch.bind(globalThis);
        const editions = Array.from({ length: 52 }, (_, index) => ({
          id: null, musicbrainzReleaseId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, title: `Remote edition ${index + 1}`,
          country: 'GB', releaseDate: '2020-01-01', trackCount: 10, mediumCount: 1,
        }));
        const state = { reads: [], tracklistReads: [], mutations: [], finish: null };
        globalThis.editionContinuationFixture = state;
        globalThis.fetch = async (input, init) => {
          const url = new URL(typeof input === 'string' ? input : input.url, globalThis.location.href);
          const method = (init?.method ?? input?.method ?? 'GET').toUpperCase();
          if (!['GET', 'HEAD'].includes(method)) state.mutations.push({ method, path: url.pathname });
          if (url.pathname.endsWith('/tracklist')) {
            state.tracklistReads.push(Object.fromEntries(url.searchParams));
            const releaseGroupId = url.pathname.split('/').at(-2);
            const selected = editions.find((edition) => edition.musicbrainzReleaseId === url.searchParams.get('preferReleaseMbid')) ?? editions[0];
            return new Response(JSON.stringify({ ok: true, release: selected, allReleases: editions.slice(0, 25),
              editionPage: { releaseGroupId, limit: 25, offset: 0, total: 52 },
              source: 'musicbrainz', media: [], ownership: null, requestState: null,
            }), { headers: { 'Content-Type': 'application/json' } });
          }
          if (/musicbrainz\/release-groups\/[^/]+\/releases$/u.test(url.pathname)) {
            const offset = Number(url.searchParams.get('offset'));
            state.reads.push({ offset, limit: Number(url.searchParams.get('limit')) });
            const outcome = await new Promise((resolve) => { state.finish = resolve; });
            if (outcome === 'failure') return new Response(JSON.stringify({ ok: false, error: { message: 'private-provider-diagnostic' } }), {
              status: 502, headers: { 'Content-Type': 'application/json' },
            });
            return new Response(JSON.stringify({ ok: true, releases: { releaseGroupId: url.pathname.split('/').at(-2),
              offset, limit: 25, total: 52, results: editions.slice(offset, offset + 25) } }), {
              headers: { 'Content-Type': 'application/json' },
            });
          }
          return originalFetch(input, init);
        };
      });
      const opener = page.getByRole('button', { name: 'View details for Music Has the Right to Children', exact: true });
      await opener.click();
      const dialog = page.getByRole('dialog').filter({ has: page.locator('h2.rdm-release-title') });
      const picker = dialog.getByRole('combobox', { name: 'Preview an edition', exact: true });
      await picker.waitFor();
      assert.equal(await picker.locator('option').count(), 25);
      await picker.selectOption('musicbrainz:00000000-0000-4000-8000-000000000008');
      const pager = dialog.locator('.hx-release-edition-pagination button');
      await pager.focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => globalThis.editionContinuationFixture.reads.length === 1);
      assert.equal(await pager.getAttribute('aria-disabled'), 'true');
      await pager.evaluate((button) => { button.click(); button.click(); });
      assert.equal(await page.evaluate(() => globalThis.editionContinuationFixture.reads.length), 1);
      await page.getByRole('dialog', { name: 'Remote edition 1', exact: true }).waitFor();
      await page.evaluate(() => globalThis.editionContinuationFixture.finish('failure'));
      await dialog.getByRole('alert').filter({ hasText: 'Could not load more editions. Try again.' }).waitFor();
      assert.doesNotMatch(await dialog.innerText(), /private-provider-diagnostic/u);
      assert.equal(await picker.inputValue(), 'musicbrainz:00000000-0000-4000-8000-000000000008');
      assert.equal(await picker.locator('option').count(), 25);
      assert.equal(await pager.innerText(), 'Retry loading editions');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => globalThis.editionContinuationFixture.reads.length === 2);
      await page.evaluate(() => globalThis.editionContinuationFixture.finish('success'));
      await dialog.getByRole('status').filter({ hasText: '50 editions loaded.' }).waitFor();
      assert.equal(await picker.inputValue(), 'musicbrainz:00000000-0000-4000-8000-000000000008');
      assert.equal(await picker.locator('option').count(), 50);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => globalThis.editionContinuationFixture.reads.length === 3);
      await page.evaluate(() => globalThis.editionContinuationFixture.finish('success'));
      await dialog.getByRole('status').filter({ hasText: '52 editions loaded.' }).waitFor();
      assert.equal(await pager.getAttribute('aria-disabled'), 'true');
      assert.equal(await pager.evaluate((button) => button === globalThis.document.activeElement), true);
      assert.deepEqual(await page.evaluate(() => globalThis.editionContinuationFixture.reads), [
        { offset: 25, limit: 25 }, { offset: 25, limit: 25 }, { offset: 50, limit: 25 },
      ]);
      await picker.focus();
      await page.keyboard.press('End');
      await dialog.getByRole('button', { name: 'Preview edition', exact: true }).click();
      await page.getByRole('dialog', { name: 'Remote edition 52', exact: true }).waitFor();
      assert.equal(await picker.locator('option').count(), 52, 'Preview keeps already loaded edition choices');
      assert.equal(await picker.inputValue(), 'musicbrainz:00000000-0000-4000-8000-000000000052');
      assert.equal(await page.evaluate(() => globalThis.editionContinuationFixture.tracklistReads.at(-1).preferReleaseMbid), '00000000-0000-4000-8000-000000000052');
      assert.deepEqual(await page.evaluate(() => globalThis.editionContinuationFixture.mutations), []);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await opener.click();
      await picker.waitFor();
      assert.equal(await picker.locator('option').count(), 25, 'Reopening starts a fresh catalog session');
      await pager.click();
      await page.waitForFunction(() => globalThis.editionContinuationFixture.reads.length === 4);
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await opener.click();
      await picker.waitFor();
      await page.evaluate(() => globalThis.editionContinuationFixture.finish('success'));
      await page.evaluate(() => new Promise((resolve) => { globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)); }));
      assert.equal(await picker.locator('option').count(), 25, 'Obsolete continuation cannot populate a reopened dialog');
      await page.goto('about:blank');
    }, { scenarioName: 'release_edition_continuation_retry_preview_lifecycle' });
  });

});
