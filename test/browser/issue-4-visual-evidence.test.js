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
import { installLibraryBrowserFixtures } from '../../testing/browser/library-browser-fixtures.js';
import {
  installMetadataBrowserFixtures,
  markBoardsOfCanadaAddedInMetadataBrowserFixture,
} from '../../testing/browser/metadata-browser-fixtures.js';
import {
  bootstrapAdminThroughUi,
  logoutThroughUi,
  navigateWithinApp,
} from '../../testing/browser/operator-browser-helpers.js';
import {
  createBrowserVisualEvidenceRecorder,
  stabilizeVisualEvidencePage,
} from '../../testing/browser/visual-evidence.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
let browserRuntime;
let runtimeUnavailableReason = null;

async function createRequesterThroughApi(page, {
  password,
  username,
} = {}) {
  const result = await page.evaluate(async ({ requesterPassword, requesterUsername }) => {
    const encodedName = 'harmoniarr_csrf=';
    const csrfToken = globalThis.document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(encodedName))
      ?.slice(encodedName.length)
      ?? '';
    const response = await fetch('/api/v1/users', {
      body: JSON.stringify({
        password: requesterPassword,
        role: 'requester',
        username: requesterUsername,
      }),
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      method: 'POST',
    });

    return {
      payload: await response.json(),
      status: response.status,
    };
  }, {
    requesterPassword: password,
    requesterUsername: username,
  });

  assert.equal(result.status, 201);
  assert.equal(result.payload?.user?.role, 'requester');
  return result.payload.user;
}

async function addBoardsOfCanadaFromDiscover(page) {
  await navigateWithinApp(page, {
    heading: 'Discover',
    linkName: 'Discover',
    urlPattern: /\/app\/discover(?:\?.*)?(?:#.*)?$/,
  });
  await page.getByLabel('Search for an artist').fill('Boards of Canada');
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByRole('link', { name: 'Boards of Canada' }).waitFor();
  await page.getByRole('button', { name: 'Add Boards of Canada' }).click();
  const addArtistDialog = page.getByRole('dialog', { name: 'Boards of Canada' });
  await addArtistDialog.waitFor();
  await addArtistDialog.getByRole('button', { name: 'Add artist', exact: true }).click();
  await page.getByRole('heading', { name: 'Artists you might like' }).waitFor();
}

async function loginRequesterThroughUi(page, {
  baseUrl,
  beforeReadyNavigation = null,
  initialPassword,
  readyPassword,
  username,
} = {}) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'load' });
  await page.getByRole('heading', { name: 'Log in to Harmoniarr' }).waitFor();
  await page.getByLabel('Username or email').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(initialPassword);
  await page.getByRole('button', { name: 'Log in' }).click();

  await page.waitForURL(/\/app\/account-security(?:\?.*)?$/);
  await page.getByRole('heading', { name: 'My account' }).waitFor();
  await page.getByText('Your password must be updated before you can continue.').waitFor();
  const result = await page.evaluate(async ({ currentPassword, newPassword }) => {
    const encodedName = 'harmoniarr_csrf=';
    const csrfToken = globalThis.document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(encodedName))
      ?.slice(encodedName.length)
      ?? '';
    const response = await fetch('/api/v1/auth/change-password', {
      body: JSON.stringify({ currentPassword, newPassword }),
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      method: 'POST',
    });

    return {
      payload: await response.json(),
      status: response.status,
    };
  }, {
    currentPassword: initialPassword,
    newPassword: readyPassword,
  });

  assert.equal(result.status, 200);
  assert.equal(result.payload?.user?.mustChangePassword, false);

  if (typeof beforeReadyNavigation === 'function') {
    await beforeReadyNavigation(page);
  }

  await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { exact: true, name: 'Home' }).waitFor();
}

