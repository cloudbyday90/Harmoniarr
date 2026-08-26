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

function buildDecision() {
  return {
    decisionId: 'wanted-amber',
    expectedTrackCount: 10,
    lastReconciledAt: '2026-08-26T16:00:00.000Z',
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
  };
}

function buildWorklistPayload() {
  return {
    checkedAt: '2026-08-26T16:30:00.000Z',
    decisions: [buildDecision()],
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
      total: 1,
    },
    scope: 'all',
    users: [
      { accountStatus: 'active', id: 'listener-1', username: 'Jamie' },
    ],
  };
}

async function installMissingMusicFixture(browserContext, requests) {
  await browserContext.route('**/api/v1/missing-music/decisions**', async (route) => {
    const requestUrl = new URL(route.request().url());
    requests.push(requestUrl.pathname);
    const detailPath = '/api/v1/missing-music/decisions/wanted-amber';
    const payload = requestUrl.pathname === detailPath
      ? {
        checkedAt: '2026-08-26T16:31:00.000Z',
        decision: buildDecision(),
        permissions: { isReadOnly: false },
        scope: 'all',
      }
      : buildWorklistPayload();

    await route.fulfill({
      body: JSON.stringify({ ok: true, ...payload }),
      contentType: 'application/json',
      status: 200,
    });
  });
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Missing Music decision detail browser acceptance', () => {
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

  test('opens a server-authorized release-status detail with a clear return path', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const requests = [];
      await installMissingMusicFixture(browserContext, requests);
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(baseUrl + '/app/missing', { waitUntil: 'domcontentloaded' });
      await page.getByRole('link', { name: 'Open status details for Autechre — Amber' }).click();

      const heading = page.getByRole('heading', { exact: true, level: 2, name: 'Amber' });
      await heading.waitFor();
      assert.equal(new URL(page.url()).pathname, '/app/missing/wanted-amber');
      assert.equal(await heading.evaluate((element) => globalThis.document.activeElement === element), true);
      const inspector = page.locator('.missing-music-inspector');
      await inspector.getByRole('heading', { exact: true, level: 3, name: 'Current status' }).waitFor();
      await inspector.getByText('Jamie', { exact: true }).waitFor();
      await inspector.getByText('Next step:', { exact: false }).waitFor();
      assert.ok(requests.includes('/api/v1/missing-music/decisions/wanted-amber'));

      await page.getByRole('link', { name: 'Back to release decisions' }).click();
      await page.getByRole('heading', { exact: true, level: 1, name: 'Missing Music' }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/app/missing');
    }, {
      scenarioName: 'missing_music_decision_detail_navigation',
    });
  });
});
