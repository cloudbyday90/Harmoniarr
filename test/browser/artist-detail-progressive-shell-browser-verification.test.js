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
import { installMetadataBrowserFixtures } from '../../testing/browser/metadata-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Artist Detail progressive shell browser coverage', () => {
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

  test('Artist Detail keeps the known profile visible and settles Discography after local metadata loads', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext, {
        artistDetailLocalDelayMs: 2_000,
      });
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(
        `${baseUrl}/app/artists/mb-artist-boards?name=Boards%20of%20Canada`,
        { waitUntil: 'domcontentloaded' },
      );

      await page.getByRole('heading', { exact: true, name: 'Boards of Canada' }).waitFor();
      await page.getByText('Loading releases for Boards of Canada…', { exact: true }).waitFor();

      const discographyRegion = page.getByRole('article', {
        exact: true,
        name: 'Discography',
      });
      const busyDiscographyBody = discographyRegion.locator('[aria-busy="true"]');

      await busyDiscographyBody.waitFor({ state: 'visible' });
      assert.equal(
        await busyDiscographyBody.count(),
        1,
        'Discography has one busy region while its local metadata is loading',
      );

      assert.equal(
        await page.getByText('Loading artist detail...', { exact: true }).count(),
        0,
      );

      await page.getByRole('heading', { exact: true, name: 'Discography' }).waitFor();
      await page.getByText('Music Has the Right to Children', { exact: true }).waitFor();
      await busyDiscographyBody.waitFor({ state: 'detached' });
      assert.equal(
        await busyDiscographyBody.count(),
        0,
        'Discography is no longer busy once its loaded release is rendered',
      );
    }, {
      scenarioName: 'artist_detail_progressive_shell',
    });
  });
});
