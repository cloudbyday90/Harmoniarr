/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  browserOnboardingFixture,
  installBrowserOnboardingFixture,
} from '../../testing/browser/onboarding-browser-fixture.js';
import {
  browserSystemOverviewFixture,
  installBrowserSystemOverviewFixture,
} from '../../testing/browser/system-overview-browser-fixture.js';

async function installFixture(installFixtureFn) {
  let pattern = null;
  let handler = null;
  const browserContext = {
    async route(nextPattern, nextHandler) {
      pattern = nextPattern;
      handler = nextHandler;
    },
  };

  await installFixtureFn(browserContext);

  return { handler, pattern };
}

test('browser system overview fixture fulfills the app-shell GET with bounded health data', async () => {
  const { handler, pattern } = await installFixture(installBrowserSystemOverviewFixture);
  const fulfilled = [];

  await handler({
    async fulfill(response) {
      fulfilled.push(response);
    },
    request() {
      return { method: () => 'GET' };
    },
  });

  assert.equal(pattern, '**/api/v1/system/overview');
  assert.deepEqual(fulfilled, [{
    body: JSON.stringify(browserSystemOverviewFixture),
    contentType: 'application/json',
    headers: {
      'Cache-Control': 'no-store',
    },
    status: 200,
  }]);
});

test('browser system overview fixture falls back for methods outside the read contract', async () => {
  const { handler } = await installFixture(installBrowserSystemOverviewFixture);
  let fallbackCount = 0;

  await handler({
    async fallback() {
      fallbackCount += 1;
    },
    request() {
      return { method: () => 'POST' };
    },
  });

  assert.equal(fallbackCount, 1);
});

test('browser system overview fixture requires a routable browser context', async () => {
  await assert.rejects(
    installBrowserSystemOverviewFixture(null),
    /requires a browser context with route\(\)/,
  );
});

test('browser onboarding fixture fulfills bootstrap navigation with bounded setup data', async () => {
  const { handler, pattern } = await installFixture(installBrowserOnboardingFixture);
  const fulfilled = [];

  await handler({
    async fulfill(response) {
      fulfilled.push(response);
    },
    request() {
      return { method: () => 'GET' };
    },
  });

  assert.equal(pattern, '**/api/v1/system/onboarding');
  assert.deepEqual(fulfilled, [{
    body: JSON.stringify(browserOnboardingFixture),
    contentType: 'application/json',
    headers: {
      'Cache-Control': 'no-store',
    },
    status: 200,
  }]);
});

test('browser onboarding fixture falls back for methods outside the read contract', async () => {
  const { handler } = await installFixture(installBrowserOnboardingFixture);
  let fallbackCount = 0;

  await handler({
    async fallback() {
      fallbackCount += 1;
    },
    request() {
      return { method: () => 'POST' };
    },
  });

  assert.equal(fallbackCount, 1);
});

test('browser onboarding fixture requires a routable browser context', async () => {
  await assert.rejects(
    installBrowserOnboardingFixture(null),
    /requires a browser context with route\(\)/,
  );
});
