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

export function createAuthFailureHandler({ router, sessionStore }) {
  return async function handleAuthFailure(error = null) {
    const currentRoute = router.currentRoute?.value;
    if (error?.code === 'reauth_required') {
      if (currentRoute?.name === 'account-security') {
        return;
      }

      await router.push({
        name: 'account-security',
        query: {
          redirect: currentRoute?.fullPath ?? '/app',
        },
      });
      return;
    }

    sessionStore.clearSession();

    if (currentRoute?.name === 'login') {
      return;
    }

    await router.push({
      name: 'login',
      query: {
        redirect: currentRoute?.fullPath ?? '/app',
        reason: 'session-expired',
      },
    });
  };
}