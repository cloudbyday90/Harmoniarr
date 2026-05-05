import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import {
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
let browserRuntime;
let runtimeUnavailableReason = null;

async function waitForHeading(page, name) {
  await page.getByRole('heading', { name }).waitFor();
}

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
      await page.goto(`${baseUrl}/bootstrap`, { waitUntil: 'networkidle' });
      await waitForHeading(page, 'Create the first admin account');

      await page.getByLabel('Username').fill('admin');
      await page.getByLabel('Password', { exact: true }).fill('BrowserPass123!');
      await page.getByLabel('Confirm password', { exact: true }).fill('BrowserPass123!');
      await page.getByRole('button', { name: 'Create bootstrap admin' }).click();

      await page.waitForURL(/\/app(?:\?.*)?$/);
      await page.getByText('Signed in as').waitFor();
      await page.locator('.session-username').filter({ hasText: 'admin' }).waitFor();

      await page.getByRole('link', { name: 'Configuration' }).click();
      await page.waitForURL(/\/app\/settings(?:\?.*)?(?:#.*)?$/);
      await waitForHeading(page, 'Configuration workspace');

      await page.getByRole('link', { name: 'Candidates' }).click();
      await page.waitForURL(/\/app\/review-queue(?:\?.*)?(?:#.*)?$/);
      await waitForHeading(page, 'Persisted slskd candidates');

      await page.getByRole('link', { name: 'Operations' }).click();
      await page.waitForURL(/\/app\/jobs(?:\?.*)?(?:#.*)?$/);
      await waitForHeading(page, 'Queued, active, and completed automation');

      await page.getByRole('link', { name: 'Backup & Restore' }).click();
      await page.waitForURL(/\/app\/recovery(?:\?.*)?(?:#.*)?$/);
      await waitForHeading(page, 'Backups, restore checks, and safe maintenance');

      await page.getByRole('button', { name: 'Create backup' }).click();
      await page.getByRole('link', { name: 'Download JSON' }).waitFor();
      await page.getByText('This backup passed the current restore checks and can be applied when you are ready.').waitFor();

      const applyRestoreButton = page.getByRole('button', { name: 'Apply restore' });
      assert.equal(await applyRestoreButton.isDisabled(), true);

      await page.getByLabel('I have reviewed this backup and understand that restore apply changes current state immediately.').check();
      assert.equal(await applyRestoreButton.isDisabled(), false);

      await page.getByRole('button', { name: 'Log out' }).click();
      await page.waitForURL(/\/login(?:\?.*)?$/);
      await waitForHeading(page, 'Log in to Harmoniarr');

      await page.getByLabel('Username or email').fill('admin');
      await page.getByLabel('Password', { exact: true }).fill('BrowserPass123!');
      await page.getByRole('button', { name: 'Log in' }).click();

      await page.waitForURL(/\/app(?:\?.*)?$/);
      await page.getByText('Signed in as').waitFor();
      await page.locator('.session-username').filter({ hasText: 'admin' }).waitFor();
    }, {
      scenarioName: 'operator_ui_smoke',
    });
  });
});