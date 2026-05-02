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

import { createApiError } from './auth.js';

export function skipRateLimitMiddleware(_request, _response, next) {
  next();
}

function defaultRequestKey(request) {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return request.socket?.remoteAddress ?? 'unknown';
}

export function createRequestRateLimiterService({
  now = () => Date.now(),
  onLimit = () => {},
} = {}) {
  const buckets = new Map();

  function getBucket(bucketName) {
    let bucket = buckets.get(bucketName);
    if (!bucket) {
      bucket = new Map();
      buckets.set(bucketName, bucket);
    }

    return bucket;
  }

  function consume({ bucketName, key, limit, windowMs }) {
    const bucket = getBucket(bucketName);
    const currentTime = now();
    const previousState = bucket.get(key);

    if (!previousState || previousState.resetAt <= currentTime) {
      const resetAt = currentTime + windowMs;
      const currentState = {
        count: 1,
        resetAt,
      };
      bucket.set(key, currentState);

      return {
        allowed: true,
        remaining: Math.max(0, limit - currentState.count),
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
      };
    }

    previousState.count += 1;

    return {
      allowed: previousState.count <= limit,
      remaining: Math.max(0, limit - previousState.count),
      resetAt: previousState.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((previousState.resetAt - currentTime) / 1000)),
    };
  }

  function createMiddleware({
    bucketName,
    keyFn = defaultRequestKey,
    limit,
    windowMs,
  }) {
    if (!bucketName) {
      throw new Error('bucketName is required');
    }

    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('limit must be a positive integer');
    }

    if (!Number.isInteger(windowMs) || windowMs < 1000) {
      throw new Error('windowMs must be an integer greater than or equal to 1000');
    }

    return function rateLimitMiddleware(request, response, next) {
      const key = keyFn(request);
      const result = consume({ bucketName, key, limit, windowMs });

      response.setHeader('RateLimit-Limit', String(limit));
      response.setHeader('RateLimit-Remaining', String(result.remaining));
      response.setHeader('RateLimit-Reset', String(result.retryAfterSeconds));

      if (result.allowed) {
        next();
        return;
      }

      response.setHeader('Retry-After', String(result.retryAfterSeconds));
      onLimit({
        bucketName,
        key,
        limit,
        request,
        retryAfterSeconds: result.retryAfterSeconds,
        windowMs,
      });
      next(createApiError(429, 'rate_limited', 'Too many requests. Try again later.'));
    };
  }

  return {
    createMiddleware,
  };
}