/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createPrivateKey, KeyObject } from 'node:crypto';

export const appleMusicTokenLifetimeSeconds = 3600;
export const appleMusicTokenRefreshSeconds = 300;
const maxPemBytes = 16_384;

export function appleMusicSigningError() {
  return Object.assign(new Error('Apple Music signing credentials or clock are invalid'), { code: 'apple_music_misconfigured', details: {} });
}

/** Admit only inline key material; never pass descriptors/URLs to native loaders. */
export function captureAppleMusicSigningCredentials({ teamId, keyId, privateKey } = {}) {
  try {
    if (![teamId, keyId].every(value => typeof value === 'string' && value.trim() && value.length <= 256)) throw appleMusicSigningError();
    let key;
    if (privateKey instanceof KeyObject) key = privateKey;
    else {
      if ((typeof privateKey !== 'string' && !Buffer.isBuffer(privateKey)) || Buffer.byteLength(privateKey) < 1 || Buffer.byteLength(privateKey) > maxPemBytes) throw appleMusicSigningError();
      key = createPrivateKey({ key: privateKey, format: 'pem' });
    }
    if (key.type !== 'private' || key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw appleMusicSigningError();
    return { teamId, keyId, privateKey: key };
  } catch { throw appleMusicSigningError(); }
}

export function captureAppleMusicTokenTime(now) {
  if (!Number.isSafeInteger(now) || now < 0) throw appleMusicSigningError();
  const iat = Math.floor(now / 1000), exp = iat + appleMusicTokenLifetimeSeconds, expiresAt = exp * 1000;
  if (!Number.isSafeInteger(expiresAt)) throw appleMusicSigningError();
  return { iat, exp, expiresAt, issuedAt: now };
}
