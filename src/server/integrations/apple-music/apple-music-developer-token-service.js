/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createSign } from 'node:crypto';

// Apple Music developer tokens are valid for up to 15,777,000 seconds (6 months).
// We issue tokens with a 180-day (15,552,000 s) validity and re-generate 30 days
// before expiry so the token stays valid through long deployment cycles.
const tokenLifetimeSeconds = 15_552_000;
const tokenRefreshBufferSeconds = 2_592_000; // 30 days

function createAppleMusicError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Generate a signed ES256 developer token for the Apple Music API.
 * Uses node:crypto with P-256 ECDSA and IEEE-P1363 signature encoding,
 * which is the raw r||s format required by the JWT spec (not DER).
 */
export function generateAppleMusicDeveloperToken({ teamId, keyId, privateKey }) {
  if (!teamId || !keyId || !privateKey) {
    throw createAppleMusicError('apple_music_misconfigured', 'Apple Music teamId, keyId, and privateKey are required');
  }

  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + tokenLifetimeSeconds;

  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId }), 'utf8').toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp, iat, iss: teamId }), 'utf8').toString('base64url');
  const signingInput = `${header}.${payload}`;

  const sign = createSign('SHA256');
  sign.update(signingInput, 'utf8');
  sign.end();

  // dsaEncoding: 'ieee-p1363' produces the raw r||s format required by JWT (RFC 7518).
  const signature = sign.sign({ dsaEncoding: 'ieee-p1363', key: privateKey }, 'base64url');
  return { expiresAt: exp * 1000, token: `${signingInput}.${signature}` };
}

/** One cache per client; credentials and existing lifetime policy stay server-side. */
export function createAppleMusicDeveloperTokenService({ teamId, keyId, privateKey }) {
  // In-memory token cache is scoped to this client instance.
  let cachedToken = null;
  let tokenExpiresAt = 0;

  function getToken() {
    const now = Date.now();
    if (cachedToken && now < tokenExpiresAt - tokenRefreshBufferSeconds * 1000) {
      return cachedToken;
    }

    let signed;
    try { signed = generateAppleMusicDeveloperToken({ keyId, privateKey, teamId }); } catch {
      throw createAppleMusicError('apple_music_misconfigured', 'Apple Music signing credentials are invalid');
    }
    const { expiresAt, token } = signed;
    cachedToken = token;
    tokenExpiresAt = expiresAt;
    return cachedToken;
  }

  return { getToken };
}
