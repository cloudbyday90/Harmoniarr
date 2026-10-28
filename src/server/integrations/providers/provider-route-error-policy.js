/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError, getPublicApiError } from '../../api-error.js';

const musicBrainz = {
  musicbrainz_not_found: [404, 'MusicBrainz resource was not found'],
  musicbrainz_misconfigured: [503, 'MusicBrainz configuration needs review'],
  musicbrainz_unavailable: [503, 'MusicBrainz is temporarily unavailable'],
  musicbrainz_request_failed: [502, 'MusicBrainz request failed. Review the request and try again.'],
  musicbrainz_invalid_response: [502, 'MusicBrainz returned an invalid response'],
};
const soulseek = {
  slskd_misconfigured: [503, 'Soulseek connection settings need review'],
  slskd_unauthorized: [503, 'Soulseek authentication failed'],
  slskd_unavailable: [503, 'Soulseek is temporarily unavailable'],
  slskd_request_failed: [502, 'Soulseek request failed. Try again.'],
};

function normalize(error, catalog) {
  let code;
  try { code = getPublicApiError(error)?.code ?? error?.code; }
  catch { return error; }
  if (typeof code !== 'string' || !Object.hasOwn(catalog, code)) return error;
  const [status, message] = catalog[code];
  return createApiError(status, code, message);
}

export function normalizeMusicBrainzRouteError(error) {
  return normalize(error, musicBrainz);
}

export function normalizeSlskdRouteError(error) {
  return normalize(error, soulseek);
}
