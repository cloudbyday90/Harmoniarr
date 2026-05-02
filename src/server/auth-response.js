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

import { toSessionUser } from './auth.js';

export function createBootstrapStatusResponse(payload) {
  return {
    ok: true,
    ...payload,
  };
}

export function createAuthenticatedResponse(user, issuedSession) {
  return {
    ok: true,
    bootstrapRequired: false,
    user: toSessionUser(user),
    csrfToken: issuedSession.csrfToken,
  };
}

export function createRefreshResponse(sessionUser, issuedSession) {
  return {
    ok: true,
    bootstrapRequired: false,
    user: sessionUser,
    csrfToken: issuedSession.csrfToken,
  };
}

export function createActiveSessionsResponse(payload) {
  return {
    ok: true,
    ...payload,
  };
}

export function createRecentActivityResponse(payload) {
  return {
    ok: true,
    ...payload,
  };
}

export function createPasswordChangedResponse(user, issuedSession) {
  return {
    ok: true,
    bootstrapRequired: false,
    user: user ? toSessionUser(user) : null,
    csrfToken: issuedSession.csrfToken,
  };
}

export function createSessionRevokedResponse(payload) {
  return {
    ok: true,
    ...payload,
  };
}

export function createLogoutResponse() {
  return {
    ok: true,
  };
}

export function createSessionResponse(payload) {
  return {
    ok: true,
    ...payload,
  };
}