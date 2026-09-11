/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { presentProviderCollectionAccessCheck, providerAccessDiagnosticCodes } from '../src/server/integrations/providers/provider-collection-access-check-policy.js';

function invalidEvidence() {
  return new Error('The application returned invalid provider access evidence');
}

function count(value, maximum) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

export function buildProviderCollectionAccessEvidence(check, { observedAt = new Date().toISOString() } = {}) {
  const authModes = {
    spotify: ['oauth_user', 'client_credentials', 'none'],
    youtube: ['oauth_user', 'api_key', 'none'],
    apple_music: ['developer_token', 'none'],
  };
  if (!check || check.schemaVersion !== 1 || !Object.hasOwn(authModes, check.provider)
    || !authModes[check.provider].includes(check.authMode)
    || !['playlist', 'artist'].includes(check.resourceType)
    || (check.provider === 'youtube' && check.resourceType !== 'playlist')
    || check.quotaMode !== 'unknown' || !providerAccessDiagnosticCodes.includes(check.code)
    || !count(check.pagesChecked, 2) || !count(check.entriesSeen, 200)
    || ![null, true, false].includes(check.hasMore)
    || !['not_applicable', 'verified', 'failed', 'not_checked'].includes(check.snapshotCheck)
    || typeof check.checkedAt !== 'string' || !Number.isFinite(Date.parse(check.checkedAt))
    || !Number.isFinite(Date.parse(observedAt))
    || Math.abs(Date.parse(observedAt) - Date.parse(check.checkedAt)) > 300_000
    || (check.retryAfterSeconds !== null && !count(check.retryAfterSeconds, 86_400))) throw invalidEvidence();

  const projected = presentProviderCollectionAccessCheck({
    provider: check.provider, resourceType: check.resourceType, authMode: check.authMode,
    pagesChecked: check.pagesChecked, entriesSeen: check.entriesSeen, hasMore: check.hasMore,
    snapshotCheck: check.snapshotCheck, checkedAt: new Date(check.checkedAt).toISOString(),
  }, check.code, { details: { retryAfterSeconds: check.retryAfterSeconds } });
  const spotifyPlaylist = check.provider === 'spotify' && check.resourceType === 'playlist';
  if (projected.outcome !== check.outcome || projected.fullTraversal !== check.fullTraversal
    || projected.multiPageObserved !== check.multiPageObserved
    || (check.pagesChecked === 0 && (check.entriesSeen !== 0 || check.hasMore !== null))
    || (check.pagesChecked > 0 && typeof check.hasMore !== 'boolean')
    || (!spotifyPlaylist && check.snapshotCheck !== 'not_applicable')
    || (check.outcome === 'verified' && (check.pagesChecked === 0 || check.authMode === 'none'
      || (spotifyPlaylist && check.snapshotCheck !== 'verified')))
    || (check.outcome === 'not_checked' && check.pagesChecked !== 0)) throw invalidEvidence();

  return {
    schemaVersion: 1,
    evidenceType: 'live_provider_collection_access',
    observedAt: new Date(observedAt).toISOString(),
    acceptancePassed: projected.outcome === 'verified' && projected.multiPageObserved && projected.fullTraversal,
    check: projected,
  };
}
