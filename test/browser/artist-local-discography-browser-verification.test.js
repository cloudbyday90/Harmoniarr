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

async function installLocalCatalogPages(page) {
  await page.evaluate(async () => {
    const originalFetch = globalThis.fetch.bind(globalThis);
    const endpoint = '/api/v1/metadata/artists/metadata-artist-boards/operator';
    const template = await (await originalFetch(endpoint)).json();
    const id = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
    const fixture = {
      reads: [], summaryReads: [], saves: [], editionSaves: [], remoteReads: [], finishPage: null,
      savedSelection: { metadataReleaseGroupId: id(28), resolvedMetadataReleaseId: null,
        selectionSource: 'manual', selectionState: 'unselected' },
      savedTrackOverride: { metadataReleaseGroupId: id(27), metadataReleaseId: id(127),
        recordingMbid: id(227), trackMbid: null, mediumPosition: 1, trackPosition: 2,
        isDesired: false, remapStatus: 'resolved', trackLengthMsSnapshot: 123000,
        trackTitleSnapshot: 'Retained off-page track' },
    };
    globalThis.artistLocalCatalogFixture = fixture;
    const rows = Array.from({ length: 28 }, (_, index) => ({
      ...template.releaseGroups[0],
      id: id(index + 1), artistId: template.artist.id, musicbrainzReleaseGroupId: id(index + 1),
      title: `Local catalog album ${String(index + 1).padStart(2, '0')}`,
      primaryType: 'Album', secondaryTypes: [], firstReleaseDate: '2020-01-01', releaseCount: 1,
      source: { provider: 'musicbrainz', sourceReleaseGroupId: id(index + 1), musicbrainzReleaseGroupId: id(index + 1) },
    }));
    let projection = {
      ...template,
      operator: {
        ...template.operator,
        monitoring: { ...template.operator.monitoring, isMonitored: true, monitoredReleaseGroupTypes: ['album'] },
        overview: { ...template.operator.overview, releaseGroupCount: 28,
          manualSelectionCount: 1, trackOverrideCount: 1, hasManualOverrides: true },
        reconciliation: { ...template.operator.reconciliation, latestSnapshot: { snapshotRevision: 7 } },
        releaseGroupSelections: [fixture.savedSelection], trackOverrides: [fixture.savedTrackOverride],
      },
      releaseGroups: rows, releases: [],
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json' },
    });
    const reviewedEdition = { id: id(126), releaseGroupId: id(26), title: 'Local catalog album 26 review edition',
      status: 'Official', releaseDate: '2020-01-01', country: 'US', trackCount: 1, mediumCount: 1,
      isCanonical: false, source: { provider: 'musicbrainz', sourceReleaseId: id(126), musicbrainzReleaseId: id(126) } };
    const effectiveRows = () => rows.map((row) => {
      const selection = projection.operator.releaseGroupSelections.find((entry) => entry.metadataReleaseGroupId === row.id);
      return { ...row, operatorState: { ...row.operatorState, isExplicitSelection: Boolean(selection),
        selectionSource: selection ? 'manual' : 'policy', selectionState: selection?.selectionState ?? 'selected',
        selectionOrigin: selection?.selectionOrigin ?? null,
        resolvedMetadataReleaseId: selection?.resolvedMetadataReleaseId ?? null } };
    });
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url, globalThis.location.href);
      const method = (init?.method ?? input?.method ?? 'GET').toUpperCase();
      if (url.pathname === endpoint && method === 'GET') {
        fixture.summaryReads.push(url.searchParams.get('view'));
        const body = { ...projection, releaseGroups: effectiveRows() };
        if (url.searchParams.get('view') === 'summary') {
          delete body.releaseGroups;
          delete body.releases;
        }
        return json(body);
      }
      if (url.pathname === `${endpoint}/discography` && method === 'GET') {
        const cursor = url.searchParams.get('cursor');
        fixture.reads.push({ cursor, limit: Number(url.searchParams.get('limit')) });
        if (cursor === null) return json({ ok: true, releaseGroups: effectiveRows().slice(0, 25),
          pageInfo: { hasMore: true, nextCursor: 'local-page-2' } });
        return new Promise((resolve) => {
          fixture.finishPage = (succeed) => {
            fixture.finishPage = null;
            resolve(succeed
              ? json({ ok: true, releaseGroups: effectiveRows().slice(25), pageInfo: { hasMore: false, nextCursor: null } })
              : json({ ok: false, error: { code: 'fixture_page_unavailable', message: 'Fixture local catalog page unavailable.' } }, 503));
          };
        });
      }
      if (url.pathname === endpoint && method === 'PUT') {
        const draft = JSON.parse(init.body);
        fixture.saves.push(draft);
        projection = { ...projection, operator: { ...projection.operator,
          monitoring: draft.monitoring, releaseGroupSelections: draft.releaseGroupSelections,
          trackOverrides: draft.trackOverrides, reconciliation: { ...projection.operator.reconciliation,
            latestSnapshot: { snapshotRevision: 7 + fixture.saves.length } } } };
        // Real saves can return a full projection; the client must still page its display.
        return json({ ok: true, projection: { ...projection, releaseGroups: effectiveRows() } });
      }
      if (url.pathname === `/api/v1/metadata/musicbrainz/release-groups/${id(26)}/tracklist` && method === 'GET') {
        return json({ ok: true, source: 'local', release: reviewedEdition, media: [], ownership: null,
          allReleases: [reviewedEdition] });
      }
      if (url.pathname === `${endpoint}/release-groups/${id(26)}/manual-edition-selection` && method === 'POST') {
        const selection = JSON.parse(init.body);
        fixture.editionSaves.push(selection);
        projection = { ...projection, operator: { ...projection.operator,
          releaseGroupSelections: [...projection.operator.releaseGroupSelections,
            { metadataReleaseGroupId: id(26), resolvedMetadataReleaseId: selection.metadataReleaseId,
              selectionSource: 'manual', selectionOrigin: 'manual_edition', selectionState: 'selected' }],
          reconciliation: { ...projection.operator.reconciliation, latestSnapshot: { snapshotRevision: 8 } } } };
        return json({ ok: true, alreadySelected: false, projection: { ...projection, releaseGroups: effectiveRows() } });
      }
      if (method === 'GET' && url.pathname === '/api/v1/metadata/musicbrainz/artists/mb-artist-boards/release-groups') {
        fixture.remoteReads.push(url.pathname);
      }
      return originalFetch(input, init);
    };
  });
}

