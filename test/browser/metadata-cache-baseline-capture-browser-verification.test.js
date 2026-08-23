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

suite('Metadata cache baseline capture browser coverage', () => {
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

  test('an administrator explicitly copies, compares, and receives a bounded paired-sample reading', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await browserContext.addInitScript(() => {
        Object.defineProperty(globalThis.navigator, 'clipboard', {
          configurable: true,
          value: {
            writeText: async (text) => {
              globalThis.__harmoniarrCopiedBaseline = text;
            },
          },
        });
      });
      const cacheSnapshots = [
        {
          namespaces: [{
            cacheNamespace: 'musicbrainz.related_artists',
            cacheStoreErrors: { read: 0, write: 0 },
            lookups: { cold: 2, fresh: 5, stale: 3 },
            providerPayload: 'private-id',
            refreshes: {
              background: { failed: 0, inFlight: 0, succeeded: 1 },
              foreground: { failed: 0, inFlight: 0, succeeded: 1 },
            },
          }],
          observedSinceAt: '2026-08-22T12:00:00.000Z',
          providerCredential: 'private-credential',
          updatedAt: '2026-08-22T12:04:00.000Z',
        },
        {
          namespaces: [{
            cacheNamespace: 'musicbrainz.related_artists',
            cacheStoreErrors: { read: 1, write: 0 },
            lookups: { cold: 2, fresh: 8, stale: 5 },
            refreshes: {
              background: { failed: 0, inFlight: 0, succeeded: 1 },
              foreground: { failed: 1, inFlight: 0, succeeded: 2 },
            },
          }],
          observedSinceAt: '2026-08-22T12:00:00.000Z',
          updatedAt: '2026-08-22T12:05:00.000Z',
        },
      ];
      let cacheSnapshotIndex = 0;

      await browserContext.route('**/api/v1/metadata/cache-observability', async (route) => {
        await route.fulfill({
          body: JSON.stringify({
            cache: cacheSnapshots[Math.min(cacheSnapshotIndex++, cacheSnapshots.length - 1)],
            ok: true,
          }),
          contentType: 'application/json',
          status: 200,
        });
      });

      await page.goto(`${baseUrl}/app/settings/library-browser`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Artist Detail cache baseline' }).waitFor();
      await page.getByRole('button', { exact: true, name: 'Load diagnostics' }).click();
      await page.getByRole('button', { exact: true, name: 'Copy baseline summary' }).waitFor();
      await page.getByRole('button', { exact: true, name: 'Copy baseline summary' }).click();
      await page.getByRole('status').getByText('Baseline summary copied. Save it only in an approved operator record.').waitFor();
      await page.getByRole('button', { exact: true, name: 'Mark comparison start' }).click();
      await page.getByText('Comparison start marked. Refresh diagnostics after active use to compare this process window.').waitFor();
      await page.getByRole('button', { exact: true, name: 'Refresh diagnostics' }).click();
      await page.getByRole('heading', { exact: true, name: 'Paired sample comparison' }).waitFor();
      await page.getByRole('status').getByText('Cache-store errors observed').waitFor();
      await page.getByRole('status').getByText('Inspect the affected cache namespace and database configuration before changing cache policy.').waitFor();
      await page.getByRole('cell', { exact: true, name: '3 / 2 / 0' }).waitFor();
      await page.getByRole('cell', { exact: true, name: '2 completed, 1 failed' }).waitFor();

      const copiedBaseline = await page.evaluate(() => globalThis.__harmoniarrCopiedBaseline);
      assert.match(copiedBaseline, /Scope: process-local aggregate; not fleet telemetry\./);
      assert.match(copiedBaseline, /musicbrainz\.related_artists/);
      assert.doesNotMatch(copiedBaseline, /private-id|private-credential/);
    }, {
      scenarioName: 'metadata_cache_baseline_capture',
    });
  });
});
