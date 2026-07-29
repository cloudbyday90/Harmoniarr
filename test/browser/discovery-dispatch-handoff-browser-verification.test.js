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
import { installMetadataBrowserFixtures } from '../../testing/browser/metadata-browser-fixtures.js';
import { installWantedBrowserFixtures } from '../../testing/browser/wanted-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Discovery dispatch handoff browser verification', () => {
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

  test('admins can start discovery dispatch and inspect resulting Import Review candidates', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext);
      await installWantedBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/activity/wanted`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Wanted' }).waitFor();
      await page.getByRole('heading', { exact: true, name: 'Discovery dispatch' }).waitFor();
      await page.getByText('2 releases are ready for Soulseek search dispatch.', { exact: true }).waitFor();

      const runDiscoveryButton = page.getByRole('button', { name: 'Run discovery now' });
      await runDiscoveryButton.click();
      await page.getByText('3 releases are cooling down before the next automatic search.', { exact: true }).waitFor();
      await page.getByText('2 dispatched', { exact: false }).waitFor();
      await page.getByText('1 candidates', { exact: false }).waitFor();

      const discoveryRunRequests = await page.evaluate(() => globalThis.__harmoniarrDiscoveryRunRequests);
      assert.equal(discoveryRunRequests.length, 1);
      assert.equal(discoveryRunRequests[0].method, 'POST');
      assert.equal(discoveryRunRequests[0].path, '/api/v1/library/discovery-runs');
      assert.ok(
        typeof discoveryRunRequests[0].csrf === 'string' && discoveryRunRequests[0].csrf.length > 0,
        'manual discovery dispatch should include the browser CSRF token',
      );

      await page.goto(`${baseUrl}/app/activity/candidates?candidate=candidate-discovery-dispatch`, {
        waitUntil: 'domcontentloaded',
      });
      await page.getByRole('heading', { exact: true, name: 'Match diagnostics' }).waitFor();
      await page.getByText('View match and file evidence', { exact: true }).click();
      await page.getByText('healthy-slskd-peer', { exact: true }).first().waitFor();
      await page.getByText('/private/staging/Autechre/Amber', { exact: true }).first().waitFor();
      await page.getByText('01 Foil.flac', { exact: true }).waitFor();

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'discovery_dispatch_handoff_to_import_review',
    });
  });
});
