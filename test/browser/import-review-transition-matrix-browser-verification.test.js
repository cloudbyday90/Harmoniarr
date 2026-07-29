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
  readMetadataBrowserFixtureState,
} from '../../testing/browser/metadata-browser-fixtures.js';
import {
  buildImportReviewCandidate,
  openImportReviewMatchFinder,
  seedImportReviewCandidateWorkspace,
} from '../../testing/browser/import-review-browser-helpers.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

function getRecoveryPanel(page) {
  return page.locator('.import-candidate-recovery');
}

async function openCandidateInImportReview({
  baseUrl,
  browserContext,
  candidate,
  page,
}) {
  await installMetadataBrowserFixtures(browserContext);
  await bootstrapAdminThroughUi(page, { baseUrl });
  await seedImportReviewCandidateWorkspace(page, { candidate });
  await page.goto(`${baseUrl}/app/activity/candidates?candidate=${candidate.id}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('heading', { exact: true, name: 'Match diagnostics' }).waitFor();
  await page.getByRole('heading', { exact: true, name: 'Current state and recovery' }).waitFor();
  await openImportReviewMatchFinder(page);
}

async function assertCandidateStatus(page, statusLabel) {
  const recoveryPanel = getRecoveryPanel(page);
  await recoveryPanel.getByText(statusLabel, { exact: true }).first().waitFor();
}

async function assertActionStatusFocused(page, message) {
  const actionStatus = page.getByRole('status').filter({ hasText: message });
  await actionStatus.waitFor();
  await assertLocatorFocused(actionStatus, `${message} should receive focus`);
  await assertVisibleFocusOutline(actionStatus, `${message} focus ring should be visible`);
}

async function expandOtherMatchActions(page) {
  const disclosure = page.locator('.import-candidate-recovery__more');
  const isOpen = await disclosure.evaluate((element) => element.open);
  if (!isOpen) {
    await disclosure.getByText('Other match actions', { exact: true }).click();
  }
}

suite('Import Review review-state transition matrix browser verification', () => {
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

  test('admins can move a pending candidate through hold and select without losing detail context', {
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

      const candidate = buildImportReviewCandidate({
        id: 'candidate-matrix-hold-select',
        status: 'pending',
      });
      await openCandidateInImportReview({ baseUrl, browserContext, candidate, page });

      await page.getByText('1 matching result', { exact: true }).waitFor();
      await assertCandidateStatus(page, 'Available');

      await expandOtherMatchActions(page);
      const holdButton = page.getByRole('button', { name: 'Pause this match' });
      await holdButton.focus();
      await assertLocatorFocused(holdButton, 'Hold should be keyboard focusable before transition');
      await holdButton.press('Enter');

      await assertActionStatusFocused(page, 'Candidate held for review.');
      await assertCandidateStatus(page, 'Paused');
      await page.getByText('0 matching results', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Resume this match' }).waitFor();
      await expandOtherMatchActions(page);
      await page.getByRole('button', { name: 'Reopen for review' }).waitFor();
      await page.getByRole('button', { name: 'Do not use this match' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Pause this match' }).count(), 0);

      const selectButton = page.getByRole('button', { name: 'Resume this match' });
      await selectButton.focus();
      await selectButton.press('Enter');

      await assertActionStatusFocused(page, 'Match selected for download.');
      await assertCandidateStatus(page, 'Needs attention');
      await page.getByText('1 match selected', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Reopen for review' }).waitFor();
      await page.getByRole('button', { name: 'Do not use this match' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Resume this match' }).count(), 0);
      assert.equal(new URL(page.url()).searchParams.get('candidate'), candidate.id);

      const fixtureState = await readMetadataBrowserFixtureState(page);
      const persistedCandidate = fixtureState.importReviewCandidates.find(
        (item) => item.id === candidate.id,
      );
      assert.equal(persistedCandidate?.status, 'selected');

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_pending_hold_select_transition_matrix',
    });
  });

  test('admins can reject with confirmation and reopen the rejected candidate', {
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

      const candidate = buildImportReviewCandidate({
        id: 'candidate-matrix-reject-reopen',
        status: 'selected',
      });
      await openCandidateInImportReview({ baseUrl, browserContext, candidate, page });

      await page.getByText('0 matching results', { exact: true }).waitFor();
      await assertCandidateStatus(page, 'Needs attention');
      await page.getByText('1 match selected', { exact: true }).waitFor();

      await expandOtherMatchActions(page);
      const rejectButton = page.getByRole('button', { name: 'Do not use this match' });
      await rejectButton.focus();
      await rejectButton.press('Enter');

      const rejectDialog = page.getByRole('alertdialog', { name: 'Do not use this match?' });
      await rejectDialog.waitFor();
      const confirmButton = rejectDialog.getByRole('button', { name: 'Confirm' });
      await confirmButton.waitFor();
      assert.equal(await confirmButton.isDisabled(), true);

      await rejectDialog.getByLabel(
        'I understand this match will be removed from review and must be found again before it can be used.',
      ).check();
      assert.equal(await confirmButton.isEnabled(), true);
      await confirmButton.press('Enter');

      await assertActionStatusFocused(page, 'Candidate rejected.');
      await assertCandidateStatus(page, 'Rejected');
      await page.getByText('0 matching results', { exact: true }).waitFor();
      await page.getByText('Nothing waiting to download or add', { exact: true }).waitFor();
      const reopenButton = page.getByRole('button', { name: 'Try this match again' });
      await reopenButton.waitFor();
      assert.equal(await page.getByRole('button', { name: 'Do not use this match' }).count(), 0);

      await reopenButton.focus();
      await reopenButton.press('Enter');

      await assertActionStatusFocused(page, 'Candidate reopened for review.');
      await assertCandidateStatus(page, 'Available');
      await page.getByText('1 matching result', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Use this match' }).waitFor();
      await expandOtherMatchActions(page);
      await page.getByRole('button', { name: 'Pause this match' }).waitFor();
      await page.getByRole('button', { name: 'Do not use this match' }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Try this match again' }).count(), 0);
      assert.equal(new URL(page.url()).searchParams.get('candidate'), candidate.id);

      const fixtureState = await readMetadataBrowserFixtureState(page);
      const persistedCandidate = fixtureState.importReviewCandidates.find(
        (item) => item.id === candidate.id,
      );
      assert.equal(persistedCandidate?.status, 'pending');

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_selected_reject_reopen_transition_matrix',
    });
  });
});
