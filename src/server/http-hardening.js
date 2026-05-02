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

import express from 'express';

const jsonMediaType = 'application/json';
const jsonMediaTypeSuffix = '+json';
const defaultApiRequestBodyLimitBytes = 1024 * 1024;

function createHttpError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function parseBoolean(value, fallback = false) {
  if (value == null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid boolean value: ${value}`);
}

function isJsonContentType(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const mediaType = value.split(';', 1)[0]?.trim().toLowerCase();
  return mediaType === jsonMediaType || mediaType?.endsWith(jsonMediaTypeSuffix);
}

function acceptsJsonResponse(request) {
  const acceptHeader = request.headers.accept;
  if (typeof acceptHeader !== 'string' || !acceptHeader.trim()) {
    return true;
  }

  return acceptHeader
    .split(',')
    .map((value) => value.split(';', 1)[0]?.trim().toLowerCase())
    .some((value) => value === '*/*' || value === 'application/*' || value === jsonMediaType);
}

function hasRequestBody(request) {
  const contentLength = request.headers['content-length'];
  if (contentLength != null && Number(contentLength) > 0) {
    return true;
  }

  return typeof request.headers['transfer-encoding'] === 'string';
}

function shouldDisableApiCaching(request) {
  return request.path === '/api' || request.path.startsWith('/api/');
}

export function resolveApiRequestBodyLimitBytes(
  value = process.env.HARMONIARR_API_REQUEST_BODY_LIMIT_BYTES,
) {
  if (value == null || value === '') {
    return defaultApiRequestBodyLimitBytes;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1024 || parsed > 10 * 1024 * 1024) {
    throw new Error(
      'HARMONIARR_API_REQUEST_BODY_LIMIT_BYTES must be an integer between 1024 and 10485760',
    );
  }

  return parsed;
}

export function resolveStrictTransportSecurityEnabled(
  value = process.env.HARMONIARR_ENABLE_STRICT_TRANSPORT_SECURITY,
) {
  return parseBoolean(value, false);
}

function isSecureRequest(request) {
  if (request.secure || request.socket?.encrypted) {
    return true;
  }

  const forwardedProto = request.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    return forwardedProto.split(',')[0].trim().toLowerCase() === 'https';
  }

  return false;
}

export function createApiJsonBodyParser({
  bodyLimitBytes = resolveApiRequestBodyLimitBytes(),
} = {}) {
  return express.json({
    limit: bodyLimitBytes,
    type: ['application/json', 'application/*+json'],
  });
}

export function createBrowserSecurityHeadersMiddleware({
  enableStrictTransportSecurity = resolveStrictTransportSecurityEnabled(),
  policyResolver = null,
} = {}) {
  return function browserSecurityHeaders(request, response, next) {
    const effectivePolicy = policyResolver?.(request, response) ?? null;
    const strictTransportSecurityEnabled = effectivePolicy?.strictTransportSecurity
      ?? enableStrictTransportSecurity;

    if (shouldDisableApiCaching(request)) {
      response.setHeader('Cache-Control', 'no-store');
    }

    response.setHeader('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Origin-Agent-Cluster', '?1');
    response.setHeader('Permissions-Policy', 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');

    if (strictTransportSecurityEnabled) {
      response.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }

    next();
  };
}

export function createHttpsEnforcementMiddleware({
  enableHttpsEnforcement = false,
  policyResolver = null,
} = {}) {
  return function httpsEnforcement(request, response, next) {
    const effectivePolicy = policyResolver?.(request, response) ?? null;
    const httpsEnforcementEnabled = effectivePolicy?.enforceHttps ?? enableHttpsEnforcement;
    if (!httpsEnforcementEnabled || isSecureRequest(request) || request.path === '/healthz') {
      next();
      return;
    }

    const host = request.headers['x-forwarded-host'] ?? request.headers.host;
    if (typeof host !== 'string' || !host.trim()) {
      next(createHttpError(426, 'https_required', 'HTTPS is required'));
      return;
    }

    if (['GET', 'HEAD'].includes(request.method?.toUpperCase())) {
      const location = `https://${host}${request.originalUrl ?? request.url}`;
      response.redirect(307, location);
      return;
    }

    next(createHttpError(426, 'https_required', 'HTTPS is required'));
  };
}

export function createApiRequestContractMiddleware() {
  return function enforceApiRequestContract(request, _response, next) {
    if (!acceptsJsonResponse(request)) {
      next(createHttpError(406, 'not_acceptable', 'API responses are only available as application/json'));
      return;
    }

    const method = request.method?.toUpperCase();
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
      && hasRequestBody(request)
      && !isJsonContentType(request.headers['content-type'])
    ) {
      next(createHttpError(415, 'unsupported_media_type', 'API requests with a body must use application/json'));
      return;
    }

    next();
  };
}

export function normalizeApiParsingError(error) {
  if (error?.type === 'entity.parse.failed') {
    return createHttpError(400, 'invalid_json', 'Request body must contain valid JSON');
  }

  if (error?.type === 'entity.too.large') {
    return createHttpError(413, 'payload_too_large', 'Request body exceeds the supported size limit');
  }

  return error;
}