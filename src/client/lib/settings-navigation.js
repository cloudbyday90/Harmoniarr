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

export const settingsSectionNavigationItems = Object.freeze([
  {
    id: 'general',
    label: 'General',
    description: 'Security posture, base URL, and runtime defaults.',
    type: 'section',
  },
  {
    id: 'connections',
    label: 'Connections',
    description: 'slskd connectivity and provider intake credentials.',
    type: 'section',
  },
  {
    id: 'media-storage',
    label: 'Media & storage',
    description: 'Artwork policy, path mapping, and validation health.',
    type: 'section',
  },
  {
    id: 'users-access',
    label: 'Users & access',
    description: 'App users, Plex import, and managed library folders.',
    type: 'section',
  },
  {
    id: 'library',
    label: 'Library',
    description: 'Download scoring, discovery schedule, and reconciliation settings.',
    type: 'section',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Push notification preferences and active browser subscriptions.',
    type: 'section',
  },
  {
    id: 'library-browser',
    label: 'Library browser',
    description: 'Explore and search raw metadata, files, and reconciliation state.',
    type: 'section',
  },
  {
    id: 'recovery',
    label: 'Recovery',
    description: 'Emergency admin recovery tools.',
    type: 'section',
  },
]);

export const settingsNavigationItems = Object.freeze([
  ...settingsSectionNavigationItems,
  {
    id: 'account-security',
    label: 'My account',
    description: 'Password changes, active sessions, and recent account activity.',
    routeName: 'account-security',
    type: 'route',
  },
]);

export const defaultSettingsSectionId = settingsSectionNavigationItems[0].id;

const settingsSectionIds = new Set(settingsSectionNavigationItems.map((item) => item.id));

export function isSettingsSectionId(value) {
  return settingsSectionIds.has(value);
}

export function normalizeSettingsSectionId(value) {
  const normalizedValue = typeof value === 'string'
    ? value.trim().replace(/^#/, '')
    : '';

  return isSettingsSectionId(normalizedValue) ? normalizedValue : defaultSettingsSectionId;
}

export function buildSettingsSectionHash(value) {
  return `#${normalizeSettingsSectionId(value)}`;
}