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
} from '../../testing/browser/metadata-browser-fixtures.js';
import {
  buildImportReviewCandidate,
  seedImportReviewCandidateWorkspace,
} from '../../testing/browser/import-review-browser-helpers.js';
import {
  bootstrapAdminThroughUi,
  logoutThroughUi,
} from '../../testing/browser/operator-browser-helpers.js';
import {
  createRequesterThroughApi,
  createUserThroughApi,
  loginRequesterThroughUi,
  loginUserThroughUi,
} from '../../testing/browser/user-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();

let browserRuntime;
let runtimeUnavailableReason = null;

function getImportCandidateRequestPath(request) {
  let requestUrl;
  try {
    requestUrl = new URL(request.url());
  } catch {
    return null;
  }

  if (!requestUrl.pathname.startsWith('/api/v1/import-candidates')) {
    return null;
  }

  return `${request.method()} ${requestUrl.pathname}`;
}

function isTransitionRequestPath(path) {
  return /^POST \/api\/v1\/import-candidates\/[^/]+\/(?:select|hold|reject|reopen)$/u.test(path);
}

async function createAndLoginReadOnlyUser({
  baseUrl,
  page,
  role,
  username,
}) {
  const initialPassword = 'InitialPass123!';
  const readyPassword = 'ReadyPass123!';

  if (role === 'requester') {
    await createRequesterThroughApi(page, {
      password: initialPassword,
      username,
    });
  } else {
    await createUserThroughApi(page, {
      password: initialPassword,
      role,
      username,
    });
  }

  await logoutThroughUi(page);

  if (role === 'requester') {
    await loginRequesterThroughUi(page, {
      baseUrl,
      initialPassword,
      readyPassword,
      username,
    });
    return;
  }

  await loginUserThroughUi(page, {
    baseUrl,
    initialPassword,
    readyPassword,
    username,
  });
}

suite('Import Review requester/non-admin read-only access browser verification', () => {
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

  test('requesters are redirected away from Import Review before candidate APIs load', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      const importCandidateRequests = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });
      page.on('request', (request) => {
        const path = getImportCandidateRequestPath(request);
        if (path) {
          importCandidateRequests.push(path);
        }
      });

      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await createAndLoginReadOnlyUser({
        baseUrl,
        page,
        role: 'requester',
        username: 'readonly-requester',
      });

      await page.goto(`${baseUrl}/app/activity/candidates?candidate=candidate-readonly`, {
        waitUntil: 'domcontentloaded',
      });
      await page.getByRole('heading', { exact: true, name: 'Home' }).waitFor();
      assert.equal(new URL(page.url()).pathname, '/app');
      assert.equal(await page.getByRole('heading', {
        exact: true,
        name: 'Match diagnostics',
      }).count(), 0);
      assert.deepEqual(importCandidateRequests, []);

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_requester_redirects_before_candidate_api_load',
    });
  });

  test('operators can inspect Import Review candidate detail without management controls', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      const transitionRequests = [];
      page.on('pageerror', (error) => {
        pageErrors.push(error.message);
      });
      page.on('request', (request) => {
        const path = getImportCandidateRequestPath(request);
        if (path && isTransitionRequestPath(path)) {
          transitionRequests.push(path);
        }
      });

      await installMetadataBrowserFixtures(browserContext);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await createAndLoginReadOnlyUser({
        baseUrl,
        page,
        role: 'operator',
        username: 'readonly-operator',
      });

      const candidate = buildImportReviewCandidate({
        id: 'candidate-readonly-operator',
        status: 'pending',
      });
      await seedImportReviewCandidateWorkspace(page, { candidate });

      await page.goto(`${baseUrl}/app/activity/candidates?candidate=${candidate.id}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.getByRole('heading', { exact: true, name: 'Match diagnostics' }).waitFor();
      await page.getByText(
        'You can inspect candidates assigned to your account. Admin-only controls remain available for review state changes and background runs.',
        { exact: true },
      ).waitFor();
      await page.getByText('1 matching candidates', { exact: true }).waitFor();
      await page.getByRole('heading', { exact: true, name: 'Files and actions' }).waitFor();
      await page.getByText('Pending', { exact: true }).first().waitFor();
      await page.getByText('remote-peer', { exact: true }).first().waitFor();
      await page.getByText('/private/staging/Boards of Canada/Music Has the Right to Children', {
        exact: true,
      }).first().waitFor();
      await page.getByText('private-track.flac', { exact: true }).first().waitFor();

      assert.equal(await page.getByLabel('Review note').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Select' }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Hold' }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Reject' }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Reopen' }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Apply filters' }).count(), 0);
      assert.equal(await page.getByRole('heading', { name: 'Operator runway' }).count(), 0);
      assert.deepEqual(transitionRequests, []);

      assert.deepEqual(pageErrors, [], `Unexpected page errors: ${pageErrors.join(' | ')}`);
      await page.goto('about:blank', { waitUntil: 'load' });
    }, {
      scenarioName: 'import_review_operator_read_only_candidate_detail',
    });
  });
});
