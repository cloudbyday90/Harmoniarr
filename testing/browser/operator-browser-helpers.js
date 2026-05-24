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

export async function waitForHeading(page, name) {
  await page.getByRole('heading', { name }).waitFor();
}

async function assertAuthenticatedLanding(page, username) {
  const currentUrl = new URL(page.url());
  assert.match(currentUrl.pathname, /^\/app(?:\/onboarding)?$/);

  if (currentUrl.pathname === '/app') {
    await waitForHeading(page, 'Library');
  }

  await page.locator('.hx-topbar-user').filter({ hasText: username }).waitFor();
}

export async function bootstrapAdminThroughUi(page, {
  baseUrl,
  password = 'BrowserPass123!',
  username = 'admin',
} = {}) {
  await page.goto(`${baseUrl}/bootstrap`, { waitUntil: 'networkidle' });
  await waitForHeading(page, 'Create the first admin account');

  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create bootstrap admin' }).click();

  await page.waitForURL(/\/app(?:\/onboarding)?(?:\?.*)?$/);
  await assertAuthenticatedLanding(page, username);
}

export async function loginThroughUi(page, {
  baseUrl,
  password = 'BrowserPass123!',
  username = 'admin',
} = {}) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await waitForHeading(page, 'Log in to Harmoniarr');

  await page.getByLabel('Username or email').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();

  await page.waitForURL(/\/app(?:\/onboarding)?(?:\?.*)?$/);
  await assertAuthenticatedLanding(page, username);
}

export async function logoutThroughUi(page) {
  await page.locator('.hx-topbar-user').click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await page.waitForURL(/\/login(?:\?.*)?$/);
  await waitForHeading(page, 'Log in to Harmoniarr');
}
