/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const onboardingRoutePattern = '**/api/v1/system/onboarding';

/**
 * A bounded, anonymous first-run summary for browser integration tests.
 * Browser scenarios can pass through onboarding while they prepare a page;
 * the complete live route contract remains covered by server route tests.
 */
export const browserOnboardingFixture = Object.freeze({
  checkedAt: '2026-01-01T00:00:00.000Z',
  nextAction: null,
  steps: Object.freeze([]),
  summary: Object.freeze({
    completeStepCount: 0,
    issueCount: 0,
    message: 'Browser test setup is ready.',
    status: 'complete',
    totalStepCount: 0,
  }),
});

function buildBrowserOnboardingResponse() {
  return JSON.stringify(browserOnboardingFixture);
}

/**
 * Installs the deterministic first-run summary before a scenario creates its
 * first page. This prevents bootstrap navigation from starting live provider
 * health checks that are unrelated to the page workflow under test.
 *
 * Later, scenario-specific routes take precedence under Playwright's normal
 * last-registered routing order.
 *
 * @param {import('playwright').BrowserContext} browserContext
 * @returns {Promise<void>}
 */
export async function installBrowserOnboardingFixture(browserContext) {
  if (!browserContext || typeof browserContext.route !== 'function') {
    throw new TypeError('installBrowserOnboardingFixture requires a browser context with route()');
  }

  await browserContext.route(onboardingRoutePattern, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      body: buildBrowserOnboardingResponse(),
      contentType: 'application/json',
      headers: {
        'Cache-Control': 'no-store',
      },
      status: 200,
    });
  });
}
