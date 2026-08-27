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
import {
  bootstrapAdminThroughUi,
  logoutThroughUi,
} from '../../testing/browser/operator-browser-helpers.js';
import {
  createRequesterThroughApi,
  loginRequesterThroughUi,
} from '../../testing/browser/user-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

function buildAdministratorWorklistPayload() {
  return {
    checkedAt: '2026-08-27T16:00:00.000Z',
    decisions: [],
    filters: {
      accountStatus: 'active',
      q: '',
      requestedForUserId: '',
      state: 'action',
    },
    page: {
      limit: 50,
      offset: 0,
      sourceLimitReached: false,
      total: 0,
    },
    scope: 'all',
    users: [
      { accountStatus: 'active', id: 'listener-1', username: 'Jamie' },
    ],
  };
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Missing Music legacy route scope browser acceptance', () => {
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

  test('canonicalizes an administrator legacy worklist link without making its URL user filter authoritative', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const decisionRequests = [];
      await browserContext.route('**/api/v1/missing-music/decisions**', async (route) => {
        const requestUrl = new URL(route.request().url());
        decisionRequests.push(requestUrl);
        await route.fulfill({
          body: JSON.stringify({ ok: true, ...buildAdministratorWorklistPayload() }),
          contentType: 'application/json',
          status: 200,
        });
      });

      await bootstrapAdminThroughUi(page, { baseUrl });
      await page.goto(
        `${baseUrl}/app/acquisition?requestedForUserId=listener-1&state=downloading#release-decisions`,
        { waitUntil: 'domcontentloaded' },
      );

      await page.waitForFunction(() => {
        const location = new URL(globalThis.location.href);
        return location.pathname === '/app/missing'
          && location.searchParams.get('requestedForUserId') === 'listener-1'
          && location.searchParams.get('state') === 'downloading'
          && location.hash === '#release-decisions';
      });
      const primaryNavigation = page.locator('.hx-sidebar');
      await page.getByRole('heading', { exact: true, level: 1, name: 'Missing Music' }).waitFor();
      await page.getByLabel('User').waitFor();
      assert.equal(await primaryNavigation.getByRole('link', { name: 'Acquisition', exact: true }).count(), 0);
      assert.equal(await primaryNavigation.getByRole('link', { name: 'Music Queue', exact: true }).count(), 0);
      assert.equal(decisionRequests.length, 1);
      assert.equal(decisionRequests[0].searchParams.get('requestedForUserId'), null);
      assert.equal(decisionRequests[0].searchParams.get('scope'), 'all');
    }, { scenarioName: 'missing_music_administrator_legacy_worklist_scope' });
  });

  test('keeps a requester on their own Missing Music scope after legacy worklist and release links', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const decisionRequests = [];
      const downloaderRequests = [];
      page.on('request', (request) => {
        const requestUrl = new URL(request.url());
        if (requestUrl.pathname.startsWith('/api/v1/missing-music/decisions/')) {
          decisionRequests.push(requestUrl);
        }
        if (requestUrl.pathname === '/api/v1/downloader/queue') {
          downloaderRequests.push(requestUrl);
        }
      });

      await bootstrapAdminThroughUi(page, { baseUrl });
      await createRequesterThroughApi(page, {
        password: 'InitialPass123!',
        username: 'legacy-scope-requester',
      });
      await logoutThroughUi(page);
      await loginRequesterThroughUi(page, {
        baseUrl,
        initialPassword: 'InitialPass123!',
        readyPassword: 'ReadyPass123!',
        username: 'legacy-scope-requester',
      });

      await page.goto(`${baseUrl}/app/acquisition?requestedForUserId=admin-1`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, level: 1, name: 'Missing Music' }).waitFor();
      assert.equal(await page.getByLabel('User').count(), 0);

      await browserContext.route('**/api/v1/missing-music/decisions/not-owned', async (route) => {
        await route.fulfill({
          body: JSON.stringify({
            error: {
              code: 'missing_music_decision_not_found',
              message: 'Missing Music release was not found',
            },
          }),
          contentType: 'application/json',
          status: 404,
        });
      });

      await page.goto(
        `${baseUrl}/app/music-queue/not-owned?requestedForUserId=admin-1#current-status`,
        { waitUntil: 'domcontentloaded' },
      );
      await page.waitForFunction(() => {
        const location = new URL(globalThis.location.href);
        return location.pathname === '/app/missing/not-owned'
          && location.searchParams.get('requestedForUserId') === 'admin-1'
          && location.hash === '#current-status';
      });
      await page.getByText('The requested release is unavailable or you do not have access to it.').waitFor();
      assert.equal(decisionRequests.length, 1);
      assert.equal(decisionRequests[0].pathname, '/api/v1/missing-music/decisions/not-owned');
      assert.equal(decisionRequests[0].search, '');

      await page.goto(`${baseUrl}/app/acquisition/downloader`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Home' }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/app');
      assert.deepEqual(downloaderRequests, []);
    }, { scenarioName: 'missing_music_requester_legacy_scope' });
  });
});
