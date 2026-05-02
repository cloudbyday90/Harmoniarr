/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createHash, randomBytes } from 'node:crypto';
import { createApiError } from '../../auth.js';

export function createBase64UrlRandom(byteLength = 32) {
  return randomBytes(byteLength).toString('base64url');
}

export function createCodeChallenge(codeVerifier) {
  return createHash('sha256').update(codeVerifier).digest('base64url');
}

export function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function toTokenPayload({ body, now, previousRefreshToken = null }) {
  const expiresInSeconds = Number.parseInt(String(body.expires_in ?? 3600), 10);
  return {
    accessToken: body.access_token,
    expiresAt: new Date(now.getTime() + Math.max(1, expiresInSeconds) * 1000).toISOString(),
    refreshToken: body.refresh_token ?? previousRefreshToken,
    scope: body.scope ?? null,
    tokenType: body.token_type ?? 'Bearer',
  };
}

export function buildTokenMetadata(tokenPayload, extra = {}) {
  return {
    ...extra,
    expiresAt: tokenPayload.expiresAt,
    scope: tokenPayload.scope,
    tokenType: tokenPayload.tokenType,
  };
}

export async function readJsonResponse(response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

export function normalizeBaseUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const parsed = new URL(value.trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw createApiError(400, 'validation_error', 'system.baseUrl must use http or https');
  }

  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  return parsed.toString().replace(/\/+$/, '');
}

export function resolveRequestBaseUrl(requestMetadata = {}) {
  if (!requestMetadata.origin) {
    return null;
  }

  return normalizeBaseUrl(requestMetadata.origin);
}

export function buildRedirectUri({ baseUrlSetting, requestMetadata, callbackPath }) {
  const baseUrl = normalizeBaseUrl(baseUrlSetting ?? '') ?? resolveRequestBaseUrl(requestMetadata);
  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}${callbackPath}`;
}

export function createOAuthError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
}
