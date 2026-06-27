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

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
const selectionControlSelector = '.artist-detail-selection__select';

let browserRuntime;
let runtimeUnavailableReason = null;

async function expandBoardsAlbumsForLargeCatalogControls(page, releaseCount = 28) {
  await page.evaluate(({ count, storageKey }) => {
    const rawState = globalThis.sessionStorage.getItem(storageKey);
    const state = rawState ? JSON.parse(rawState) : {};
    const existingProjection = state.operatorProjectionsByMusicBrainzId?.['mb-artist-boards']
      ?? state.boardsOperatorProjection
      ?? {};
    const releaseGroups = Array.from({ length: count }, (_, index) => {
      const position = index + 1;
      return {
        artistCredit: 'Boards of Canada',
        firstReleaseDate: `${1995 + position}-01-01`,
        id: `metadata-rg-catalog-${String(position).padStart(2, '0')}`,
        musicbrainzReleaseGroupId: `mb-rg-catalog-${String(position).padStart(2, '0')}`,
        operatorState: {
          isExplicitSelection: false,
          resolvedMetadataReleaseId: null,
          resolvedRelease: null,
          selectionSource: 'policy',
          selectionState: 'selected',
          trackOverrideSummary: {
            desiredCount: 0,
            orphanedCount: 0,
            reviewNeededCount: 0,
            suppressedCount: 0,
            totalCount: 0,
          },
        },
        primaryType: 'Album',
        title: `Catalog Album ${String(position).padStart(2, '0')}`,
      };
    });
    const nextProjection = {
      ...existingProjection,
      artist: existingProjection.artist ?? {
        id: 'metadata-artist-boards',
        musicBrainzArtistId: 'mb-artist-boards',
        name: 'Boards of Canada',
        type: 'Group',
      },
      operator: {
        ...(existingProjection.operator ?? {}),
        coverage: {
          acquiredReleaseCount: 0,
          desiredReleaseCount: count,
          missingReleaseCount: count,
          partialReleaseCount: 0,
          unresolvedReleaseCount: 0,
        },
        monitoring: {
          acquisitionProfileKey: 'balanced_library',
          isMonitored: true,
          monitoredReleaseGroupTypes: ['album', 'ep'],
          releaseScope: 'future_only',
          searchOnAddMode: 'none',
          selectionSourceMode: 'policy_only',
          wantedAutomationMode: 'future_matching',
        },
        overview: {
          desiredReleaseGroupCount: count,
          desiredTrackOverrideCount: 0,
          hasManualOverrides: false,
          manualSelectionCount: 0,
          orphanedReleaseGroupSelectionCount: 0,
          orphanedTrackOverrideCount: 0,
          partialReleaseGroupCount: 0,
          policySelectionCount: count,
          releaseGroupCount: count,
          reviewNeededTrackOverrideCount: 0,
          selectedReleaseGroupCount: count,
          suppressedTrackOverrideCount: 0,
          trackOverrideCount: 0,
          unselectedReleaseGroupCount: 0,
        },
        reconciliation: {
          latestRun: null,
          latestSnapshot: null,
          pendingRun: null,
          runningRun: null,
          status: 'idle',
        },
        releaseGroupSelections: [],
        trackOverrides: [],
      },
      releaseGroups,
    };
    const operatorProjectionsByMusicBrainzId = {
      ...(state.operatorProjectionsByMusicBrainzId ?? {}),
      'mb-artist-boards': nextProjection,
    };

    globalThis.sessionStorage.setItem(storageKey, JSON.stringify({
      ...state,
      addedArtistIds: [...new Set([...(state.addedArtistIds ?? []), 'mb-artist-boards'])],
      boardsIsAdded: true,
      boardsOperatorProjection: nextProjection,
      operatorProjectionsByMusicBrainzId,
    }));
  }, { count: releaseCount, storageKey: fixtureStateStorageKey });
}

suite('Artist Detail large-catalog controls browser verification', () => {
  before(async () => {
    try {
      browserRuntime = await createBrowserSmokeRuntime({
        config: integrationRuntimeConfig,
      });
      runtimeUnavailableReason = null;
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) {
        throw error;
      }

      runtimeUnavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, {
    timeout: integrationRuntimeConfig.suiteSetupTimeoutMs,
  });

  after(async () => {
    await browserRuntime?.cleanup();
  }, {
    timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs,
  });

  test('Artist Detail section controls filter, sort, reset, and apply visible draft changes', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await markBoardsOfCanadaAddedInMetadataBrowserFixture(page);
      await expandBoardsAlbumsForLargeCatalogControls(page);

      await page.goto(`${baseUrl}/app/artists/mb-artist-boards`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Discography' }).waitFor();

      const albumsSection = page.locator('.artist-detail-discography__section').filter({
        has: page.getByRole('heading', { exact: true, name: 'Albums' }),
      });
      const albumsList = page.getByRole('list', { name: /^albums$/iu });

      await albumsList.getByRole('button', { name: 'View details for Catalog Album 28' }).waitFor();
      await albumsList.getByRole('button', { name: 'View details for Catalog Album 01' }).waitFor();

      await albumsSection.getByLabel('Search Albums').fill('Catalog Album 26');
      await albumsSection.getByText('Showing 1 of 28 releases').waitFor();
      await albumsList.getByRole('button', { name: 'View details for Catalog Album 26' }).waitFor();
      assert.equal(
        await albumsList.getByRole('button', { name: 'View details for Catalog Album 25' }).count(),
        0,
      );

      await albumsSection.getByRole('button', { name: /clear visible/iu }).click();
      await page.getByText('Unsaved changes').waitFor();
      assert.equal(await albumsList.locator(selectionControlSelector).first().inputValue(), 'unselected');

      await albumsSection.getByLabel('Albums selection filter').selectOption('unselected');
      await albumsSection.getByText('Showing 1 of 28 releases').waitFor();
      await albumsList.getByRole('button', { name: 'View details for Catalog Album 26' }).waitFor();

      await albumsSection.getByRole('button', { name: 'Reset' }).click();
      await albumsSection.getByText('28 releases').waitFor();

      await albumsSection.getByLabel('Sort Albums').selectOption('title_asc');
      await albumsList.locator('.hx-media-card__link-area').first().waitFor();
      assert.equal(
        await albumsList.locator('.hx-media-card__link-area').first().getAttribute('aria-label'),
        'View details for Catalog Album 01',
      );

      await albumsSection.getByLabel('Sort Albums').selectOption('title_desc');
      assert.equal(
        await albumsList.locator('.hx-media-card__link-area').first().getAttribute('aria-label'),
        'View details for Catalog Album 28',
      );

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'artist_detail_large_catalog_controls',
    });
  });
});
