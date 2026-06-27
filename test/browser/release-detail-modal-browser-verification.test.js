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
import {
  installMetadataBrowserFixtures,
  markBoardsOfCanadaAddedInMetadataBrowserFixture,
} from '../../testing/browser/metadata-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import {
  assertFocusWithin,
  assertLocatorFocused,
  assertTabFocusContained,
  assertVisibleFocusOutline,
} from '../../testing/browser/keyboard-accessibility-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

async function openMusicHasTheRightToChildrenDialog({ baseUrl, page, pageErrors = [] }) {
  await page.goto(`${baseUrl}/app/artists/mb-artist-boards`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { exact: true, name: 'Boards of Canada' }).waitFor();
  await page.getByRole('heading', { exact: true, name: 'Albums' }).waitFor();

  const albumsList = page.getByRole('list', { name: /^albums$/iu });
  const albumCards = albumsList.locator('.hx-media-card__link-area');
  const releaseCard = albumsList.getByRole('button', {
    name: 'View details for Music Has the Right to Children',
  });
  await releaseCard.waitFor();
  await albumCards.nth(0).focus();
  await albumCards.nth(0).press('ArrowRight');
  await assertLocatorFocused(releaseCard, 'Release card should be focused before opening detail');
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Release detail' });
  try {
    await dialog.waitFor();
  } catch (error) {
    assert.fail(`Release Detail dialog did not open. Page errors: ${pageErrors.join(' | ') || 'none'}. ${error.message}`);
  }
  return { dialog, releaseCard };
}

suite('Release Detail modal browser verification', () => {
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

  test('Release Detail modal contains focus, switches editions, and exposes operator track overrides', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });

      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await markBoardsOfCanadaAddedInMetadataBrowserFixture(page);

      let { dialog, releaseCard } = await openMusicHasTheRightToChildrenDialog({ baseUrl, page, pageErrors });
      const closeButton = dialog.getByRole('button', { name: 'Close' });
      await assertLocatorFocused(closeButton, 'Release Detail should move initial focus to the close button');
      await assertVisibleFocusOutline(closeButton, 'Release Detail close button should have a visible focus ring');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      await assertLocatorFocused(releaseCard, 'Escape should restore focus to the release card that opened the modal');

      ({ dialog, releaseCard } = await openMusicHasTheRightToChildrenDialog({ baseUrl, page, pageErrors }));
      await dialog.getByText('Roygbiv').waitFor();
      await dialog.getByRole('button', { name: 'Request', exact: true }).waitFor();

      await assertFocusWithin(dialog, 'Focus should start inside the modal dialog');
      await assertTabFocusContained(page, dialog, { steps: 8 });
      await assertTabFocusContained(page, dialog, { backwards: true, steps: 4 });

      const gbEdition = dialog.getByRole('button', {
        name: 'Switch to edition, GB, 1998, 3 tracks',
      });
      const usEdition = dialog.getByRole('button', {
        name: 'Switch to edition, US, 1998, 4 tracks',
      });
      await gbEdition.waitFor();
      await usEdition.waitFor();
      assert.equal(await gbEdition.getAttribute('aria-pressed'), 'true');
      assert.equal(await usEdition.getAttribute('aria-pressed'), 'false');

      await usEdition.focus();
      await assertVisibleFocusOutline(usEdition, 'Edition switch buttons should have a visible focus ring');
      await usEdition.press('Enter');
      await dialog.getByText('Left Side Drive').waitFor();
      await dialog.getByText('4 tracks').waitFor();
      assert.equal(await usEdition.getAttribute('aria-pressed'), 'true');

      const editionActions = dialog.getByRole('button', { name: 'Edition actions' });
      await editionActions.click();
      await dialog.getByRole('button', { name: 'Set as Default Edition' }).waitFor();
      await assertFocusWithin(dialog, 'Opening edition actions should keep focus in the modal');

      const overrideSelect = dialog.getByLabel('Desired state for Left Side Drive');
      await overrideSelect.selectOption('desired');
      assert.equal(await overrideSelect.inputValue(), 'desired');
      await dialog.getByText('Track overrides are saved with Artist Policy.').waitFor();

      await dialog.getByRole('button', { name: 'Close' }).click();
      await dialog.waitFor({ state: 'hidden' });
      await assertLocatorFocused(releaseCard, 'Close should restore focus to the release card that opened the modal');

      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'release_detail_modal_browser_verification',
    });
  });
});
