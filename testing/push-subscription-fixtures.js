/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createECDH } from 'node:crypto';

/** Synthetic public encryption material, never used for a real subscription. */
export function createPushSubscriptionKeys() {
  return { p256dh: createECDH('prime256v1').generateKeys().toString('base64url'), auth: Buffer.alloc(16, 7).toString('base64url') };
}
