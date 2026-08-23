import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import {
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import {
  bootstrapAdminThroughUi,
  dismissSetupModeIfPresent,
  loginThroughUi,
  navigateWithinApp,
  logoutThroughUi,
} from '../../testing/browser/operator-browser-helpers.js';
import { openImportReviewRunHistory } from '../../testing/browser/import-review-browser-helpers.js';
import { installMetadataBrowserFixtures } from '../../testing/browser/metadata-browser-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
let browserRuntime;
let runtimeUnavailableReason = null;

suite('browser operator workflow smoke coverage', () => {
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

  test('Home leaves Music Queue loading and release work to the dedicated page', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      let musicQueueRequestCount = 0;
      await browserContext.route(/\/api\/v1\/acquisition\/releases(?:\?.*)?$/u, async (route) => {
        musicQueueRequestCount += 1;
        await route.fulfill({
          body: JSON.stringify({
            checkedAt: null,
            ok: true,
            pagination: { total: 0 },
            releases: [],
            summary: { counts: {}, total: 0 },
          }),
          contentType: 'application/json',
          status: 200,
        });
      });

      await bootstrapAdminThroughUi(page, { baseUrl });
      await dismissSetupModeIfPresent(page);
      await page.locator('.operator-home').waitFor();
      await page.evaluate(() => new Promise((resolve) => {
        globalThis.requestAnimationFrame(() => resolve());
      }));
      assert.equal(musicQueueRequestCount, 0);
      assert.equal(await page.locator('.operator-home').getByRole('heading', { name: 'Music Queue' }).count(), 0);

      const musicQueueRequest = page.waitForRequest((request) => (
        new URL(request.url()).pathname === '/api/v1/acquisition/releases'
      ));
      await navigateWithinApp(page, {
        heading: 'Music Queue',
        linkName: 'Music Queue',
        urlPattern: /\/app\/music-queue(?:\?.*)?(?:#.*)?$/,
      });
      await musicQueueRequest;
      assert.equal(musicQueueRequestCount, 1);
    }, {
      scenarioName: 'home_music_queue_boundary',
    });
  });

  test('bootstrap, login, settings, review queue, operations, and recovery preview render through the real browser shell', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      await dismissSetupModeIfPresent(page);

      await navigateWithinApp(page, {
        heading: 'Settings',
        linkName: 'Settings',
        urlPattern: /\/app\/settings(?:\?.*)?(?:#.*)?$/,
      });

      await navigateWithinApp(page, {
        heading: 'Activity timeline',
        linkName: 'Activity',
        urlPattern: /\/app\/activity(?:\/feed)?(?:\?.*)?(?:#.*)?$/,
      });
      await page.getByText('Advanced diagnostics', { exact: true }).click();
      await navigateWithinApp(page, {
        heading: 'Match diagnostics',
        linkName: 'Match diagnostics',
        urlPattern: /\/app\/activity\/diagnostics\/matches(?:\?.*)?(?:#.*)?$/,
      });

      await navigateWithinApp(page, {
        linkName: 'Settings',
        urlPattern: /\/app\/settings(?:\?.*)?(?:#.*)?$/,
      });
      await page.getByRole('button', { name: 'More settings' }).click();
      await navigateWithinApp(page, {
        heading: 'Recovery status',
        linkName: 'Backup & restore',
        urlPattern: /\/app\/settings\/recovery(?:\?.*)?(?:#.*)?$/,
      });

      await page.getByRole('button', { name: 'Create backup' }).click();
      await page.getByRole('button', { name: 'Review restore' }).click();
      await page.getByRole('button', { name: 'Show file actions' }).click();
      await page.getByRole('link', { name: 'Download backup' }).waitFor();
      await page.getByText('This backup passed all checks and can be applied.').waitFor();

      const applyRestoreButton = page.getByRole('button', { name: 'Apply restore' });
      assert.equal(await applyRestoreButton.isDisabled(), true);

      await page.getByLabel('I reviewed this backup and understand it will change current data immediately.').check();
      assert.equal(await applyRestoreButton.isDisabled(), false);

      await logoutThroughUi(page);
      await loginThroughUi(page, { baseUrl });
    }, {
      scenarioName: 'operator_ui_smoke',
    });
  });

  test('discover add, home projection, artist detail draft save, search, and import review render with deterministic metadata fixtures', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await dismissSetupModeIfPresent(page);

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

      await page.getByRole('heading', { name: 'Recommended artists' }).waitFor();
      await page.getByText('Autechre').waitFor();

      await navigateWithinApp(page, {
        heading: 'Home',
        linkName: 'Home',
        urlPattern: /\/app(?:\?.*)?(?:#.*)?$/,
      });
      await page.getByRole('heading', { name: 'Monitored Artists' }).waitFor();
      const monitoredArtistsRegion = page.locator('ul[aria-label="Monitored artists"]');
      await monitoredArtistsRegion.getByText('Boards of Canada').waitFor();
      await page.goto(`${baseUrl}/app/artists/mb-artist-boards?name=Boards%20of%20Canada`, { waitUntil: 'domcontentloaded' });
      await page.waitForURL(/\/app\/artists\/mb-artist-boards(?:\?.*)?$/);
      await page.getByRole('heading', { name: 'Boards of Canada' }).waitFor();
      await page.getByRole('heading', { name: 'Artist Policy' }).waitFor();
      await page.getByRole('heading', { name: 'Discography' }).waitFor();
      await page.getByRole('heading', { name: 'Related artists' }).waitFor();
      await page.getByText('Music Has the Right to Children').waitFor();
      await page.getByRole('button', { name: 'View details for Music Has the Right to Children' }).click();
      const releaseDetailDialog = page.getByRole('dialog', { name: 'Release detail' });
      await releaseDetailDialog.getByText('Roygbiv').waitFor();
      await releaseDetailDialog.getByLabel('Desired state for Roygbiv').selectOption('suppressed');
      await releaseDetailDialog.getByText('Track overrides are saved with Artist Policy.').waitFor();
      await releaseDetailDialog.getByRole('button', { name: 'Close' }).click();
      await page.getByText('1 track override').waitFor();
      await page.getByLabel('Selection state for Geogaddi').selectOption('unselected');
      await page.getByText('Unsaved changes').waitFor();
      await page.getByRole('button', { name: 'Save policy' }).click();
      await page.getByText('Reconciliation queued').waitFor();
      await page.getByText('Manual exclusion').waitFor();

      await navigateWithinApp(page, {
        heading: 'Home',
        linkName: 'Home',
        urlPattern: /\/app(?:\?.*)?(?:#.*)?$/,
      });
      await page.getByRole('heading', { name: 'Monitored Artists' }).waitFor();
      await page.getByText('Reconciliation queued').waitFor();

      await page.goto(`${baseUrl}/app/search`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('heading', { name: 'Search', exact: true }).waitFor();
      await page.getByLabel('Search for an artist or release').fill('Music Has the Right to Children');
      await page.getByRole('button', { name: 'Search' }).click();

      await page.getByRole('heading', { name: 'Artists' }).waitFor();
      await page.getByRole('heading', { name: 'Releases' }).waitFor();
      await page.getByText('Music Has the Right to Children').waitFor();

      const releaseArtwork = page.locator('img[alt="Music Has the Right to Children"]').first();
      await releaseArtwork.waitFor();
      assert.match(await releaseArtwork.getAttribute('src') ?? '', /^data:image\/svg\+xml;base64,/);

      await navigateWithinApp(page, {
        heading: 'Activity timeline',
        linkName: 'Activity',
        urlPattern: /\/app\/activity(?:\/feed)?(?:\?.*)?(?:#.*)?$/,
      });
      await page.getByText('Advanced diagnostics', { exact: true }).click();
      await navigateWithinApp(page, {
        heading: 'Match diagnostics',
        linkName: 'Match diagnostics',
        urlPattern: /\/app\/activity\/diagnostics\/matches(?:\?.*)?(?:#.*)?$/,
      });
      const runHistoryDisclosure = page.locator('details.import-review-runway');
      await runHistoryDisclosure.waitFor();
      assert.equal(await runHistoryDisclosure.evaluate((element) => element.open), false);
      await openImportReviewRunHistory(page);
      await page.getByRole('heading', { name: 'Check selected matches' }).waitFor();
      await page.getByRole('heading', { name: 'Send selected matches to downloads' }).waitFor();
      await page.getByRole('heading', { name: 'Add downloads to library' }).waitFor();
    }, {
      scenarioName: 'metadata_operator_ui_smoke',
    });
  });
});
