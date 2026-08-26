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
import { installWantedBrowserFixtures } from '../../testing/browser/wanted-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import {
  assertLocatorFocused,
  assertRovingGridMovement,
  getItemControlTabindexes,
} from '../../testing/browser/keyboard-accessibility-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const cardCellSelector = '.hx-media-card__link-area';
const cardActionSelector = '.hx-media-card__actions :is(a[href], button, input, select, textarea, [tabindex])';

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Missing release-card browser keyboard roving coverage', () => {
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

  test('Missing release grid exposes roving focus and keeps only active-card actions tabbable', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installWantedBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/missing`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { exact: true, name: 'Missing music' }).waitFor();
      await page.getByRole('heading', { name: 'Selected releases' }).waitFor();
      await page.getByText('Search stopped').waitFor();

      const missingList = page.getByRole('list', { name: 'Selected releases not in library' });
      const cells = missingList.locator(cardCellSelector);
      const actionControls = missingList.locator(cardActionSelector);

      await assertRovingGridMovement({
        cellSelector: cardCellSelector,
        expectedCount: 4,
        list: missingList,
        page,
      });

      await page.keyboard.press('Tab');
      await assertLocatorFocused(
        actionControls.first(),
        'Tab should move from the active Missing release card to its Search action',
      );

      await cells.nth(0).focus();
      await cells.nth(0).press('ArrowRight');
      await assertLocatorFocused(cells.nth(1), 'ArrowRight should focus the next Missing release card');

      await cells.nth(2).focus();

      const controlTabindexes = await getItemControlTabindexes(missingList, {
        cellSelector: cardCellSelector,
        controlSelector: cardActionSelector,
      });

      assert.deepEqual(controlTabindexes[0], ['-1', '-1', '-1']);
      assert.ok(
        controlTabindexes[2].length >= 4,
        'the active recovery card should expose Search again, Search, Music Queue, and manual-selection controls',
      );
      assert.deepEqual(
        controlTabindexes[2].map((value) => value ?? null),
        Array.from({ length: controlTabindexes[2].length }, () => null),
      );
    }, {
      scenarioName: 'missing_release_card_grid_keyboard_roving',
    });
  });

  test('Missing Music confirms and submits manual inclusion without implying a search', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installWantedBrowserFixtures(browserContext);
      let manualInclusionRequest = null;
      await browserContext.route(
        '**/api/v1/metadata/artists/metadata-artist-autechre/operator/release-groups/metadata-rg-amber/manual-inclusion',
        async (route) => {
          manualInclusionRequest = {
            body: route.request().postDataJSON(),
            method: route.request().method(),
          };
          await route.fulfill({
            body: JSON.stringify({
              alreadyIncluded: false,
              manualInclusion: {
                metadataArtistId: 'metadata-artist-autechre',
                metadataReleaseGroupId: 'metadata-rg-amber',
                metadataReleaseId: 'metadata-release-amber',
                selectionState: 'selected',
              },
              ok: true,
              reconciliation: { run: { id: 'run-manual-inclusion', status: 'pending' } },
              snapshot: { id: 'snapshot-manual-inclusion', snapshotRevision: 1 },
            }),
            contentType: 'application/json',
            status: 202,
          });
        },
      );
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/missing`, { waitUntil: 'domcontentloaded' });
      const action = page.getByRole('button', { name: 'Keep Amber selected manually' });
      await action.waitFor();
      await action.click();

      const dialog = page.getByRole('dialog', { name: 'Keep this release selected manually?' });
      await dialog.waitFor();
      await assertLocatorFocused(
        dialog.getByRole('button', { name: 'Cancel' }),
        'the manual inclusion dialog should focus the least-destructive action',
      );
      await dialog.getByText('Harmoniarr will queue reconciliation; it will not start a search.').waitFor();
      await dialog.getByRole('button', { name: 'Keep selected manually' }).click();

      await page.getByText('Manual inclusion').first().waitFor();
      assert.deepEqual(manualInclusionRequest, {
        body: { metadataReleaseId: 'metadata-release-amber' },
        method: 'POST',
      });
    }, {
      scenarioName: 'missing_music_manual_inclusion',
    });
  });

  test('Missing Music names the search consequence and opens the matching Music Queue release', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installWantedBrowserFixtures(browserContext);
      let searchRequest = null;
      await browserContext.route('**/api/v1/library/media-requests', async (route) => {
        searchRequest = {
          body: route.request().postDataJSON(),
          method: route.request().method(),
        };
        await route.fulfill({
          body: JSON.stringify({
            mediaRequest: { id: 'request-amber' },
            ok: true,
          }),
          contentType: 'application/json',
          status: 201,
        });
      });
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/missing`, { waitUntil: 'domcontentloaded' });
      await page.getByText(
        'Start a search, then choose a match in Music Queue if Harmoniarr cannot decide automatically.',
      ).first().waitFor();

      await page.getByRole('button', {
        name: 'Start a search for Autechre — Amber',
      }).click();
      const dialog = page.getByRole('dialog', { name: 'Search for this release?' });
      await dialog.waitFor();
      assert.equal(await dialog.getByLabel('Request for').count(), 0);
      const descriptionId = await dialog.getAttribute('aria-describedby');
      assert.ok(descriptionId);
      const description = page.locator(`#${descriptionId}`);
      await description.waitFor();
      assert.equal(
        await description.textContent(),
        'Harmoniarr will add this release to Music Queue, where it will be searched using your active settings.',
      );

      await Promise.all([
        page.waitForURL(/\/app\/music-queue\/wanted-amber$/),
        dialog.getByRole('button', { name: 'Start search' }).click(),
      ]);
      assert.deepEqual(searchRequest, {
        body: {
          artistName: 'Autechre',
          expectedReleaseDate: null,
          musicbrainzReleaseId: 'mb-release-amber',
          releaseGroupId: 'mb-rg-amber',
          releaseTitle: 'Amber',
          requestKind: 'release',
        },
        method: 'POST',
      });
    }, {
      scenarioName: 'missing_music_decision_workspace',
    });
  });
});