suite('Artist local discography browser verification', () => {
  before(async () => {
    try { runtime = await createBrowserSmokeRuntime({ config }); }
    catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) throw error;
      unavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => runtime?.cleanup(), { timeout: config.suiteTeardownTimeoutMs });

  test('local page retry preserves draft edits and saves retain decisions outside the displayed page', {
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
      await installLocalCatalogPages(page);
      await page.getByLabel('Search for an artist').fill('Boards of Canada');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await page.getByRole('link', { name: 'View Boards of Canada', exact: true }).click();
      const discography = page.getByRole('article', { name: 'Discography', exact: true });
      const cards = discography.getByRole('button', { name: /^View details for Local catalog album /u });
      const pagination = discography.locator('.artist-discography-pagination');
      const button = pagination.getByRole('button');
      const selection = (number) => discography.getByRole('combobox', { name: `Selection state for Local catalog album ${String(number).padStart(2, '0')}`, exact: true });
      await selection(25).waitFor();
      assert.equal(await cards.count(), 25);
      assert.deepEqual(await page.evaluate(() => globalThis.artistLocalCatalogFixture.summaryReads), ['summary']);
      await selection(1).selectOption('unselected');
      await page.getByText('Unsaved changes', { exact: true }).waitFor();
      await button.focus();
      await page.keyboard.press('Enter');
      await pagination.getByRole('status').filter({ hasText: 'Loading more release groups' }).waitFor();
      await assertLocatorFocused(button, 'Loading keeps the native button focused');
      assert.equal(await button.getAttribute('aria-disabled'), 'true');
      await button.evaluate((element) => { element.click(); element.click(); });
      assert.equal(await page.evaluate(() => globalThis.artistLocalCatalogFixture.reads.length), 2);
      await page.evaluate(() => globalThis.artistLocalCatalogFixture.finishPage(false));
      await pagination.getByRole('alert').waitFor();
      await pagination.getByRole('button', { name: 'Retry loading release groups', exact: true }).waitFor();
      assert.equal(await cards.count(), 25);
      assert.equal(await selection(1).inputValue(), 'unselected');
      await assertLocatorFocused(button, 'Failure keeps focus available for keyboard retry');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => typeof globalThis.artistLocalCatalogFixture.finishPage === 'function');
      await page.evaluate(() => globalThis.artistLocalCatalogFixture.finishPage(true));
      await selection(28).waitFor();
      assert.equal(await cards.count(), 28);
      assert.equal(await selection(1).inputValue(), 'unselected', 'Appending a page must not reset the draft');
      await page.getByText('Unsaved changes', { exact: true }).waitFor();
      assert.equal(await pagination.getByRole('alert').count(), 0);
      await assertLocatorFocused(button, 'Completion keeps the pagination control focused');
      assert.equal(await button.getAttribute('aria-disabled'), 'true');

      await page.getByRole('button', { name: 'Save policy', exact: true }).click();
      await page.waitForFunction(() => globalThis.artistLocalCatalogFixture.reads.filter((read) => read.cursor === null).length === 2);
      await button.filter({ hasText: 'Load more release groups' }).waitFor();
      assert.equal(await cards.count(), 25, 'A full save response must refresh the bounded first display page');
      assert.equal(await selection(1).inputValue(), 'unselected');
      assert.equal(await selection(28).count(), 0, 'The saved off-page selection is not currently displayed');
      await selection(2).selectOption('unselected');
      await page.getByRole('button', { name: 'Save policy', exact: true }).click();
      await page.waitForFunction(() => globalThis.artistLocalCatalogFixture.reads.filter((read) => read.cursor === null).length === 3);
      const evidence = await page.evaluate(() => {
        const { saves, reads, remoteReads, savedSelection, savedTrackOverride } = globalThis.artistLocalCatalogFixture;
        return { saves, reads, remoteReads, savedSelection, savedTrackOverride };
      });
      assert.equal(evidence.saves.length, 2);
      for (const [index, draft] of evidence.saves.entries()) {
        assert.equal(draft.expectedSnapshotRevision, 7 + index);
        assert.deepEqual(draft.releaseGroupSelections.find((entry) => entry.metadataReleaseGroupId === evidence.savedSelection.metadataReleaseGroupId), evidence.savedSelection);
        assert.deepEqual(draft.trackOverrides, [evidence.savedTrackOverride]);
        assert.equal(draft.releaseGroupSelections.length, index + 2, 'Saves include all global decisions plus each visible edit');
      }
      assert.deepEqual(evidence.reads, [
        { limit: 25, cursor: null }, { limit: 25, cursor: 'local-page-2' },
        { limit: 25, cursor: 'local-page-2' }, { limit: 25, cursor: null }, { limit: 25, cursor: null },
      ]);
      assert.deepEqual(evidence.remoteReads, [], 'A summary response must not trigger remote catalog fallback');
      assert.deepEqual(pageErrors, []);
      await pagination.scrollIntoViewIfNeeded();
      await page.screenshot({ path: '.tmp/local-catalog-pagination.png' });
    }, { scenarioName: 'artist_local_catalog_draft_preservation' });
  });

  test('an edition saved from a later page remains selected in the open dialog after the display refreshes', {
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
      await installLocalCatalogPages(page);
      await page.getByLabel('Search for an artist').fill('Boards of Canada');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await page.getByRole('link', { name: 'View Boards of Canada', exact: true }).click();
      const discography = page.getByRole('article', { name: 'Discography', exact: true });
      const pagination = discography.locator('.artist-discography-pagination');
      await pagination.getByRole('button', { name: 'Load more release groups', exact: true }).click();
      await page.waitForFunction(() => typeof globalThis.artistLocalCatalogFixture.finishPage === 'function');
      await page.evaluate(() => globalThis.artistLocalCatalogFixture.finishPage(true));
      const detailButton = discography.getByRole('button', { name: 'View details for Local catalog album 26', exact: true });
      await detailButton.click();
      const dialog = page.getByRole('dialog', { name: 'Local catalog album 26 review edition', exact: true });
      await dialog.waitFor();
      const saveEdition = dialog.getByRole('button', { name: 'Save this edition', exact: true });
      assert.equal(await saveEdition.isEnabled(), true);
      await saveEdition.click();
      await page.waitForFunction(() => globalThis.artistLocalCatalogFixture.reads.filter((read) => read.cursor === null).length === 2);
      await pagination.getByRole('status').filter({ hasText: '25 local release groups loaded.' }).waitFor({ state: 'attached' });
      assert.equal(await detailButton.count(), 0, 'The saved release group is outside the refreshed display page');
      await dialog.getByText('Your selected edition', { exact: true }).waitFor();
      const selectedEdition = dialog.getByRole('button', { name: 'Edition selected', exact: true });
      assert.equal(await selectedEdition.isDisabled(), true, 'A completed selection must not offer an unnecessary repeat save');
      assert.equal(await dialog.isVisible(), true);
      assert.deepEqual(await page.evaluate(() => globalThis.artistLocalCatalogFixture.editionSaves), [{
        expectedSnapshotRevision: 7, metadataReleaseId: '00000000-0000-4000-8000-000000000126',
      }]);
      assert.deepEqual(pageErrors, []);
      await page.screenshot({ path: '.tmp/local-catalog-edition-selected.png' });
    }, { scenarioName: 'artist_local_catalog_off_page_edition_selection' });
  });
});
