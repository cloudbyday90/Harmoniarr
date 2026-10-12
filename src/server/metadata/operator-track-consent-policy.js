/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

/** Saved group-scoped intent may follow the resolved edition; a bound override may not. */
export function isResolvedDesiredTrackOverrideForRelease(trackOverride, metadataReleaseId) {
  return typeof metadataReleaseId === 'string' && metadataReleaseId.length > 0
    && trackOverride?.isDesired === true
    && trackOverride.remapStatus === 'resolved'
    && (trackOverride.metadataReleaseId == null || trackOverride.metadataReleaseId === metadataReleaseId);
}
