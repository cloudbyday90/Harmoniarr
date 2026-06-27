/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';

export async function createUserThroughApi(page, {
  password,
  role = 'requester',
  username,
} = {}) {
  const result = await page.evaluate(async ({ userPassword, userRole, userUsername }) => {
    const encodedName = 'harmoniarr_csrf=';
    const csrfToken = globalThis.document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(encodedName))
      ?.slice(encodedName.length)
      ?? '';
    const response = await fetch('/api/v1/users', {
      body: JSON.stringify({
        password: userPassword,
        role: userRole,
        username: userUsername,
      }),
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      method: 'POST',
    });

    return {
      payload: await response.json(),
      status: response.status,
    };
  }, {
    userPassword: password,
    userRole: role,
    userUsername: username,
  });

  assert.equal(result.status, 201);
  assert.equal(result.payload?.user?.role, role);
  return result.payload.user;
}

export async function createRequesterThroughApi(page, options = {}) {
  return createUserThroughApi(page, {
    ...options,
    role: 'requester',
  });
}

export async function loginUserThroughUi(page, {
  baseUrl,
  beforeReadyNavigation = null,
  initialPassword,
  readyPassword,
  username,
} = {}) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'load' });
  await page.getByRole('heading', { name: 'Log in to Harmoniarr' }).waitFor();
  await page.getByLabel('Username or email').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(initialPassword);
  await page.getByRole('button', { name: 'Log in' }).click();

  await page.waitForURL(/\/app\/account-security(?:\?.*)?$/);
  await page.getByRole('heading', { name: 'My account' }).waitFor();
  await page.getByText('Your password must be updated before you can continue.').waitFor();

  const result = await page.evaluate(async ({ currentPassword, newPassword }) => {
    const encodedName = 'harmoniarr_csrf=';
    const csrfToken = globalThis.document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(encodedName))
      ?.slice(encodedName.length)
      ?? '';
    const response = await fetch('/api/v1/auth/change-password', {
      body: JSON.stringify({ currentPassword, newPassword }),
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      method: 'POST',
    });

    return {
      payload: await response.json(),
      status: response.status,
    };
  }, {
    currentPassword: initialPassword,
    newPassword: readyPassword,
  });

  assert.equal(result.status, 200);
  assert.equal(result.payload?.user?.mustChangePassword, false);

  if (typeof beforeReadyNavigation === 'function') {
    await beforeReadyNavigation(page);
  }

  await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { exact: true, name: 'Home' }).waitFor();
}

export async function loginRequesterThroughUi(page, options = {}) {
  return loginUserThroughUi(page, options);
}
