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
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailableReason;

suite('music request creation feedback', () => {
  before(async () => {
    try {
      runtime = await createBrowserSmokeRuntime({ config });
    } catch (error) {
      if (!isSkippableBrowserRuntimeError(error)) throw error;
      unavailableReason = toBrowserRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });

  after(async () => {
    await runtime?.cleanup();
  }, { timeout: config.suiteTeardownTimeoutMs });

  test('a failed submission retains its draft and a retry announces committed success', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) {
      t.skip(unavailableReason);
      return;
    }
    await runtime.runScenario(async ({ baseUrl, getPoolFn, page }) => {
      await bootstrapAdminThroughUi(page, { baseUrl });
      await page.goto(`${baseUrl}/app/requests`, { waitUntil: 'domcontentloaded' });
      const form = page.locator('form.rm-form');
      const submit = form.getByRole('button', { name: 'Submit request', exact: true });
      await form.getByLabel('Artist', { exact: true }).fill('Atomic Test Artist');
      await form.getByLabel('Release', { exact: true }).fill('Atomic Test Release');

      // This constraint is confined to the scenario's disposable database.
      await getPoolFn().query(`
        ALTER TABLE audit_events ADD CONSTRAINT test_reject_request_creation
        CHECK (event_type <> 'media_request_created')
      `);
      const failedResponse = page.waitForResponse((response) =>
        response.url().endsWith('/api/v1/library/media-requests')
        && response.request().method() === 'POST');
      await submit.click();
      assert.ok((await failedResponse).status() >= 400);
      await form.getByRole('alert').locator('.hx-pill').waitFor();
      assert.doesNotMatch(await form.getByRole('alert').innerText(), /test_reject_request_creation|INSERT INTO|audit_events/u);
      assert.equal(await form.getByLabel('Artist', { exact: true }).inputValue(), 'Atomic Test Artist');
      assert.equal(await form.getByLabel('Release', { exact: true }).inputValue(), 'Atomic Test Release');
      assert.equal((await getPoolFn().query('SELECT COUNT(*)::integer AS total FROM media_requests')).rows[0].total, 0);

      await getPoolFn().query('ALTER TABLE audit_events DROP CONSTRAINT test_reject_request_creation');
      const committedResponse = page.waitForResponse((response) =>
        response.url().endsWith('/api/v1/library/media-requests')
        && response.request().method() === 'POST');
      await submit.click();
      assert.equal((await committedResponse).status(), 201);
      await form.getByRole('status').getByText('Music request submitted and added to your request profile.', { exact: true }).waitFor();
      assert.equal(await form.getByRole('alert').innerText(), '');
      assert.equal(await form.getByLabel('Artist', { exact: true }).inputValue(), '');
      assert.equal((await getPoolFn().query('SELECT COUNT(*)::integer AS total FROM media_requests')).rows[0].total, 1);
      await page.goto('about:blank');
    }, { scenarioName: 'media_request_creation_feedback' });
  });
});
