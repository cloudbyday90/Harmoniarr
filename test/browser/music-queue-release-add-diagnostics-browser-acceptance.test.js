/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import {
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import { seedReleaseAddDiagnosticsAcceptanceFixture } from '../../testing/browser/release-add-diagnostics-browser-fixtures.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { createUserThroughApi, loginUserThroughUi } from '../../testing/browser/user-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const integrationRuntimeConfig = resolveIntegrationTestRuntimeConfig();
const diagnosticsPath = '/api/v1/import-candidates/release-add-diagnostics';
const releaseTitle = 'Release Diagnostics Browser Album';
const artistName = 'Release Diagnostics Browser Artist';

function getDiagnosticsUrl(baseUrl, wantedReleaseId) {
  return `${baseUrl}/app/activity/diagnostics/library-adds?wantedReleaseId=${encodeURIComponent(wantedReleaseId)}`;
}

async function getSessionUser(page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/session', { credentials: 'same-origin' });
    const payload = await response.json();
    return payload.user;
  });
}

async function waitForDiagnosticsResponse(page, { status, wantedReleaseId }) {
  const response = await page.waitForResponse((candidate) => {
    const url = new URL(candidate.url());
    return candidate.request().method() === 'GET'
      && url.pathname === diagnosticsPath
      && url.searchParams.get('wantedReleaseId') === wantedReleaseId;
  });

  assert.equal(response.status(), status);
  return response;
}

async function navigateToDiagnostics(page, { baseUrl, status, wantedReleaseId }) {
  const response = waitForDiagnosticsResponse(page, { status, wantedReleaseId });
  await page.goto(getDiagnosticsUrl(baseUrl, wantedReleaseId), { waitUntil: 'domcontentloaded' });
  return response;
}

async function reloadDiagnostics(page, { status, wantedReleaseId }) {
  const response = waitForDiagnosticsResponse(page, { status, wantedReleaseId });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await response;
}

async function assertOwnerCanReloadDiagnostics({
  baseUrl,
  otherPrivateMarkers,
  page,
  wantedReleaseId,
}) {
  await navigateToDiagnostics(page, { baseUrl, status: 200, wantedReleaseId });
  await page.getByRole('heading', { name: 'Library-add details' }).waitFor();
  await page.getByText(`Recent safe library-add outcomes for ${releaseTitle} by ${artistName}.`).waitFor();
  await page.getByRole('heading', { name: 'Audio verification needs review' }).waitFor();
  await page.getByRole('link', { name: 'Open match diagnostics' }).first().waitFor();
  assert.equal(new URL(page.url()).searchParams.get('wantedReleaseId'), wantedReleaseId);
  assert.equal(await page.getByText('Import readiness').count(), 0);
  assert.equal(await page.locator('.hx-table').count(), 0);

  await reloadDiagnostics(page, { status: 200, wantedReleaseId });
  await page.getByRole('heading', { name: 'Audio verification needs review' }).waitFor();
  assert.doesNotMatch(await page.getByRole('main').innerText(), new RegExp(otherPrivateMarkers.join('|'), 'u'));
}

