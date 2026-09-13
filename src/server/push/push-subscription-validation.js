/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { ECDH } from 'node:crypto';
import { parsePushEndpoint } from './push-endpoint-policy.js';

function decodeKey(value, length) {
  if (typeof value !== 'string' || value.length !== Math.ceil(length * 4 / 3) || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length !== length || bytes.toString('base64url') !== value) throw new Error();
  return bytes;
}

/** Accept the browser serialization exactly; native crypto validates the P-256 point. */
export function validatePushSubscription({ endpoint, p256dh, auth } = {}) {
  try {
    parsePushEndpoint(endpoint);
    const point = decodeKey(p256dh, 65);
    decodeKey(auth, 16);
    if (point[0] !== 4 || !ECDH.convertKey(point, 'prime256v1', undefined, undefined, 'uncompressed').equals(point)) throw new Error();
    return { endpoint, p256dh, auth };
  } catch {
    throw Object.assign(new Error('Push subscription endpoint or encryption keys are invalid'), { code: 'push_subscription_invalid' });
  }
}
