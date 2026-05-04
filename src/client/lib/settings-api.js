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

import { apiRequest } from './api.js';

export function fetchSettings() {
  return apiRequest('/api/v1/settings');
}

export function updateSettings(settings) {
  return apiRequest('/api/v1/settings', {
    method: 'PUT',
    includeCsrf: true,
    body: settings,
  });
}

export function startSpotifyOAuth() {
  return apiRequest('/api/v1/providers/spotify/oauth/start', {
    method: 'POST',
    includeCsrf: true,
  });
}

export function startPlexLink() {
  return apiRequest('/api/v1/providers/plex/link/start', {
    method: 'POST',
    includeCsrf: true,
  });
}

export function clearPlexLink() {
  return apiRequest('/api/v1/providers/plex/link/clear', {
    method: 'POST',
    includeCsrf: true,
  });
}

export function clearSpotifyOAuth() {
  return apiRequest('/api/v1/providers/spotify/oauth/clear', {
    method: 'POST',
    includeCsrf: true,
  });
}

export function startYouTubeOAuth() {
  return apiRequest('/api/v1/providers/youtube/oauth/start', {
    method: 'POST',
    includeCsrf: true,
  });
}

export function clearYouTubeOAuth() {
  return apiRequest('/api/v1/providers/youtube/oauth/clear', {
    method: 'POST',
    includeCsrf: true,
  });
}
