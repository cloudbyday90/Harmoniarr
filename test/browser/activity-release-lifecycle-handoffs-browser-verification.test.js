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

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Activity release lifecycle handoff browser verification', () => {
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

  test('release milestones remain concise and point to the right next surface', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(error.message));
      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.route(/\/api\/v1\/activity\/feed(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            checkedAt: '2026-07-26T02:00:00.000Z',
            events: [{
              id: 'match-selected',
              entityArtist: 'Autechre',
              entityId: 'wanted-1',
              entityTitle: 'Amber',
              entityType: 'wanted_release',
              eventType: 'music_queue_match_selected',
              extraPayload: { selectionMode: 'automatic', wantedReleaseId: 'wanted-1' },
              occurredAt: '2026-07-26T01:59:00.000Z',
            }, {
              id: 'audio-warning',
              entityArtist: 'Autechre',
              entityId: 'wanted-1',
              entityTitle: 'Amber',
              entityType: 'wanted_release',
              eventType: 'music_queue_audio_warning',
              extraPayload: { wantedReleaseId: 'wanted-1', warningCount: 1 },
              occurredAt: '2026-07-26T01:58:00.000Z',
            }, {
              id: 'audio-failed',
              entityArtist: 'Autechre',
              entityId: 'wanted-2',
              entityTitle: 'Tri Repetae',
              entityType: 'wanted_release',
              eventType: 'music_queue_audio_check_failed',
              extraPayload: { wantedReleaseId: 'wanted-2', inspectionUnavailableCount: 2 },
              occurredAt: '2026-07-26T01:57:00.000Z',
            }, {
              id: 'library-added',
              entityArtist: 'Autechre',
              entityId: 'candidate-1',
              entityTitle: 'Amber',
              entityType: 'import_candidate',
              eventType: 'release_added',
              extraPayload: null,
              occurredAt: '2026-07-26T01:56:00.000Z',
            }, {
              id: 'request-ready',
              entityArtist: 'Autechre',
              entityId: 'request-1',
              entityTitle: 'Amber',
              entityType: 'media_request',
              eventType: 'request_fulfilled',
              extraPayload: { requestedForUserId: 'admin', sourceMediaRequestId: 'request-1' },
              occurredAt: '2026-07-26T01:55:00.000Z',
            }],
            ok: true,
            total: 5,
          }),
        });
      });

      await page.goto(`${baseUrl}/app/activity/feed`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Recent activity' }).waitFor();

      const selected = page.getByRole('listitem').filter({ hasText: 'Match selected: Amber by Autechre' });
      await selected.getByRole('link', { name: 'Open Music Queue' }).waitFor();
      const warning = page.getByRole('listitem').filter({ hasText: 'Audio check needs review: Amber by Autechre' });
      await warning.getByRole('link', { name: 'Review quality choice' }).waitFor();
      const unavailable = page.getByRole('listitem').filter({ hasText: 'Audio check could not run: Tri Repetae by Autechre' });
      await unavailable.getByRole('link', { name: 'Check connections' }).waitFor();
      const added = page.getByRole('listitem').filter({ hasText: 'Amber by Autechre added to library' });
      await added.getByRole('link', { name: 'Open Library' }).waitFor();
      const request = page.getByRole('listitem').filter({ hasText: 'Amber by Autechre added to library' });
      await request.getByRole('link', { name: 'Open request' }).waitFor();

      await page.getByRole('button', { name: 'Needs attention' }).click();
      await warning.waitFor();
      await unavailable.waitFor();
      await selected.waitFor({ state: 'hidden' });
      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
    }, { scenarioName: 'activity_release_lifecycle_handoffs' });
  });
});
