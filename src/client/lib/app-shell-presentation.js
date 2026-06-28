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
 * Pure presentation helpers for the AppShell component.
 * All functions are side-effect-free and depend only on their arguments.
 */

/**
 * @typedef {{ name: string, label: string, icon: string, exact?: true, badge?: number }} NavItem
 */

const OPERATOR_NAV = Object.freeze([
  Object.freeze({ name: 'dashboard', label: 'Home', icon: 'library', exact: true }),
  Object.freeze({ name: 'music-queue', label: 'Music Queue', icon: 'music' }),
  Object.freeze({ name: 'discover', label: 'Discover', icon: 'discover' }),
  Object.freeze({ name: 'missing', label: 'Missing', icon: 'missing' }),
  Object.freeze({ name: 'downloader', label: 'Downloader', icon: 'download' }),
  Object.freeze({ name: 'activity', label: 'Activity', icon: 'activity' }),
  Object.freeze({ name: 'settings', label: 'Settings', icon: 'settings' }),
]);

const REQUESTER_NAV = Object.freeze([
  Object.freeze({ name: 'dashboard', label: 'Home', icon: 'library', exact: true }),
  Object.freeze({ name: 'music-queue', label: 'Music Queue', icon: 'music' }),
  Object.freeze({ name: 'discover', label: 'Discover', icon: 'discover' }),
  Object.freeze({ name: 'search', label: 'Search', icon: 'search' }),
  Object.freeze({ name: 'my-requests', label: 'My Requests', icon: 'requests' }),
]);

/**
 * Returns the operator navigation items.
 *
 * @returns {readonly NavItem[]}
 */
export function buildOperatorNav() {
  return OPERATOR_NAV;
}

/**
 * Returns the requester navigation items.
 *
 * @returns {readonly NavItem[]}
 */
export function buildRequesterNav() {
  return REQUESTER_NAV;
}

/**
 * Returns the nav items to render for the current session.  For requesters,
 * a non-zero `requesterNotificationCount` is applied as a badge on the
 * "My Requests" item so the count is visible in the nav rail.
 *
 * The function never mutates its inputs.
 *
 * @param {boolean} isRequester
 * @param {number} requesterNotificationCount
 * @returns {readonly NavItem[]}
 */
export function buildVisibleNav(isRequester, requesterNotificationCount) {
  const base = isRequester ? REQUESTER_NAV : OPERATOR_NAV;
  if (!isRequester) return base;
  const count = requesterNotificationCount ?? 0;
  if (count <= 0) return base;
  return base.map((item) => (item.name === 'my-requests' ? { ...item, badge: count } : item));
}

/**
 * Maps a system notification category to a display tone used by the pill
 * component.  Unknown categories default to `'info'`.
 *
 * @param {string | null | undefined} category
 * @returns {'danger' | 'warning' | 'info'}
 */
export function notificationTone(category) {
  if (category === 'failure') return 'danger';
  if (category === 'manual_intervention') return 'warning';
  if (category === 'recovery') return 'info';
  return 'info';
}
