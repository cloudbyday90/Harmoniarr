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
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

async function installDecisionFixture(browserContext, requests) {
  await browserContext.route('**/api/v1/missing-music/decisions/**', async (route) => {
    requests.push(new URL(route.request().url()).pathname);
    await route.fulfill({
      body: JSON.stringify({
        checkedAt: '2026-08-26T16:30:00.000Z',
        decision: {
          decisionId: 'wanted-amber',
          expectedTrackCount: 10,
          matchedTrackCount: 0,
          release: {
            artistName: 'Autechre',
            releaseDate: '1994-11-07',
            releaseGroupType: 'Album',
            title: 'Amber',
          },
          requestedFor: {
            accountStatus: 'active',
            id: 'listener-1',
            username: 'Jamie',
          },
          status: {
            label: 'Choose a match',
            message: 'Harmoniarr found options that need a selection.',
            nextAction: 'review_matches',
            tone: 'warning',
          },
        },
        matchChoices: [],
        ok: true,
        permissions: {
          canSelectMatch: false,
          canStartDownload: false,
          canViewDownloader: false,
          isReadOnly: false,
        },
        scope: 'all',
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Missing Music legacy redirect browser acceptance', () => {
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

  test('saved Music Queue release links land on the canonical scoped decision URL', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const requests = [];
      await installDecisionFixture(browserContext, requests);
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/music-queue/wanted-amber?state=action#current-status`, {
        waitUntil: 'domcontentloaded',
      });

      const heading = page.getByRole('heading', { exact: true, level: 2, name: 'Amber' });
      await heading.waitFor();
      const location = new URL(page.url());
      assert.equal(location.pathname, '/app/missing/wanted-amber');
      assert.deepEqual([...location.searchParams.entries()], [['state', 'action']]);
      assert.equal(location.hash, '#current-status');
      assert.ok(requests.includes('/api/v1/missing-music/decisions/wanted-amber'));

      await browserContext.unrouteAll({ behavior: 'ignoreErrors' });
    }, {
      scenarioName: 'missing_music_legacy_release_redirect',
    });
  });
});
