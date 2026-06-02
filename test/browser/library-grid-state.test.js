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
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { installLibraryBrowserFixtures } from '../../testing/browser/library-browser-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
let browserRuntime;
let runtimeUnavailableReason = null;

function isLibraryReleasesResponse(response) {
  return new URL(response.url()).pathname === '/api/v1/library/releases';
}

function hasLibraryReleaseQuery(response, expectedQuery) {
  if (!isLibraryReleasesResponse(response)) return false;
  const url = new URL(response.url());

  return Object.entries(expectedQuery).every(([key, expectedValue]) =>
    url.searchParams.get(key) === expectedValue,
  );
}

function hasDefaultLibraryReleaseQuery(response) {
  if (!isLibraryReleasesResponse(response)) return false;
  const url = new URL(response.url());
  const params = url.searchParams;

  return params.get('sort') === 'artist'
    && params.get('order') === 'asc'
    && !params.has('format')
    && !params.has('status');
}

suite('browser Library grid state coverage', () => {
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

  test('Library deep link applies dynamic format filter and Clear all resets filter and sort query state', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installLibraryBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });

      const filteredResponse = page.waitForResponse((response) =>
        hasLibraryReleaseQuery(response, {
          format: 'FLAC',
          order: 'desc',
          sort: 'title',
        }),
      );
      await page.goto(`${baseUrl}/app/library?focus=library&format=FLAC&sort=title&order=desc`, {
        waitUntil: 'domcontentloaded',
      });
      await filteredResponse;

      await page.getByRole('heading', { name: 'Library' }).waitFor();
      await page.getByRole('button', { name: 'Remove filter: Format FLAC' }).waitFor();
      await page.getByText("Tomorrow's Harvest").waitFor();
      await page.getByText('Selected Ambient Works 85-92').waitFor({ state: 'hidden' });
      assert.equal(
        await page.getByRole('combobox', { name: /Sort by/ }).inputValue(),
        'title',
      );

      const clearedResponse = page.waitForResponse(hasDefaultLibraryReleaseQuery);
      await page.getByRole('button', { name: 'Clear all' }).first().click();
      await clearedResponse;

      await page.waitForURL(/\/app\/library\?focus=library$/);
      await page.getByText("Tomorrow's Harvest").waitFor();
      await page.getByText('Selected Ambient Works 85-92').waitFor();
      await page.getByRole('button', { name: 'Remove filter: Format FLAC' }).waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Clear all' }).waitFor({ state: 'detached' });
      assert.equal(
        await page.getByRole('combobox', { name: /Sort by/ }).inputValue(),
        'artist',
      );
    }, {
      scenarioName: 'library_grid_state_browser',
    });
  });

  test('Library Needs Attention exposes partial request and duplicate review actions', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installLibraryBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/library`, {
        waitUntil: 'domcontentloaded',
      });

      await page.getByRole('heading', { name: 'Needs Attention' }).waitFor();
      await page.getByRole('heading', { name: 'Complete your collection' }).waitFor();
      await page.getByRole('heading', { name: 'Duplicates to review' }).waitFor();
      await page.getByRole('button', { name: 'Request remaining 5 tracks' }).waitFor();

      await page.getByRole('button', { name: 'Review duplicates' }).click();
      const needsAttention = page.getByLabel('Needs Attention');
      await needsAttention.getByText('Tri Repetae').waitFor();
      await needsAttention.getByText('Autechre · 3 duplicate files').waitFor();

      const reviewLink = needsAttention.getByRole('link', { name: 'Review files' });
      const reviewHref = await reviewLink.getAttribute('href');
      assert.ok(reviewHref, 'Review files link must render an href');
      const reviewUrl = new URL(reviewHref, baseUrl);
      assert.equal(reviewUrl.pathname, '/app/settings/library-browser');
      assert.equal(reviewUrl.searchParams.get('releaseGroupId'), 'metadata-rg-tri-repetae');

      const tracklistResponse = page.waitForResponse((response) =>
        new URL(response.url()).pathname === '/api/v1/metadata/musicbrainz/release-groups/mb-rg-geogaddi/tracklist',
      );
      await page.getByRole('button', { name: 'Request remaining 5 tracks' }).click();
      await tracklistResponse;

      await page.getByRole('dialog', { name: 'Release detail' }).waitFor();
      await page.getByText('Geogaddi').last().waitFor();
      await page.getByText('18 of 23 tracks in library').waitFor();
      await page.getByText('Music Is Math').waitFor();
    }, {
      scenarioName: 'library_needs_attention_browser',
    });
  });

  test('Library display mode toggles to list view and persists outside the URL', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installLibraryBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/library`, {
        waitUntil: 'domcontentloaded',
      });

      await page.getByRole('radio', { name: 'Grid' }).waitFor();
      await page.getByRole('radio', { name: 'List' }).check();

      const list = page.getByRole('list', { name: 'Library releases' });
      await list.getByText("Tomorrow's Harvest").waitFor();
      await list.getByText('Boards of Canada').first().waitFor();
      await list.getByText('17 tracks').waitFor();
      assert.equal(
        new URL(page.url()).searchParams.has('display'),
        false,
        'display preference must not be written to URL query state',
      );

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('radio', { name: 'List' }).waitFor();
      assert.equal(await page.getByRole('radio', { name: 'List' }).isChecked(), true);
      await page.getByRole('list', { name: 'Library releases' }).getByText('Tri Repetae').waitFor();

      await page.getByRole('radio', { name: 'Grid' }).check();
      assert.equal(await page.getByRole('radio', { name: 'Grid' }).isChecked(), true);
    }, {
      scenarioName: 'library_display_mode_browser',
    });
  });
});
