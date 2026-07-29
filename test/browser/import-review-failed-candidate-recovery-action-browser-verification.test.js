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
  assertLocatorFocused,
  assertVisibleFocusOutline,
} from '../../testing/browser/keyboard-accessibility-helpers.js';
import {
  installMetadataBrowserFixtures,
  queueMetadataImportReviewTransitionFailure,
} from '../../testing/browser/metadata-browser-fixtures.js';
import { seedFailedImportReviewWorkspace } from '../../testing/browser/import-review-browser-helpers.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

async function openFailedCandidateInImportReview({ baseUrl, browserContext, page }) {
  await installMetadataBrowserFixtures(browserContext);
  await bootstrapAdminThroughUi(page, { baseUrl });
  await seedFailedImportReviewWorkspace(page);
  await page.goto(`${baseUrl}/app/activity/candidates?candidate=candidate-private`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('heading', { exact: true, name: 'Match diagnostics' }).waitFor();
  await page.getByRole('heading', { exact: true, name: 'Current state and recovery' }).waitFor();
}

suite('Import Review failed-candidate recovery action browser verification', () => {
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

  test('admins can reopen a failed candidate and continue from the pending action state', {
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

      await openFailedCandidateInImportReview({ baseUrl, browserContext, page });

      await page.getByText('0 matching candidates', { exact: true }).waitFor();
      await page.getByRole('heading', { exact: true, name: 'This match needs a retry' }).waitFor();
      const reopenButton = page.getByRole('button', { name: 'Try this match again' });
      await reopenButton.focus();
      await assertLocatorFocused(reopenButton, 'Reopen should be keyboard focusable before recovery');
      await assertVisibleFocusOutline(reopenButton, 'Reopen focus ring should be visible before recovery');
      await reopenButton.press('Enter');

      const actionStatus = page.getByRole('status').filter({
        hasText: 'Candidate reopened for review.',
      });
      await actionStatus.waitFor();
      await assertLocatorFocused(actionStatus, 'Successful recovery should move focus to the status message');
      await assertVisibleFocusOutline(actionStatus, 'Recovery status focus ring should be visible');
      await page.getByText('1 matching candidates', { exact: true }).waitFor();
      await page.getByText('Available', { exact: true }).first().waitFor();
      await page.getByRole('button', { name: 'Use this match' }).waitFor();
      await page.getByText('Other match actions', { exact: true }).click();
      await page.getByRole('button', { name: 'Pause this match' }).waitFor();
      await page.getByRole('button', { name: 'Do not use this match' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Try this match again' }).count(), 0);
      assert.equal(new URL(page.url()).searchParams.get('candidate'), 'candidate-private');

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_failed_candidate_reopen_success',
    });
  });

  test('admins see retryable feedback when reopening a failed candidate is rejected', {
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

      await openFailedCandidateInImportReview({ baseUrl, browserContext, page });
      await queueMetadataImportReviewTransitionFailure(page, {
        action: 'reopen',
        importCandidateId: 'candidate-private',
        message: 'Recovery is temporarily locked. Try again after the current import run finishes.',
        status: 409,
      });

      const reopenButton = page.getByRole('button', { name: 'Try this match again' });
      await reopenButton.focus();
      await assertLocatorFocused(reopenButton, 'Reopen should be keyboard focusable before failed recovery');
      await reopenButton.press('Enter');

      const alert = page.getByRole('alert').filter({
        hasText: 'Recovery is temporarily locked. Try again after the current import run finishes.',
      });
      await alert.waitFor();
      await page.getByRole('heading', { exact: true, name: 'This match needs a retry' }).waitFor();
      await page.getByText('0 matching candidates', { exact: true }).waitFor();
      await reopenButton.waitFor();
      await assertLocatorFocused(reopenButton, 'Failed recovery should leave the retry action focused');
      assert.equal(await page.getByRole('status').filter({
        hasText: 'Candidate reopened for review.',
      }).count(), 0);

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_failed_candidate_reopen_failure',
    });
  });
});
