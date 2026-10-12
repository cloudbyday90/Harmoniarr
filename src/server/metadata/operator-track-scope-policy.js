/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isResolvedDesiredTrackOverrideForRelease } from './operator-track-consent-policy.js';

export const OPERATOR_TRACK_SCOPE_BLOCKER = 'operator_track_scope_verification_required';
const text = value => typeof value === 'string' && value.length > 0;
const position = value => Number.isSafeInteger(value) && value > 0;

export function resolveOperatorTrackOverride(override, metadataReleaseId, trackCatalog = []) {
  if (!isResolvedDesiredTrackOverrideForRelease(override, metadataReleaseId) || override.trackMbid != null
    || !text(override.recordingMbid) || !position(override.mediumPosition) || !position(override.trackPosition)) return null;
  const matches = trackCatalog.filter(track => track.metadataReleaseId === metadataReleaseId
    && track.recordingMbid === override.recordingMbid && track.mediumPosition === override.mediumPosition
    && track.trackPosition === override.trackPosition);
  return matches.length === 1 ? matches[0] : null;
}

export function buildOperatorTrackScope({ metadataReleaseId, trackCatalog = [], trackOverrides = [] }) {
  const catalog = trackCatalog.filter(track => track.metadataReleaseId === metadataReleaseId);
  const desired = trackOverrides.filter(override => override.isDesired === true
    && (override.metadataReleaseId == null || override.metadataReleaseId === metadataReleaseId));
  const tracks = desired.map(override => resolveOperatorTrackOverride(override, metadataReleaseId, catalog));
  if (desired.length === 0 || tracks.some(track => !track)) return { version: 1, mode: 'unresolved', metadataReleaseId, tracks: [] };
  const unique = [...new Map(tracks.map(track => [track.metadataTrackId, track])).values()]
    .sort((a, b) => a.mediumPosition - b.mediumPosition || a.trackPosition - b.trackPosition);
  return { version: 1, mode: unique.length === catalog.length ? 'release' : 'tracks', metadataReleaseId,
    tracks: structuredClone(unique) };
}

export function isReleaseWideOperatorTrackScope(scope) {
  return scope?.version === 1 && scope.mode === 'release' && text(scope.metadataReleaseId)
    && Array.isArray(scope.tracks) && scope.tracks.length > 0
    && new Set(scope.tracks.map(track => track?.metadataTrackId)).size === scope.tracks.length
    && scope.tracks.every(track => text(track?.metadataTrackId) && track.metadataReleaseId === scope.metadataReleaseId
      && text(track.recordingMbid) && text(track.title) && position(track.mediumPosition) && position(track.trackPosition));
}

export function hasBlockedOperatorTrackScopes(context) {
  if (!context || !Object.hasOwn(context, 'operatorTrackScopes')) return false;
  return !Array.isArray(context.operatorTrackScopes) || context.operatorTrackScopes.length === 0
    || context.operatorTrackScopes.some(entry => !text(entry?.wantedReleaseId ?? entry?.mediaRequestId) || !isSupportedOperatorTrackScope(entry.scope));
}

export function isSupportedOperatorTrackScope(scope) {
  return isReleaseWideOperatorTrackScope(scope) || (scope?.mode === 'tracks'
    && scope.tracks?.length === 1 && scope.tracks[0]?.mediumPosition === 1
    && isReleaseWideOperatorTrackScope({ ...scope, mode: 'release' }));
}
