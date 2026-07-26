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
