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

// ── Must-change-password warning ─────────────────────────────────────────────

/**
 * Body copy for the must-change-password warning banner.
 * Must not reference "admin actions" — the restriction applies to all users.
 *
 * @returns {string}
 */
export function buildMustChangePasswordWarning() {
  return 'Your password must be updated before you can continue.';
}

// ── Active sessions ───────────────────────────────────────────────────────────

/**
 * Subtitle for the Active Sessions card.
 * "Services" is a technical term — "apps" is clearer for requesters.
 *
 * @returns {string}
 */
export function buildActiveSessionsSubtitle() {
  return 'Devices and apps currently signed in to this account.';
}

// ── Request preferences ───────────────────────────────────────────────────────

/**
 * Title for the request/audio preferences card.
 * "Import" is an internal pipeline term — requesters submit requests.
 *
 * @returns {string}
 */
export function buildRequestPreferencesTitle() {
  return 'Request preferences';
}

// ── Push notification copy ────────────────────────────────────────────────────

/**
 * Body copy when push notifications are enabled and subscribed.
 *
 * @returns {string}
 */
export function buildPushSubscribedBody() {
  return "You'll be notified when your requests are ready, even when the app isn't open.";
}

/**
 * Body copy when push notifications are supported but not yet enabled.
 * Acts as a call-to-action as well as a status description.
 *
 * @returns {string}
 */
export function buildPushUnsubscribedBody() {
  return 'Enable to be alerted when your requests are ready.';
}

/**
 * Body copy when the browser has blocked notification permission.
 *
 * @returns {string}
 */
export function buildPushPermissionDeniedBody() {
  return "Notification permission is blocked. Open your browser's site settings and allow notifications for this page, then reload.";
}

/**
 * Normalise a raw browser Push API error message for display.
 *
 * Push API errors are highly technical DOMException strings. This function
 * maps known patterns to user-readable copy and suppresses implementation
 * details (ServiceWorker, DOMException class names, etc.).
 *
 * @param {string|null|undefined} rawError
 * @returns {string}
 */
export function formatPushNotificationError(rawError) {
  if (!rawError) return 'Notifications could not be updated. Try again.';
  const lower = rawError.toLowerCase();
  if (lower.includes('not allowed') || lower.includes('permission')) {
    return 'Notification permission is required. Allow notifications in your browser settings and try again.';
  }
  if (lower.includes('serviceworker') || lower.includes('service worker') || lower.includes('registration failed')) {
    return 'Notifications could not be set up. Try reloading the page.';
  }
  if (lower.includes('push service') || lower.includes('push server')) {
    return 'The notification service is temporarily unavailable. Try again later.';
  }
  if (lower.includes('abort') || lower.includes('aborted')) {
    return 'The request was interrupted. Try again.';
  }
  return rawError;
}

// ── Security-relevant event types ────────────────────────────────────────────

/**
 * Security-relevant event type prefixes. Only events whose eventType starts
 * with one of these strings are shown on the account security activity feed.
 * Non-security events such as metadata imports are suppressed.
 */
const SECURITY_EVENT_PREFIXES = ['login_', 'password_', 'session_', 'bootstrap_', 'user_'];

/**
 * Returns true when the event should appear on the account security page.
 * Filters out non-security audit events (e.g. library operations).
 *
 * @param {{ eventType?: string } | null | undefined} event
 * @returns {boolean}
 */
export function isSecurityRelevantEvent(event) {
  if (!event?.eventType || typeof event.eventType !== 'string') return false;
  return SECURITY_EVENT_PREFIXES.some((prefix) => event.eventType.startsWith(prefix));
}

/**
 * Maps a security event type to a display tone for the status pill.
 *
 * @param {string | null | undefined} eventType
 * @returns {'success' | 'danger' | 'info'}
 */
