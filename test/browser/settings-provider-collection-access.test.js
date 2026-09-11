/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import {
  createBrowserSmokeRuntime,
  isSkippableBrowserRuntimeError,
  toBrowserRuntimeUnavailableReason,
} from '../../testing/browser/playwright-smoke-runtime.js';
import { bootstrapAdminThroughUi } from '../../testing/browser/operator-browser-helpers.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
const sourceUrl = 'https://open.spotify.com/playlist/accessfixture';
const endpoint = '**/api/v1/providers/collection-access-check';
let runtime;
let unavailableReason;

function createCheck(overrides = {}) {
  return {
    schemaVersion: 1,
    provider: 'spotify',
    resourceType: 'playlist',
    authMode: 'oauth_user',
    quotaMode: 'unknown',
    outcome: 'verified',
    code: 'access_verified',
    pagesChecked: 2,
    entriesSeen: 100,
    hasMore: true,
    fullTraversal: false,
    multiPageObserved: true,
    snapshotCheck: 'verified',
    checkedAt: '2026-09-11T12:00:00Z',
    retryAfterSeconds: null,
    label: 'Collection pages verified',
    detail: 'Saved authorization can read the checked pages.',
    nextAction: 'Continue with collection review for this source.',
    ...overrides,
  };
}

async function openCheck(page, baseUrl) {
  await bootstrapAdminThroughUi(page, { baseUrl });
  await page.goto(`${baseUrl}/app/settings/connections`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Set up optional services' }).click();
  const panel = page.getByRole('region', { name: 'Collection access check' });
  await panel.getByRole('heading', { name: 'Collection access check' }).waitFor();
  return panel;
}

async function captureSafePanel(panel, name) {
  await mkdir('.tmp', { recursive: true });
  await panel.screenshot({
    mask: [panel.getByLabel('Playlist or artist URL')],
    path: `.tmp/provider-collection-access-${name}.png`,
    style: '.settings-save-bar, .hx-bottom-nav { visibility: hidden !important; }',
  });
}

suite('saved provider collection access browser verification', () => {
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

  test('explicit keyboard check uses saved access without submitting settings and presents bounded source coverage at each breakpoint', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) {
      t.skip(unavailableReason);
      return;
    }
    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      const pageErrors = [];
      page.on('pageerror', () => pageErrors.push('Unexpected browser error'));
      let checks = 0;
      let settingsWrites = 0;
      let releaseCheck;
      const pending = new Promise((resolve) => { releaseCheck = resolve; });
      await browserContext.route(endpoint, async (route) => {
        checks += 1;
        const request = route.request();
        assert.equal(request.method(), 'POST');
        assert.ok(request.postData() === JSON.stringify({ sourceUrl }), 'Only the supplied source is sent.');
        assert.ok(Boolean(request.headers()['x-csrf-token']), 'The explicit check includes CSRF protection.');
        await pending;
        await route.fulfill({ json: { ok: true, check: createCheck() } });
      });
      page.on('request', (request) => {
        if (new URL(request.url()).pathname === '/api/v1/settings' && request.method() === 'PUT') settingsWrites += 1;
      });
      const panel = await openCheck(page, baseUrl);
      const input = panel.getByLabel('Playlist or artist URL');
      const button = panel.getByRole('button', { name: 'Check saved provider access', exact: true });

      try {
        assert.equal(checks, 0);
        await input.fill(sourceUrl);
        assert.equal(checks, 0);
        await input.press('Tab');
        assert.equal(await button.evaluate((element) => element === globalThis.document.activeElement), true);
        await button.press('Enter');
        await panel.getByRole('status').getByText('Checking access to the supplied collection…').waitFor();
        assert.equal(await input.isEditable(), false);
        assert.equal(await panel.getByRole('button', { name: 'Checking saved provider access…' }).isDisabled(), true);
        assert.equal(await panel.getAttribute('aria-busy'), 'true');
        releaseCheck();
        await panel.getByRole('status').getByText('Collection pages verified').waitFor();
        assert.equal(checks, 1);
        assert.equal(settingsWrites, 0);
        assert.equal(await panel.getAttribute('aria-busy'), 'false');
        assert.equal(await button.evaluate((element) => element === globalThis.document.activeElement), true);
        await panel.getByText('Only the returned pages were verified. The full collection was not checked.').waitFor();
        await panel.getByText('Linked user authorization').waitFor();
        await panel.getByText('Observed across multiple pages').waitFor();
        assert.equal(await panel.locator('dt').filter({ hasText: /^Pages checked$/ }).locator('..').locator('dd').textContent(), '2');

        for (const width of [1280, 800, 390]) {
          for (const theme of ['light', 'dark']) {
            await page.setViewportSize({ width, height: 1000 });
            await page.evaluate((value) => globalThis.document.documentElement.setAttribute('data-theme', value), theme);
            await panel.scrollIntoViewIfNeeded();
            const hasOverflow = await panel.evaluate((element) => element.scrollWidth > element.clientWidth);
            assert.equal(hasOverflow, false, `Diagnostic fits the ${width}px ${theme} layout.`);
            if (width === 390) {
              const inputBox = await input.boundingBox();
              const buttonBox = await button.boundingBox();
              assert.ok(inputBox.height >= 44 && buttonBox.height >= 44, 'Mobile controls have 44px touch targets.');
            }
            await captureSafePanel(panel, `${width}-${theme}`);
          }
        }
        await input.fill('https://music.apple.com/us/playlist/fixture/pl.example');
        assert.equal(await panel.getByText('Collection pages verified', { exact: true }).count(), 0);
        assert.equal(checks, 1);
        assert.deepEqual(pageErrors, []);
      } catch (error) {
        releaseCheck();
        await captureSafePanel(panel, 'keyboard-failure').catch(() => {});
        throw error;
      }
    }, { scenarioName: 'settings_provider_collection_access' });
  });

  test('failed checks retain input, announce safe recovery, and distinguish a complete source from a changed collection', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    if (unavailableReason) {
      t.skip(unavailableReason);
      return;
    }
    await runtime.runScenario(async ({ baseUrl, browserContext, page }) => {
      let response = { status: 500, json: { error: { code: 'internal_error', message: 'private-provider-token-and-response' } } };
      await browserContext.route(endpoint, (route) => route.fulfill(response));
      const panel = await openCheck(page, baseUrl);
      const input = panel.getByLabel('Playlist or artist URL');
      const button = panel.getByRole('button', { name: 'Check saved provider access', exact: true });
      try {
        await input.fill(sourceUrl);
        await input.press('Enter');
        await panel.getByRole('alert').getByText('Provider access could not be checked. Check the saved connection settings and try again.').waitFor();
        assert.ok(await input.inputValue() === sourceUrl, 'The source remains available for retry.');
        assert.ok(!(await panel.textContent()).includes('private-provider'), 'Provider failure details are not rendered.');

        response = { status: 400, json: { error: { code: 'validation_error', message: 'private-source-error' } } };
        await button.click();
        await panel.getByRole('alert').getByText('Enter a supported Spotify or Apple Music playlist or artist URL, or a YouTube playlist URL.').waitFor();
        assert.equal(await input.getAttribute('aria-invalid'), 'true');
        assert.match(await input.getAttribute('aria-describedby'), /settings-collection-access-error/);

        response = { status: 429, json: { error: { code: 'rate_limit_exceeded', message: 'private-provider-error' } } };
        await button.click();
        await panel.getByRole('alert').getByText('Too many access checks. Wait a minute before trying again.').waitFor();
        assert.equal(await input.getAttribute('aria-invalid'), 'false');

        response = { status: 200, json: { ok: true, check: createCheck({
          provider: 'apple_music', resourceType: 'artist', authMode: 'developer_token', pagesChecked: 1,
          entriesSeen: 4, hasMore: false, fullTraversal: true, multiPageObserved: false, snapshotCheck: 'not_applicable',
        }) } };
        await button.click();
        await panel.getByRole('status').getByText('All collection pages checked for this source.').waitFor();
        await panel.getByText('Saved developer authorization').waitFor();
        await panel.getByText('Not demonstrated', { exact: true }).waitFor();

        response = { status: 200, json: { ok: true, check: createCheck({
          outcome: 'failed', label: 'Collection changed during the check',
          detail: 'The source changed between page reads.', snapshotCheck: 'failed',
          nextAction: 'Wait for edits to finish, then check this source again.', retryAfterSeconds: 30,
        }) } };
        await button.click();
        await panel.getByRole('alert').getByText('Collection changed during the check').waitFor();
        await panel.getByText('Collection access remains unverified.').waitFor();
        await panel.getByText('Wait at least 30 seconds before checking again.').waitFor();
        assert.equal(await panel.getByText('All collection pages checked for this source.').count(), 0);
        assert.ok(await input.inputValue() === sourceUrl, 'A failed provider check preserves the source.');
        await captureSafePanel(panel, 'failed-snapshot');
      } catch (error) {
        await captureSafePanel(panel, 'recovery-failure').catch(() => {});
        throw error;
      }
    }, { scenarioName: 'settings_provider_collection_access_recovery' });
  });
});
