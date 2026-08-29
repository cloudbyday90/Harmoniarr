/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const systemOverviewRoutePattern = '**/api/v1/system/overview';

/**
 * A bounded, anonymous response for the app-shell heartbeat in browser
 * integration tests. Browser scenarios verify page workflows; the complete
 * system-overview API contract remains covered by server route tests.
 */
export const browserSystemOverviewFixture = Object.freeze({
  activeJobCount: 0,
  dependencies: Object.freeze([
    Object.freeze({ provider: 'media_tooling', status: 'healthy' }),
    Object.freeze({ provider: 'musicbrainz', status: 'healthy' }),
    Object.freeze({ provider: 'slskd', status: 'healthy' }),
  ]),
});

function buildBrowserSystemOverviewResponse() {
  return JSON.stringify(browserSystemOverviewFixture);
}

/**
 * Installs the deterministic app-shell heartbeat response before a scenario
 * creates its first page. This prevents unrelated browser journeys from
 * issuing live provider-health checks while preserving their role-based UI
 * assertions and the real server route's coverage elsewhere.
 *
 * Later, scenario-specific routes take precedence under Playwright's normal
 * last-registered routing order.
 *
 * @param {import('playwright').BrowserContext} browserContext
 * @returns {Promise<void>}
 */
export async function installBrowserSystemOverviewFixture(browserContext) {
  if (!browserContext || typeof browserContext.route !== 'function') {
    throw new TypeError('installBrowserSystemOverviewFixture requires a browser context with route()');
  }

  await browserContext.route(systemOverviewRoutePattern, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      body: buildBrowserSystemOverviewResponse(),
      contentType: 'application/json',
      headers: {
        'Cache-Control': 'no-store',
      },
      status: 200,
    });
  });
}
