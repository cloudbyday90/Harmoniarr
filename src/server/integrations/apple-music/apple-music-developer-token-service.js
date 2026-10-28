/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { sign } from 'node:crypto';
import { appleMusicSigningError, appleMusicTokenRefreshSeconds, captureAppleMusicSigningCredentials, captureAppleMusicTokenTime } from './apple-music-signing-policy.js';

function signToken({ teamId, keyId, privateKey }, time) {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp: time.exp, iat: time.iat, iss: teamId })).toString('base64url');
  const input = header + '.' + payload;
  const signature = sign('sha256', Buffer.from(input), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  if (signature.length !== 64) throw appleMusicSigningError();
  return { expiresAt: time.expiresAt, issuedAt: time.issuedAt, token: input + '.' + signature.toString('base64url') };
}

/** Public helper retains its token/expiresAt result and sanitized error contract. */
export function generateAppleMusicDeveloperToken(input) {
  try {
    const { token, expiresAt } = signToken(captureAppleMusicSigningCredentials(input), captureAppleMusicTokenTime(Date.now()));
    return { token, expiresAt };
  } catch { throw appleMusicSigningError(); }
}

/** Capture key material once; cache only a bounded-lifetime token per client. */
export function createAppleMusicDeveloperTokenService(input, { getNow = () => Date.now() } = {}) {
  let credentials, cached = null, lastObserved = null;
  try { credentials = captureAppleMusicSigningCredentials(input); } catch { /* Preserve refusal at getToken before network dispatch. */ }
  return { getToken() {
    try {
      if (!credentials) throw appleMusicSigningError();
      const now = getNow(), time = captureAppleMusicTokenTime(now), rolledBack = lastObserved !== null && now < lastObserved;
      lastObserved = now;
      if (!rolledBack && cached && now >= cached.issuedAt && now < cached.expiresAt - appleMusicTokenRefreshSeconds * 1000) return cached.token;
      cached = null;
      cached = signToken(credentials, time);
      return cached.token;
    } catch { cached = null; throw appleMusicSigningError(); }
  } };
}
