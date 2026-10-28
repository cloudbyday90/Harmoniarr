/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getPublicApiError } from '../../api-error.js';

const catalogs = {
  spotify: { fallback: 'spotify_oauth_failed', codes: new Set([
    'spotify_oauth_failed', 'spotify_oauth_state_invalid', 'spotify_oauth_authorization_changed',
    'spotify_oauth_link_changed', 'spotify_client_id_required',
    'spotify_oauth_token_exchange_failed', 'spotify_invalid_response',
  ]) },
  youtube: { fallback: 'youtube_oauth_failed', codes: new Set([
    'youtube_oauth_failed', 'youtube_oauth_state_invalid', 'youtube_oauth_authorization_changed',
    'youtube_oauth_link_changed', 'youtube_client_id_required', 'youtube_client_secret_required',
    'youtube_oauth_token_exchange_failed', 'youtube_invalid_response',
  ]) },
  plex: { fallback: 'plex_link_failed', codes: new Set([
    'plex_link_failed', 'plex_link_state_invalid', 'plex_link_authorization_changed',
    'plex_link_not_claimed', 'plex_link_profile_invalid', 'plex_link_restricted_account',
    'plex_pin_invalid_response', 'plex_pin_unauthorized', 'plex_pin_read_failed',
    'plex_user_invalid_response', 'plex_token_invalid', 'plex_user_fetch_failed',
    'plex_request_timeout', 'plex_request_busy', 'plex_request_closed', 'plex_request_unavailable',
    'plex_request_oversized', 'plex_request_redirect', 'plex_request_invalid',
  ]) },
};

/** Select only reviewed callback outcomes; diagnostic fields never become URL data. */
export function selectProviderCallbackErrorCode(provider, error) {
  if (typeof provider !== 'string' || !Object.hasOwn(catalogs, provider)) throw new TypeError('Unsupported callback provider');
  const { codes, fallback } = catalogs[provider];
  let code;
  try { code = getPublicApiError(error)?.code ?? error?.code; }
  catch { return fallback; }
  return typeof code === 'string' && codes.has(code) ? code : fallback;
}
