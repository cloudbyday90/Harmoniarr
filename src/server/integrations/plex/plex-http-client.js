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

import { createApiError } from '../../auth.js';

const plexApiBaseUrl = 'https://plex.tv';
const plexClientsBaseUrl = 'https://clients.plex.tv';
const plexProductName = 'Harmoniarr';

function buildHeaders({ accessToken = null, clientIdentifier }) {
  return {
    Accept: 'application/json',
    'X-Plex-Client-Identifier': clientIdentifier,
    'X-Plex-Product': plexProductName,
    ...(accessToken ? { 'X-Plex-Token': accessToken } : {}),
  };
}

async function readJsonResponse(response, fallbackCode) {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw createApiError(502, fallbackCode, 'Plex returned an invalid JSON payload');
  }
}

function normalizePlexErrorBody(body, fallback) {
  if (typeof body?.errors?.[0]?.detail === 'string' && body.errors[0].detail.trim()) {
    return body.errors[0].detail.trim();
  }

  if (typeof body?.error === 'string' && body.error.trim()) {
    return body.error.trim();
  }

  if (typeof body?.message === 'string' && body.message.trim()) {
    return body.message.trim();
  }

  return fallback;
}

function unwrapPlexCollection(body, keys) {
  for (const key of keys) {
    if (Array.isArray(body?.[key])) {
      return body[key];
    }

    if (Array.isArray(body?.MediaContainer?.[key])) {
      return body.MediaContainer[key];
    }
  }

  if (Array.isArray(body)) {
    return body;
  }

  return [];
}

export function createPlexHttpClient({
  fetchFn = globalThis.fetch,
} = {}) {
  async function createPin({ clientIdentifier }) {
    const response = await fetchFn(`${plexApiBaseUrl}/api/v2/pins?strong=true`, {
      headers: buildHeaders({ clientIdentifier }),
      method: 'POST',
    });
    const body = await readJsonResponse(response, 'plex_pin_invalid_response');

    if (!response.ok) {
      throw createApiError(
        response.status === 401 ? 401 : 502,
        response.status === 401 ? 'plex_pin_unauthorized' : 'plex_pin_create_failed',
        normalizePlexErrorBody(body, `Plex PIN creation failed with status ${response.status}`),
      );
    }

    return body;
  }

  async function readPin({ clientIdentifier, pinId }) {
    const response = await fetchFn(`${plexApiBaseUrl}/api/v2/pins/${encodeURIComponent(String(pinId))}`, {
      headers: buildHeaders({ clientIdentifier }),
      method: 'GET',
    });
    const body = await readJsonResponse(response, 'plex_pin_invalid_response');

    if (!response.ok) {
      throw createApiError(
        response.status === 401 ? 401 : 502,
        response.status === 401 ? 'plex_pin_unauthorized' : 'plex_pin_read_failed',
        normalizePlexErrorBody(body, `Plex PIN lookup failed with status ${response.status}`),
      );
    }

    return body;
  }

  async function fetchCurrentUser({ accessToken, clientIdentifier }) {
    const response = await fetchFn(`${plexApiBaseUrl}/api/v2/user`, {
      headers: buildHeaders({ accessToken, clientIdentifier }),
      method: 'GET',
    });
    const body = await readJsonResponse(response, 'plex_user_invalid_response');

    if (!response.ok) {
      throw createApiError(
        response.status === 401 ? 401 : 502,
        response.status === 401 ? 'plex_token_invalid' : 'plex_user_fetch_failed',
        normalizePlexErrorBody(body, `Plex user lookup failed with status ${response.status}`),
      );
    }

    return body;
  }

  async function fetchHomeUsers({ accessToken, clientIdentifier }) {
    const response = await fetchFn(`${plexApiBaseUrl}/api/v2/home/users`, {
      headers: buildHeaders({ accessToken, clientIdentifier }),
      method: 'GET',
    });
    const body = await readJsonResponse(response, 'plex_home_users_invalid_response');

    if (!response.ok) {
      throw createApiError(
        response.status === 401 ? 401 : 502,
        response.status === 401 ? 'plex_token_invalid' : 'plex_home_users_fetch_failed',
        normalizePlexErrorBody(body, `Plex home user lookup failed with status ${response.status}`),
      );
    }

    return unwrapPlexCollection(body, ['users', 'User']);
  }

  async function fetchResources({ accessToken, clientIdentifier }) {
    const resourceUrl = new URL(`${plexClientsBaseUrl}/api/v2/resources`);
    resourceUrl.searchParams.set('includeHttps', '1');
    resourceUrl.searchParams.set('includeRelay', '1');
    resourceUrl.searchParams.set('includeIPv6', '1');

    const response = await fetchFn(resourceUrl, {
      headers: buildHeaders({ accessToken, clientIdentifier }),
      method: 'GET',
    });
    const body = await readJsonResponse(response, 'plex_resources_invalid_response');

    if (!response.ok) {
      throw createApiError(
        response.status === 401 ? 401 : 502,
        response.status === 401 ? 'plex_token_invalid' : 'plex_resources_fetch_failed',
        normalizePlexErrorBody(body, `Plex resources lookup failed with status ${response.status}`),
      );
    }

    return unwrapPlexCollection(body, ['resources', 'Resource']);
  }

  return {
    createPin,
    fetchCurrentUser,
    fetchHomeUsers,
    fetchResources,
    readPin,
  };
}