export function getActivityEventTone(eventType) {
  if (typeof eventType !== 'string' || !eventType) return 'info';
  if (
    eventType.endsWith('_failed') ||
    eventType.endsWith('_blocked') ||
    eventType.endsWith('_denied')
  ) {
    return 'danger';
  }
  if (
    eventType.endsWith('_succeeded') ||
    eventType.endsWith('_created') ||
    eventType.endsWith('_revoked') ||
    eventType.endsWith('_changed')
  ) {
    return 'success';
  }
  return 'info';
}

/**
 * Returns a short human-readable status label for a security event type,
 * suitable for display inside a compact status pill.
 *
 * @param {string | null | undefined} eventType
 * @returns {string}
 */
export function getActivityEventStatusLabel(eventType) {
  if (typeof eventType !== 'string' || !eventType) return 'Event';
  if (eventType.endsWith('_failed')) return 'Failed';
  if (eventType.endsWith('_blocked')) return 'Blocked';
  if (eventType.endsWith('_denied')) return 'Denied';
  if (eventType.endsWith('_succeeded')) return 'Succeeded';
  if (eventType.endsWith('_created')) return 'Created';
  if (eventType.endsWith('_revoked')) return 'Revoked';
  if (eventType.endsWith('_changed')) return 'Changed';
  return 'Event';
}

/**
 * Formats an ISO 8601 timestamp string into a locale-appropriate display
 * string for session and activity timestamps.
 * Returns the fallback label for null, undefined, empty, or unparseable values.
 *
 * @param {string | null | undefined} value
 * @param {string} [fallback='Not recorded']
 * @returns {string}
 */
export function formatSessionTimestamp(value, fallback = 'Not recorded') {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Returns true when the session was issued by a non-browser service client.
 * Service sessions have a user-agent that does not start with "Mozilla/".
 *
 * @param {{ issuedUserAgent?: string | null } | null | undefined} session
 * @returns {boolean}
 */
export function isServiceSession(session) {
  const ua = session?.issuedUserAgent;
  if (!ua || typeof ua !== 'string') return false;
  return !ua.startsWith('Mozilla/');
}

/**
 * Formats a raw user-agent string into a concise, human-readable client label.
 * Non-browser service identifiers are returned as-is (truncated if very long).
 * Browser UAs are normalized to app name + version.
 *
 * @param {string | null | undefined} ua
 * @returns {string}
 */
export function formatUserAgent(ua) {
  if (!ua) return 'Unknown client';

  // Non-browser identifiers — return as-is, truncated if necessary
  if (!ua.startsWith('Mozilla/')) {
    return ua.length > 60 ? `${ua.slice(0, 57)}\u2026` : ua;
  }

  // VS Code / Electron shell (check before Chrome since Electron UA includes Chrome token)
  if (/Electron\//.test(ua)) {
    const appLabel = /Code\//.test(ua) ? 'VS Code' : 'Electron app';
    const ver = ua.match(/Electron\/([\d.]+)/);
    return ver ? `${appLabel} \u00b7 Electron ${ver[1]}` : appLabel;
  }

  // Edge (check before Chrome since Edge UA also contains the Chrome token)
  if (/Edg\//.test(ua)) {
    const ver = ua.match(/Edg\/([\d.]+)/);
    return ver ? `Microsoft Edge ${ver[1]}` : 'Microsoft Edge';
  }

  // Chrome / Chromium
  const chromeVer = ua.match(/Chrome\/([\d.]+)/);
  if (chromeVer) return `Chrome ${chromeVer[1]}`;

  // Firefox
  const ffVer = ua.match(/Firefox\/([\d.]+)/);
  if (ffVer) return `Firefox ${ffVer[1]}`;

  // Safari
  const safariVer = ua.match(/Version\/([\d.]+).*Safari\//);
  if (safariVer) return `Safari ${safariVer[1]}`;

  // Unknown browser UA — truncate to avoid wall of text
  return ua.length > 60 ? `${ua.slice(0, 57)}\u2026` : ua;
}
