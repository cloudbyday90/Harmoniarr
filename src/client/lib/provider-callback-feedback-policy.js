/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const labels = { spotify: 'Spotify', youtube: 'YouTube', plex: 'Plex' };
const callbackKeys = ['spotifyOAuth', 'youtubeOAuth', 'plexOAuth'];
const ownedKeys = new Set([...callbackKeys, 'code', 'state', 'error', 'error_description']);
const instructions = {
  review: 'Review Connections before starting linking again.',
  restart: 'Start linking again in this browser if needed.',
  session: 'Use a current administrator session, then start linking again if needed.',
  credentials: 'Review the saved provider credentials in Connections.',
  claim: 'Finish claiming the Plex link, then start linking again if needed.',
  owner: 'Use an unrestricted Plex owner account.',
  check: 'Review Connections to manage this account.',
};
const codes = {
  spotify: { spotify_oauth_state_invalid: 'restart', spotify_oauth_link_changed: 'restart', spotify_oauth_authorization_changed: 'session', spotify_client_id_required: 'credentials' },
  youtube: { youtube_oauth_state_invalid: 'restart', youtube_oauth_link_changed: 'restart', youtube_oauth_authorization_changed: 'session', youtube_client_id_required: 'credentials', youtube_client_secret_required: 'credentials' },
  plex: { plex_link_state_invalid: 'restart', plex_link_authorization_changed: 'session', plex_link_not_claimed: 'claim', plex_link_restricted_account: 'owner' },
};

/** Capture only bounded guidance; a return URL never establishes link success. */
export function readProviderCallbackIntent(query) {
  if (!query || typeof query !== 'object') return null;
  const keys = callbackKeys.filter(key => Object.hasOwn(query, key));
  if (!keys.length) return null;
  const generic = { provider: null, guidance: 'review' };
  if (keys.length !== 1) return generic;
  const key = keys[0], value = query[key];
  if (typeof value !== 'string' || !['linked', 'failed'].includes(value)) return generic;
  const provider = key.slice(0, -5), code = query.code;
  const guidance = value === 'linked' && code === undefined ? 'check'
    : value === 'failed' && typeof code === 'string' && Object.hasOwn(codes[provider], code) ? codes[provider][code] : 'review';
  return { provider, guidance };
}

export function clearProviderCallbackQuery(query) {
  return Object.fromEntries(Object.entries(query).filter(([key]) => !ownedKeys.has(key)));
}

export function readSavedProviderLink(payload, provider) {
  if (typeof provider !== 'string' || !Object.hasOwn(labels, provider)) return 'unknown';
  const summary = payload?.statusSummary, status = payload?.[provider];
  if (!['complete', 'partial'].includes(summary?.state) || !Array.isArray(summary.unavailableProviders)
    || summary.unavailableProviders.includes(provider) || status?.availability !== undefined
    || (status?.provider !== undefined && status.provider !== provider) || typeof status?.linked !== 'boolean') return 'unknown';
  return status.linked ? 'present' : 'absent';
}

export function buildProviderCallbackFeedback({ intent, observation, isLoading, permitted, cleanupFailed }) {
  if (!intent) return { message: '', guidance: '', tone: 'info' };
  const label = typeof intent.provider === 'string' && Object.hasOwn(labels, intent.provider) ? labels[intent.provider] : null;
  let message = 'Provider linking needs review.', tone = 'warning';
  if (!permitted) message = 'Provider linking needs an administrator’s review.';
  else if (label) {
    message = isLoading ? `Checking saved ${label} link…`
      : observation === 'present' ? `Last check found a saved ${label} link.`
        : observation === 'absent' ? `Last check found no saved ${label} link.` : `Saved ${label} link could not be checked. Try checking again.`;
    tone = isLoading || observation === 'present' ? 'info' : 'warning';
  }
  if (cleanupFailed) message += ' Return details could not be cleared. Open Connections to continue.';
  return { message, guidance: permitted ? (typeof intent.guidance === 'string' && Object.hasOwn(instructions, intent.guidance) ? instructions[intent.guidance] : instructions.review) : '', tone };
}
