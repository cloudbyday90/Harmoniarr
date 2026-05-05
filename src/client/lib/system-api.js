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

import { apiRequest, buildQueryString } from './api.js';

export function fetchLibraryScanSummary() {
  return apiRequest('/api/v1/system/library-scan-summary');
}

export function fetchOnboardingSummary() {
  return apiRequest('/api/v1/system/onboarding');
}

export function fetchSystemOverview() {
  return apiRequest('/api/v1/system/overview');
}

export function fetchSystemActivityFeed({ before, limit } = {}) {
  return apiRequest(`/api/v1/system/activity-feed${buildQueryString({ before, limit })}`);
}

export function fetchSystemOperatorNotifications({ limit } = {}) {
  return apiRequest(`/api/v1/system/operator-notifications${buildQueryString({ limit })}`);
}

export function browseFsDirectory({ path } = {}) {
  return apiRequest(`/api/v1/system/fs/browse${buildQueryString({ path })}`);
}