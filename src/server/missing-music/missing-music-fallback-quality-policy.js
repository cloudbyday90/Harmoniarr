/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { canAllowAcquisitionFallbackQuality } from '../acquisition/acquisition-quality-evidence-policy.js';

export function canAllowMissingMusicFallbackQuality({ projectedRelease, targetUser } = {}) {
  return targetUser?.isDisabled !== true && targetUser?.accountStatus !== 'disabled'
    && canAllowAcquisitionFallbackQuality(projectedRelease);
}
