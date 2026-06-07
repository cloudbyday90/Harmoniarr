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

export async function fetchDownloaderQueue({ includeRemoved = false, signal } = {}) {
  const query = includeRemoved ? '?includeRemoved=true' : '';
  const payload = await apiRequest(`/api/v1/downloader/queue${query}`, { signal });
  return payload?.downloader ?? null;
}

export async function requestDownloaderTransferAction({
  action,
  id,
  signal,
  username,
} = {}) {
  const encodedUsername = encodeURIComponent(username ?? '');
  const encodedId = encodeURIComponent(id ?? '');
  const payload = await apiRequest(`/api/v1/downloader/transfers/${encodedUsername}/${encodedId}/actions`, {
    body: { action },
    includeCsrf: true,
    method: 'POST',
    signal,
  });
  return payload?.downloaderAction ?? null;
}

export async function clearCompletedDownloaderTransfers({ signal } = {}) {
  const payload = await apiRequest('/api/v1/downloader/actions/clear-completed', {
    body: {},
    includeCsrf: true,
    method: 'POST',
    signal,
  });
  return payload?.downloaderAction ?? null;
}
