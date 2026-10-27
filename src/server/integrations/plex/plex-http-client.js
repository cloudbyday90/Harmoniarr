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

import { createPlexRequestService } from './plex-request-service.js';
import { validatePlexHeaders, plexHttpError } from './plex-http-policy.js';

function unwrap(body, keys) {
  for (const key of keys) {
    if (Array.isArray(body?.[key])) return body[key];
    if (Array.isArray(body?.MediaContainer?.[key])) return body.MediaContainer[key];
  }
  return Array.isArray(body) ? body : [];
}

export function createPlexHttpClient({ transport, timeoutMs, maxActive,
  requestService = createPlexRequestService({ transport, timeoutMs, maxActive }) } = {}) {
  const send = (url, operation, input, method = 'GET') => requestService.requestJson({ url, operation, method,
    headers: validatePlexHeaders(input), signal: input.signal });
  return {
    createPin: async input => send('https://plex.tv/api/v2/pins?strong=true', 'createPin', { clientIdentifier: input.clientIdentifier, signal: input.signal }, 'POST'),
    readPin: async input => {
      const pinId = String(input.pinId ?? '');
      if (!pinId || pinId.length > 256 || !/^[A-Za-z0-9_-]+$/u.test(pinId)) throw plexHttpError('invalid');
      return send('https://plex.tv/api/v2/pins/' + encodeURIComponent(pinId), 'readPin', { clientIdentifier: input.clientIdentifier, signal: input.signal });
    },
    fetchCurrentUser: async input => send('https://plex.tv/api/v2/user', 'user', input),
    fetchHomeUsers: async input => unwrap(await send('https://plex.tv/api/v2/home/users', 'home', input), ['users', 'User']),
    fetchResources: async input => unwrap(await send('https://clients.plex.tv/api/v2/resources?includeHttps=1&includeRelay=1&includeIPv6=1', 'resources', input), ['resources', 'Resource']),
    close: requestService.close, waitForDrain: requestService.waitForDrain, getRequestState: requestService.getState,
  };
}