suite('Issue #4 browser visual evidence', () => {
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

  test('captures visual evidence for media grids, recommendations, requester Home, and mobile navigation', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installLibraryBrowserFixtures(browserContext);
      await installMetadataBrowserFixtures(browserContext);
      await stabilizeVisualEvidencePage(page);

      const evidence = createBrowserVisualEvidenceRecorder({
        scenarioName: 'issue-4-media-surfaces',
      });

      await bootstrapAdminThroughUi(page, { baseUrl });
      await createRequesterThroughApi(page, {
        password: 'RequesterPass123!',
        username: 'listener',
      });

      await page.goto(`${baseUrl}/app/library`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Library' }).waitFor();
      await page.getByRole('radio', { name: 'Grid' }).waitFor();
      await page.getByText("Tomorrow's Harvest").waitFor();
      await evidence.capture(page, {
        description: 'Library artwork grid with dynamic release cards and filter controls.',
        name: 'library-grid',
        surface: 'library-grid',
      });

      await page.getByRole('radio', { name: 'List' }).check();
      await page.getByRole('list', { name: 'Library releases' }).getByText('Tri Repetae').waitFor();
      await evidence.capture(page, {
        description: 'Library list mode after changing persisted display preference.',
        name: 'library-list',
        surface: 'library-list',
      });

      await page.getByRole('heading', { name: 'Needs Attention' }).waitFor();
      await page.getByRole('button', { name: 'Review duplicates' }).click();
      const needsAttention = page.getByLabel('Needs Attention');
      await needsAttention.getByText('Tri Repetae').waitFor();
      await needsAttention.getByRole('link', { name: 'Review files' }).waitFor();
      await evidence.capture(page, {
        description: 'Needs Attention partial and duplicate action cards.',
        name: 'needs-attention-actions',
        surface: 'needs-attention',
      });

      await addBoardsOfCanadaFromDiscover(page);
      await markBoardsOfCanadaAddedInMetadataBrowserFixture(page);
      await page.getByText('Autechre').waitFor();
      await page.getByText('Tycho').waitFor();
      await evidence.capture(page, {
        description: 'Discover recommendation graph after monitoring an artist.',
        name: 'discover-recommendations',
        surface: 'discover-recommendations',
      });

      await logoutThroughUi(page);
      await loginRequesterThroughUi(page, {
        baseUrl,
        beforeReadyNavigation: markBoardsOfCanadaAddedInMetadataBrowserFixture,
        initialPassword: 'RequesterPass123!',
        readyPassword: 'RequesterReady123!',
        username: 'listener',
      });
      await page.getByRole('heading', { exact: true, name: 'Home' }).waitFor();
      await page.getByText('Artists you\'re monitoring and music you care about.').waitFor();
      const monitoredArtistsRegion = page.locator('section[aria-label="Monitored artists"]');
      await monitoredArtistsRegion.getByText('Boards of Canada').waitFor();
      await monitoredArtistsRegion.getByRole('link', { name: 'Find more artists' }).waitFor();
      await evidence.capture(page, {
        description: 'Requester Home populated with monitored artist artwork cards and the Discover tail card.',
        name: 'requester-home',
        surface: 'requester-home',
      });

      await page.setViewportSize({ height: 844, width: 390 });
      await page.getByLabel('Mobile navigation').waitFor();
      await page.getByRole('button', { name: 'Open menu' }).waitFor();
      await evidence.capture(page, {
        description: 'Requester mobile bottom navigation at phone viewport.',
        name: 'mobile-bottom-nav',
        surface: 'mobile-navigation',
      });

      await page.getByRole('button', { name: 'Open menu' }).click();
      await page.getByRole('button', { name: 'Close menu' }).waitFor();
      await page.locator('.hx-sidebar.is-open').waitFor();
      await evidence.capture(page, {
        description: 'Requester mobile drawer navigation opened from the topbar.',
        name: 'mobile-drawer-nav',
        surface: 'mobile-navigation',
      });

      const manifest = await evidence.writeManifest();
      assert.equal(manifest.captureCount, 7);
    }, {
      scenarioName: 'issue_4_visual_evidence_browser',
    });
  });
});