async function assertCopiedDiagnosticsAreUnavailable({
  baseUrl,
  page,
  privateMarkers,
  wantedReleaseId,
}) {
  const response = await navigateToDiagnostics(page, { baseUrl, status: 404, wantedReleaseId });
  const payload = await response.json();
  assert.equal(payload.error?.code, 'music_queue_release_not_found');
  const unavailableState = page.getByRole('status').filter({
    hasText: 'This Music Queue release is unavailable. Open your queue to continue.',
  });
  await unavailableState.getByRole('heading', { name: 'Release not available' }).waitFor();
  await unavailableState.getByText('This Music Queue release is unavailable. Open your queue to continue.').waitFor();
  const returnToMusicQueue = page.getByRole('link', { name: 'Open Music Queue' });
  assert.equal(await returnToMusicQueue.getAttribute('href'), '/app/music-queue');
  assert.equal(await page.getByText('Music Queue release not found').count(), 0);
  assert.equal(await page.getByText('No library-add result yet').count(), 0);
  assert.equal(await page.getByText('No library-add history yet').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Refresh' }).count(), 0);
  assert.equal(await page.getByRole('heading', { name: 'Audio verification needs review' }).count(), 0);
  assert.equal(await page.getByText('Import readiness').count(), 0);
  assert.equal(await page.locator('.hx-table').count(), 0);
  assert.doesNotMatch(await page.getByRole('main').innerText(), new RegExp(privateMarkers.join('|'), 'u'));
}

let browserRuntime;
let runtimeUnavailableReason = null;

suite('Music Queue release-scoped library-add diagnostics browser acceptance', () => {
  before(async () => {
    try {
      browserRuntime = await createBrowserSmokeRuntime({ config: integrationRuntimeConfig });
      runtimeUnavailableReason = null;
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) throw error;
      runtimeUnavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, { timeout: integrationRuntimeConfig.suiteSetupTimeoutMs });

  after(async () => {
    await browserRuntime?.cleanup();
  }, { timeout: integrationRuntimeConfig.suiteTeardownTimeoutMs });

  test('keeps copied release-add diagnostic URLs owner scoped across isolated administrator sessions', {
    timeout: integrationRuntimeConfig.scenarioTimeoutMs,
  }, async (t) => {
    if (runtimeUnavailableReason) {
      t.skip(runtimeUnavailableReason);
      return;
    }

    await browserRuntime.runScenario(async ({ baseUrl, browser, browserContext, getPoolFn, page }) => {
      const adminPageErrors = [];
      const operatorPageErrors = [];
      let operatorContext;

      page.on('pageerror', (error) => adminPageErrors.push(error.message));

      try {
        await bootstrapAdminThroughUi(page, { baseUrl });
        const adminUser = await getPoolFn().query(
          'SELECT id FROM app_users WHERE username = $1 LIMIT 1',
          ['admin'],
        );
        const operatorUser = await createUserThroughApi(page, {
          password: 'InitialPass123!',
          role: 'admin',
          username: 'release-diagnostics-operator',
        });
        const fixture = await seedReleaseAddDiagnosticsAcceptanceFixture({
          adminUserId: adminUser.rows[0].id,
          getPoolFn,
          operatorUserId: operatorUser.id,
        });
        const [adminSessionUser, persistedAdminRelease] = await Promise.all([
          getSessionUser(page),
          getPoolFn().query(
            'SELECT app_user_id FROM library_wanted_releases WHERE id = $1',
            [fixture.adminWantedReleaseId],
          ),
        ]);
        assert.equal(adminSessionUser?.id, adminUser.rows[0].id);
        assert.equal(persistedAdminRelease.rows[0]?.app_user_id, adminUser.rows[0].id);

        operatorContext = await browser.newContext({ serviceWorkers: 'block' });
        const operatorPage = await operatorContext.newPage();
        operatorPage.setDefaultTimeout(integrationRuntimeConfig.httpRequestTimeoutMs);
        operatorPage.on('pageerror', (error) => operatorPageErrors.push(error.message));
        await loginUserThroughUi(operatorPage, {
          baseUrl,
          initialPassword: 'InitialPass123!',
          readyPassword: 'ReadyPass123!',
          username: 'release-diagnostics-operator',
        });
        assert.equal((await getSessionUser(operatorPage))?.id, operatorUser.id);

        await assertOwnerCanReloadDiagnostics({
          baseUrl,
          otherPrivateMarkers: [fixture.privateMarkers[1], fixture.operatorWantedReleaseId],
          page,
          wantedReleaseId: fixture.adminWantedReleaseId,
        });
        await assertOwnerCanReloadDiagnostics({
          baseUrl,
          otherPrivateMarkers: [fixture.privateMarkers[0], fixture.adminWantedReleaseId],
          page: operatorPage,
          wantedReleaseId: fixture.operatorWantedReleaseId,
        });

        await assertCopiedDiagnosticsAreUnavailable({
          baseUrl,
          page,
          privateMarkers: [fixture.privateMarkers[0], fixture.privateMarkers[1], fixture.operatorWantedReleaseId],
          wantedReleaseId: fixture.operatorWantedReleaseId,
        });
        await assertCopiedDiagnosticsAreUnavailable({
          baseUrl,
          page: operatorPage,
          privateMarkers: [fixture.privateMarkers[0], fixture.privateMarkers[1], fixture.adminWantedReleaseId],
          wantedReleaseId: fixture.adminWantedReleaseId,
        });

        assert.deepEqual(adminPageErrors, [], `Unexpected admin page errors: ${adminPageErrors.join(' | ')}`);
        assert.deepEqual(operatorPageErrors, [], `Unexpected operator page errors: ${operatorPageErrors.join(' | ')}`);
      } finally {
        await operatorContext?.close().catch(() => {});
      }
    }, { scenarioName: 'music_queue_release_add_diagnostics_two_session_access' });
  });
});
