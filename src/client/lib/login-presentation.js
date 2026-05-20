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
 * Pure presentation helpers for the LoginView component.
 * All functions are side-effect-free and depend only on their arguments.
 */

/**
 * Returns the persona-inclusive description shown in the AuthEntryShell header
 * on the login screen.  Copy covers both requester and operator workflows so
 * neither persona encounters language that excludes them.
 *
 * @returns {string}
 */
export function buildLoginDescription() {
  return 'Sign in to request music, track your library, and manage your account. Operators and administrators also access imports, diagnostics, and system settings.';
}

/**
 * Returns the Vue Router `:to` object for the inline claim-account link shown
 * inside the login form.  Preserves the current username as a prefill query
 * parameter when one is available, matching the behaviour of the footer links.
 *
 * @param {string | null | undefined} username  Current value of the username field.
 * @returns {{ name: string, query?: { username: string } }}
 */
export function buildClaimAccountRoute(username) {
  const trimmed = typeof username === 'string' ? username.trim() : '';
  if (trimmed.length > 0) {
    return { name: 'claim-account', query: { username: trimmed } };
  }
  return { name: 'claim-account' };
}

/**
 * Returns the context-aware status message shown on the login screen when a
 * redirect reason is present — for example after a successful claim, a session
 * expiry, or a privileged re-auth prompt.  Returns an empty string when no
 * message applies so callers can test truthiness to decide whether to render.
 *
 * @param {string | null | undefined} reason  Value of the `reason` query param.
 * @returns {string}
 */
export function buildLoginInfoMessage(reason) {
  if (reason === 'claim-complete') {
    return 'Your account claim is complete. Log in with the password you just set.';
  }

  if (reason === 'session-expired') {
    return 'Your session expired. Log in again to continue.';
  }

  if (reason === 'reauth-required') {
    return 'A privileged action requires you to confirm your password again before continuing.';
  }

  if (reason === 'plex-sign-in-not-linked') {
    return 'This Plex account is not linked to a direct-sign-in-capable Harmoniarr user. Use local login or claim your account.';
  }

  if (reason === 'plex-sign-in-restricted') {
    return 'Managed or restricted Plex accounts cannot sign in directly. Use the local account linked by your administrator.';
  }

  if (reason === 'plex-sign-in-failed') {
    return 'Plex sign-in did not complete. Try again or continue with local login.';
  }

  return '';
}
