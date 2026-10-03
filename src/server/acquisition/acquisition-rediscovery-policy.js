/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const REDISCOVERY_STATUS_CODES = new Set(['failed', 'no_matches_left', 'quality_choice_needed']);
const ACTIVE_REDISCOVERY_STATUSES = new Set(['cooldown', 'ready', 'running', 'searching']);

export function canRequestMusicQueueRediscovery(statusCode) {
  return REDISCOVERY_STATUS_CODES.has(statusCode);
}

export function isMusicQueueRediscoveryInProgress(discoveryRequest) {
  return discoveryRequest?.searchMode === 'automatic'
    && discoveryRequest?.blockedReason == null
    && ACTIVE_REDISCOVERY_STATUSES.has(discoveryRequest?.requestStatus)
    && discoveryRequest?.evidence?.musicQueueRediscovery != null;
}
