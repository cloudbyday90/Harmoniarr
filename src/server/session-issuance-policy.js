/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { randomUUID } from 'node:crypto';
import { createOpaqueToken, hashToken } from './security.js';
export const refreshTokenMaxAgeSeconds = 60 * 60 * 24 * 14;
export function createSessionMaterial(tokenFamilyId = randomUUID()) {
  const refreshToken = createOpaqueToken(32), csrfToken = createOpaqueToken(24);
  return { refreshToken, csrfToken, tokenHash: hashToken(refreshToken), csrfTokenHash: hashToken(csrfToken),
    tokenFamilyId, expiresAt: new Date(Date.now() + refreshTokenMaxAgeSeconds * 1000) };
}
export function toIssuedSession(material, refreshTokenId, user) {
  return { refreshToken: material.refreshToken, csrfToken: material.csrfToken, expiresAt: material.expiresAt,
    refreshTokenId, tokenFamilyId: material.tokenFamilyId, user };
}
