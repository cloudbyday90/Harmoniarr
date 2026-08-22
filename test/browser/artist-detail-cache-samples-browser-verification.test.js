/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import {
  artistDetailCacheSampleCatalog,
  artistDetailCacheSampleSearchQuery,
  artistDetailCacheSampleTierCounts,
} from '../../testing/metadata/artist-detail-cache-sample-catalog.js';
import {
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import { installMetadataBrowserFixtures } from '../../testing/browser/metadata-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Artist Detail cache local sample catalog browser coverage', () => {
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

  test('serves twenty balanced, deterministic Artist Detail samples without provider access', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    assert.equal(artistDetailCacheSampleCatalog.length, 20);
    assert.deepEqual(artistDetailCacheSampleTierCounts, {
      semi_known: 10,
      widely_known: 10,
    });
    assert.equal(
      new Set(artistDetailCacheSampleCatalog.map((sample) => sample.musicBrainzArtistId)).size,
      artistDetailCacheSampleCatalog.length,
    );

    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext, {
        includeArtistDetailCacheSamples: true,
      });
      await bootstrapAdminThroughUi(page, { baseUrl });

      const searchPayload = await page.evaluate(async (query) => {
        const response = await fetch(`/api/v1/metadata/musicbrainz/artists/search?q=${encodeURIComponent(query)}`);
        return response.json();
      }, artistDetailCacheSampleSearchQuery);
      assert.equal(searchPayload.search.total, artistDetailCacheSampleCatalog.length);
      assert.deepEqual(
        searchPayload.search.results.map((artist) => artist.id),
        artistDetailCacheSampleCatalog.map((sample) => sample.musicBrainzArtistId),
      );

      for (const sample of artistDetailCacheSampleCatalog) {
        await page.goto(`${baseUrl}/app/artists/${sample.musicBrainzArtistId}`, {
          waitUntil: 'domcontentloaded',
        });

        await page.getByRole('heading', { exact: true, name: sample.searchResult.name }).waitFor();
        await page.getByRole('heading', { exact: true, name: 'Discography' }).waitFor();
        await page.getByText(sample.releaseTitle, { exact: true }).waitFor();
        await page.getByRole('heading', { exact: true, name: 'Related artists' }).waitFor();
        await page.getByText(sample.relatedArtists[0].name, { exact: true }).waitFor();
      }

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'artist_detail_cache_local_sample_catalog',
    });
  });
});
