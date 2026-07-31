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

/**
 * Makes the provider-health reads deterministic for Music Queue browser
 * scenarios without changing the application's authorization or settings API.
 *
 * @param {import('playwright').BrowserContext} browserContext
 * @returns {Promise<void>}
 */
export async function installConfiguredMusicQueueProviderFixtures(browserContext) {
  await browserContext.route('**/api/v1/system/overview', async (route) => {
    await route.fulfill({
      body: JSON.stringify({ dependencies: [{ provider: 'slskd', status: 'healthy' }] }),
      contentType: 'application/json',
    });
  });

  await browserContext.route('**/api/v1/settings', async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.secretStatus ??= {};
    payload.secretStatus.slskd = {
      ...(payload.secretStatus.slskd ?? {}),
      providerMode: 'external',
      providerModeState: 'configured',
    };

    await route.fulfill({
      body: JSON.stringify(payload),
      contentType: 'application/json',
      response,
    });
  });
}

/**
 * Installs the scoped list, direct-detail, and Activity reads used by the
 * shared-discovery browser journey. A copied ID intentionally receives the
 * same generic 404 contract as the production scoped service.
 *
 * @param {import('playwright').BrowserContext} browserContext
 * @param {{ activityEvents?: Array<object>, release?: object, releaseAfterSearchAgain?: object, releaseSequence?: Array<object>, searchAgainResponse?: object }} options
 * @returns {Promise<{getReleaseReadCount: () => number, getSearchAgainRequestCount: () => number}>}
 */
export async function installScopedMusicQueueReadModelFixtures(browserContext, {
  activityEvents = [],
  release = null,
  releaseAfterSearchAgain = null,
  releaseSequence = null,
  searchAgainResponse = null,
} = {}) {
  const releases = Array.isArray(releaseSequence) && releaseSequence.length > 0
    ? releaseSequence
    : [release];
  const initialRelease = releases[0];

  if (!initialRelease?.id
    || releases.some((entry) => entry?.id !== initialRelease.id)
    || (releaseAfterSearchAgain && releaseAfterSearchAgain.id !== initialRelease.id)) {
    throw new TypeError('installScopedMusicQueueReadModelFixtures requires a release with an id');
  }

  let releaseReadCount = 0;
  let searchAgainRequestCount = 0;
  let currentRelease = initialRelease;

  await installConfiguredMusicQueueProviderFixtures(browserContext);

  await browserContext.route('**/api/v1/acquisition/releases**', async (route) => {
    const requestUrl = new URL(route.request().url());
    const listPath = '/api/v1/acquisition/releases';
    const releasePath = `${listPath}/${encodeURIComponent(initialRelease.id)}`;
    const searchAgainPath = `${releasePath}/search-again`;

    if (route.request().method() === 'POST' && requestUrl.pathname === searchAgainPath && searchAgainResponse) {
      searchAgainRequestCount += 1;
      currentRelease = releaseAfterSearchAgain ?? currentRelease;
      await route.fulfill({
        body: JSON.stringify(searchAgainResponse),
        contentType: 'application/json',
      });
      return;
    }

    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }

    if (!releaseAfterSearchAgain) {
      currentRelease = releases[Math.min(releaseReadCount, releases.length - 1)];
    }

    if (requestUrl.pathname === listPath) {
      releaseReadCount += 1;
      await route.fulfill({
        body: JSON.stringify({
          checkedAt: '2026-07-30T20:00:00.000Z',
          pagination: { limit: 100, offset: 0, total: 1 },
          releases: [currentRelease],
          summary: { counts: { [currentRelease.status?.code ?? 'queued_for_search']: 1 }, total: 1 },
        }),
        contentType: 'application/json',
      });
      return;
    }

    if (requestUrl.pathname === releasePath) {
      await route.fulfill({
        body: JSON.stringify({
          checkedAt: '2026-07-30T20:00:00.000Z',
          release: currentRelease,
        }),
        contentType: 'application/json',
      });
      return;
    }

    await route.fulfill({
      body: JSON.stringify({
        error: {
          code: 'music_queue_release_not_found',
          message: 'Music Queue release was not found',
        },
      }),
      contentType: 'application/json',
      status: 404,
    });
  });

  await browserContext.route('**/api/v1/activity/feed**', async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        checkedAt: '2026-07-30T20:00:00.000Z',
        events: activityEvents,
        ok: true,
        total: activityEvents.length,
      }),
      contentType: 'application/json',
    });
  });

  return {
    getReleaseReadCount: () => releaseReadCount,
    getSearchAgainRequestCount: () => searchAgainRequestCount,
  };
}
