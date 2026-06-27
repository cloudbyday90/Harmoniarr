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

const selectionControlSelector = '.artist-detail-selection__select';
const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';

let browserRuntime;
let runtimeUnavailableReason = null;

async function expandBoardsAlbumsForBulkConfirmation(page, releaseCount = 26) {
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
        firstReleaseDate: `2000-${String((index % 12) + 1).padStart(2, '0')}-01`,
        id: `metadata-rg-bulk-${position}`,
        musicbrainzReleaseGroupId: `mb-rg-bulk-${position}`,
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
        title: `Bulk Album ${position}`,
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

suite('Artist Detail bulk-change confirmation browser verification', () => {
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

  test('small section bulk changes apply immediately as draft state', {
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

      await page.goto(`${baseUrl}/app/artists/mb-artist-boards`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Discography' }).waitFor();

      const albumsSection = page.locator('.artist-detail-discography__section').filter({
        has: page.getByRole('heading', { exact: true, name: 'Albums' }),
      });
      await albumsSection.getByRole('button', { name: /clear all/iu }).click();
      assert.equal(
        await page.getByRole('alertdialog', { name: 'Confirm large bulk change' }).count(),
        0,
      );

      const albumsList = page.getByRole('list', { name: /^albums$/iu });
      const albumSelections = albumsList.locator(selectionControlSelector);
      assert.equal(await albumSelections.nth(0).inputValue(), 'unselected');
      assert.equal(await albumSelections.nth(1).inputValue(), 'unselected');
      await page.getByText('Unsaved changes').waitFor();

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'artist_detail_small_bulk_change_draft_state',
    });
  });

  test('large section bulk changes require confirmation before draft mutation', {
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
      await expandBoardsAlbumsForBulkConfirmation(page);

      await page.goto(`${baseUrl}/app/artists/mb-artist-boards`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Discography' }).waitFor();

      const albumsSection = page.locator('.artist-detail-discography__section').filter({
        has: page.getByRole('heading', { exact: true, name: 'Albums' }),
      });
      const albumsList = page.getByRole('list', { name: /^albums$/iu });
      await albumsList.getByRole('button', { name: 'View details for Bulk Album 26' }).waitFor();
      const albumSelections = albumsList.locator(selectionControlSelector);
      assert.equal(await albumSelections.nth(0).inputValue(), 'selected');

      await albumsSection.getByRole('button', { name: /clear all/iu }).click();

      const confirmDialog = page.getByRole('alertdialog', { name: 'Confirm large bulk change' });
      await confirmDialog.waitFor();
      await confirmDialog.getByText(
        'This will clear 26 releases in albums. The change stays in draft until you save policy.',
      ).waitFor();
      assert.equal(await albumSelections.nth(0).inputValue(), 'selected');

      await confirmDialog.getByRole('button', { name: 'Apply draft change' }).click();
      await confirmDialog.waitFor({ state: 'detached' });

      assert.equal(await albumSelections.nth(0).inputValue(), 'unselected');
      assert.equal(await albumSelections.nth(25).inputValue(), 'unselected');
      await page.getByText('Unsaved changes').waitFor();

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'artist_detail_large_bulk_change_confirmation',
    });
  });
});
