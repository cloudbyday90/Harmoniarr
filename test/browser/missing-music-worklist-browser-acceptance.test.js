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

function buildDecisionPayload({
  accountStatus = 'active',
  q = '',
  state = 'action',
} = {}) {
  return {
    checkedAt: '2026-08-26T16:30:00.000Z',
    decisions: [
      {
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
    ],
    filters: {
      accountStatus,
      q,
      requestedForUserId: '',
      state,
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
      { accountStatus: 'disabled', id: 'listener-2', username: 'Morgan' },
    ],
  };
}

async function installMissingMusicDecisionFixture(browserContext, requests) {
  await browserContext.route('**/api/v1/missing-music/decisions**', async (route) => {
    const requestUrl = new URL(route.request().url());
    const query = Object.fromEntries(requestUrl.searchParams.entries());
    requests.push(query);

    await route.fulfill({
      body: JSON.stringify({
        ok: true,
        ...buildDecisionPayload(query),
      }),
      contentType: 'application/json',
      status: 200,
    });
  });
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Missing Music worklist browser acceptance', () => {
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

  test('groups understandable filters and names the affected user and next step', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const requests = [];
      await installMissingMusicDecisionFixture(browserContext, requests);
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/missing`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Missing Music' }).waitFor();

      const filters = page.getByRole('group', { name: 'Filter releases' });
      await filters.getByLabel('User').waitFor();
      await filters.getByLabel('Account status').waitFor();
      await filters.getByLabel('Work state').waitFor();
      await filters.getByLabel('Search releases').waitFor();

      const decisions = page.getByRole('list', { name: 'Missing Music release decisions' });
      await decisions.getByRole('heading', { name: 'Amber' }).waitFor();
      const firstDecision = decisions.getByRole('listitem').first();
      const facts = firstDecision.locator('dl');
      assert.equal(await facts.locator('dt').nth(0).textContent(), 'For');
      assert.equal(await facts.locator('dd').nth(0).textContent(), 'Jamie');
      assert.equal(
        await firstDecision.locator('.missing-music-worklist__next-step').textContent(),
        'Next step: Review matches',
      );
      const status = page.getByRole('status');
      assert.equal(
        (await status.textContent()).trim(),
        'Showing 1 release for all active accounts.',
      );
      assert.deepEqual(requests[0], {
        accountStatus: 'active',
        limit: '50',
        offset: '0',
        scope: 'all',
        state: 'action',
      });

      await filters.getByLabel('Account status').selectOption('disabled');
      await page.waitForFunction(() => (
        globalThis.document.querySelector('.missing-music-worklist__status')?.textContent?.trim()
        === 'Showing 1 release for disabled account history.'
      ));
      assert.deepEqual(requests.at(-1), {
        accountStatus: 'disabled',
        limit: '50',
        offset: '0',
        scope: 'all',
        state: 'action',
      });
    }, {
      scenarioName: 'missing_music_worklist_filters_and_next_step',
    });
  });
});
