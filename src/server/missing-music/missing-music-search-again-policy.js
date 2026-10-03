/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { canRequestMusicQueueRediscovery } from '../acquisition/acquisition-rediscovery-policy.js';

export function canSearchMissingMusicAgain({ statusCode, targetUser } = {}) {
  return targetUser?.isDisabled !== true
    && targetUser?.accountStatus !== 'disabled'
    && canRequestMusicQueueRediscovery(statusCode);
}
