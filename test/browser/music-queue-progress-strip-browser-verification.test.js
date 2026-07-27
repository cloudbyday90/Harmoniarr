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

let browserRuntime;
let runtimeUnavailableReason = null;

function buildMusicQueuePayload({ metadataArtistId = null } = {}) {
  const isArtistScoped = metadataArtistId === 'metadata-artist-boards';
  const release = isArtistScoped
    ? {
      artistName: 'Boards of Canada',
      expectedTrackCount: 12,
      id: 'wanted-boards-quality',
      metadataArtistId,
      missingTrackCount: 12,
      releaseGroupTitle: 'Geogaddi',
      releaseGroupType: 'Album',
      releaseTitle: 'Geogaddi',
      status: {
        code: 'quality_choice_needed',
        detail: 'This download needs a quality choice before Harmoniarr can continue.',
        label: 'Quality choice needed',
        nextAction: 'review_quality_choice',
        tone: 'warning',
      },
    }
    : {
      artistName: 'Boards of Canada',
      expectedTrackCount: 12,
      id: 'wanted-boards-search',
      missingTrackCount: 12,
      releaseGroupTitle: 'Music Has the Right to Children',
      releaseGroupType: 'Album',
      releaseTitle: 'Music Has the Right to Children',
      status: {
        code: 'searching',
        detail: 'Harmoniarr is looking for an acceptable match.',
        label: 'Searching',
        nextAction: 'review_matches',
        tone: 'info',
      },
    };

  const idleRelease = {
    artistName: 'Boards of Canada',
    expectedTrackCount: 12,
    id: 'wanted-boards-idle',
    missingTrackCount: 0,
    releaseGroupTitle: 'The Campfire Headphase',
    releaseGroupType: 'Album',
    releaseTitle: 'The Campfire Headphase',
    status: {
      code: 'in_library',
      detail: 'This release is already in your library.',
      label: 'In library',
      nextAction: null,
      tone: 'success',
    },
  };

  return {
    checkedAt: '2026-07-25T23:00:00.000Z',
    pagination: { limit: 100, offset: 0, total: 1 },
    releases: isArtistScoped ? [release] : [idleRelease, release],
    summary: { counts: { [release.status.code]: 1, in_library: isArtistScoped ? 0 : 1 }, total: isArtistScoped ? 1 : 2 },
  };
}

suite('Music Queue progress strip browser verification', () => {
  before(async () => {
    try {
      browserRuntime = await createBrowserSmokeRuntime({ config: integrationRuntimeConfig });
      runtimeUnavailableReason = null;
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) {
        throw error;
      }

      runtimeUnavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, { timeout: integrationRuntimeConfig.suiteSetupTimeoutMs });

  after(async () => {
    await browserRuntime?.cleanup();
  }, { timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs });

  test('Home focuses active work while Artist Detail retains scoped release progress', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));

      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await markBoardsOfCanadaAddedInMetadataBrowserFixture(page);
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/, async (route) => {
        const url = new URL(route.request().url());
        await route.fulfill({
          body: JSON.stringify(buildMusicQueuePayload({
            metadataArtistId: url.searchParams.get('metadataArtistId'),
          })),
          contentType: 'application/json',
        });
      });

      await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
      const homeProgress = page.locator('.music-queue-progress').filter({
        has: page.getByRole('heading', { exact: true, name: 'Music Queue' }),
      });
      await homeProgress.getByText('Music Has the Right to Children by Boards of Canada').waitFor();
      await homeProgress.getByText('Harmoniarr is looking for an acceptable match.').waitFor();
      assert.equal(
        await homeProgress.getByText('The Campfire Headphase by Boards of Canada').count(),
        0,
      );
      assert.equal(
        await homeProgress.getByRole('link', { name: 'View details' }).getAttribute('href'),
        '/app/music-queue/wanted-boards-search',
      );

      await page.goto(`${baseUrl}/app/artists/mb-artist-boards`, { waitUntil: 'domcontentloaded' });
      const artistProgress = page.locator('.music-queue-progress').filter({
        has: page.getByRole('heading', { exact: true, name: 'Music Queue for this artist' }),
      });
      await artistProgress.getByText('Geogaddi by Boards of Canada').waitFor();
      await artistProgress.getByText('This download needs a quality choice before Harmoniarr can continue.').waitFor();
      assert.equal(
        await artistProgress.getByRole('link', { name: 'Review' }).getAttribute('href'),
        '/app/music-queue/wanted-boards-quality',
      );
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'music_queue_progress_strip' });
  });
});
