/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const providerLabels = {
  apple_music: 'Apple Music',
  spotify: 'Spotify',
  youtube: 'YouTube',
};

const authModeLabels = {
  api_key: 'Saved API key',
  client_credentials: 'Saved application credentials',
  developer_token: 'Saved developer authorization',
  none: 'No saved authorization available',
  oauth_user: 'Linked user authorization',
};

const snapshotLabels = {
  failed: 'Collection changed during the check',
  not_applicable: 'Not available for this source',
  not_checked: 'Not checked',
  verified: 'Unchanged during the check',
};

function isBoundedCount(value, maximum) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

// The server supplies fixed diagnostic copy. Keep only presentation fields;
// provider responses, source URLs, and credentials never become result state.
export function buildProviderCollectionAccessSummary(check) {
  if (check?.schemaVersion !== 1
    || !Object.hasOwn(providerLabels, check.provider)
    || !Object.hasOwn(authModeLabels, check.authMode)
    || !Object.hasOwn(snapshotLabels, check.snapshotCheck)
    || !['verified', 'failed', 'not_checked'].includes(check.outcome)
    || !['playlist', 'artist'].includes(check.resourceType)
    || !isBoundedCount(check.pagesChecked, 2)
    || !isBoundedCount(check.entriesSeen, 200)
    || typeof check.fullTraversal !== 'boolean'
    || typeof check.multiPageObserved !== 'boolean'
    || ![null, true, false].includes(check.hasMore)
    || !['label', 'detail', 'nextAction'].every((key) => (
      typeof check[key] === 'string' && check[key].length > 0 && check[key].length <= 1000
    ))) {
    return null;
  }

  const verified = check.outcome === 'verified';
  const completed = verified && check.fullTraversal && check.hasMore === false;
  const checkedAt = new Date(check.checkedAt);
  const retrySeconds = isBoundedCount(check.retryAfterSeconds, 86_400)
    ? check.retryAfterSeconds
    : null;

  return {
    authModeLabel: authModeLabels[check.authMode],
    checkedAtLabel: Number.isFinite(checkedAt.getTime()) ? checkedAt.toLocaleString() : '',
    coverageLabel: completed
      ? 'All collection pages checked for this source.'
      : verified
        ? 'Only the returned pages were verified. The full collection was not checked.'
        : 'Collection access remains unverified.',
    detail: check.detail,
    entriesSeen: check.entriesSeen,
    label: check.label,
    multiPageLabel: check.multiPageObserved ? 'Observed across multiple pages' : 'Not demonstrated',
    nextAction: check.nextAction,
    outcome: check.outcome,
    pagesChecked: check.pagesChecked,
    providerLabel: providerLabels[check.provider],
    quotaLabel: 'Provider quota mode is unknown',
    resourceLabel: check.resourceType === 'artist' ? 'Artist collection' : 'Playlist',
    retryLabel: retrySeconds === null ? '' : `Wait at least ${retrySeconds} seconds before checking again.`,
    snapshotLabel: snapshotLabels[check.snapshotCheck],
    tone: verified ? 'success' : check.outcome === 'failed' ? 'danger' : 'warning',
  };
}

export function buildProviderCollectionAccessError(error) {
  if (error?.status === 429) {
    return 'Too many access checks. Wait a minute before trying again.';
  }
  if (error?.status === 400) {
    return 'Enter a supported Spotify or Apple Music playlist or artist URL, or a YouTube playlist URL.';
  }
  if (error?.status === 401 || error?.code === 'reauth_required') {
    return 'Sign in again with an administrator account before checking provider access.';
  }
  if (error?.status === 403) {
    return 'An administrator session is required. Refresh this page before trying again.';
  }
  return 'Provider access could not be checked. Check the saved connection settings and try again.';
}
