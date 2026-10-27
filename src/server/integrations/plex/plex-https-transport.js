/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createOwnedHttpsTransport } from '../../network/owned-https-transport.js';
import { startBoundedHttpsResponse } from '../../network/bounded-https-response.js';
import { admitPlexDestination, plexHttpError, validatePlexResponseHeaders } from './plex-http-policy.js';

export function createPlexHttpsTransport(options = {}) {
  return createOwnedHttpsTransport({ ...options, admitDestination: admitPlexDestination, createError: plexHttpError,
    readResponse: (response, context) => startBoundedHttpsResponse(response, { ...context, validateHeaders: validatePlexResponseHeaders }) });
}
