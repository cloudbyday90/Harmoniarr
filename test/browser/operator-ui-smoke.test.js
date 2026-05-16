import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import {
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import {
  bootstrapAdminThroughUi,
  loginThroughUi,
  logoutThroughUi,
  waitForHeading,
} from '../../testing/browser/operator-browser-helpers.js';
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

  test('bootstrap, login, settings, review queue, operations, and recovery preview render through the real browser shell', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.getByRole('link', { name: 'Settings' }).click();
      await page.waitForURL(/\/app\/settings(?:\?.*)?(?:#.*)?$/);
      await waitForHeading(page, 'Settings');

      await page.getByRole('link', { name: 'Activity' }).click();
      await page.waitForURL(/\/app\/activity(?:\/operations)?(?:\?.*)?(?:#.*)?$/);
      await waitForHeading(page, 'Background Jobs');

      await page.getByRole('link', { name: 'Candidates' }).click();
      await page.waitForURL(/\/app\/activity\/candidates(?:\?.*)?(?:#.*)?$/);
      await waitForHeading(page, 'Download candidates');

      await page.getByRole('link', { name: 'Settings' }).click();
      await page.waitForURL(/\/app\/settings(?:\?.*)?(?:#.*)?$/);
      await page.getByRole('link', { name: 'Backup & Restore' }).click();
      await page.waitForURL(/\/app\/settings\/recovery(?:\?.*)?(?:#.*)?$/);
      await waitForHeading(page, 'Backups');

      await page.getByRole('button', { name: 'Create backup' }).click();
      await page.getByRole('link', { name: 'Download' }).waitFor();
      await page.getByText('This backup passed all checks and can be applied.').waitFor();

      const applyRestoreButton = page.getByRole('button', { name: 'Apply restore' });
      assert.equal(await applyRestoreButton.isDisabled(), true);

      await page.getByLabel("I've reviewed this backup and understand it will change current data immediately.").check();
      assert.equal(await applyRestoreButton.isDisabled(), false);

      await logoutThroughUi(page);
      await loginThroughUi(page, { baseUrl });
    }, {
      scenarioName: 'operator_ui_smoke',
    });
  });

  test('discover, artist detail, search, and import review render with deterministic metadata fixtures', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });

      await page.goto(`${baseUrl}/app/discover`, { waitUntil: 'networkidle' });
      await waitForHeading(page, 'Discover');
      await page.getByLabel('Search for an artist').fill('Boards of Canada');
      await page.getByRole('button', { name: 'Search' }).click();

      await page.getByRole('link', { name: 'Boards of Canada' }).waitFor();
      await page.getByRole('button', { name: 'Monitor Boards of Canada' }).click();

      await page.getByRole('heading', { name: 'Artists you might like' }).waitFor();
      await page.getByText('Autechre').waitFor();

      await page.getByRole('link', { name: 'Boards of Canada' }).click();
      await page.waitForURL(/\/app\/artists\/mb-artist-boards(?:\?.*)?$/);
      await page.getByRole('heading', { name: 'Boards of Canada' }).waitFor();
      await page.getByRole('heading', { name: 'Discography' }).waitFor();
      await page.getByRole('heading', { name: 'Related artists' }).waitFor();
      await page.getByText('Music Has the Right to Children').waitFor();

      await page.goto(`${baseUrl}/app/search`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: 'Search', exact: true }).waitFor();
      await page.getByLabel('Search for an artist or release').fill('Music Has the Right to Children');
      await page.getByRole('button', { name: 'Search' }).click();

      await page.getByRole('heading', { name: 'Artists' }).waitFor();
      await page.getByRole('heading', { name: 'Releases' }).waitFor();
      await page.getByText('Music Has the Right to Children').waitFor();

      const releaseArtwork = page.locator('img[alt="Music Has the Right to Children"]').first();
      await releaseArtwork.waitFor();
      assert.match(await releaseArtwork.getAttribute('src') ?? '', /^data:image\/svg\+xml;base64,/);

      await page.goto(`${baseUrl}/app/activity/candidates`, { waitUntil: 'networkidle' });
      await waitForHeading(page, 'Download candidates');
      await page.getByRole('heading', { name: 'Inspect selected candidate media' }).waitFor();
      await page.getByRole('heading', { name: 'Queue selected for download' }).waitFor();
      await page.getByRole('heading', { name: 'Move downloads to library' }).waitFor();
    }, {
      scenarioName: 'metadata_operator_ui_smoke',
    });
  });
});
