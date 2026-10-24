/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createApiError } from '../auth.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const QUALITY_REVIEW_MATCH_PAGE_SIZE = 12;
export const qualityReviewCursorChanged = () => createApiError(409, 'missing_music_match_page_changed',
  'Available matches have changed. Refresh this release to return to the first page.');

export function qualityReviewCursorContext(input, scope, revision) {
  return createHash('sha256').update(JSON.stringify({ actor: input.actorUserId ?? input.appUserId,
    role: input.actorRole ?? null, target: input.appUserId, wanted: input.wantedReleaseId,
    failed: scope.failedCandidate.id, search: scope.failedCandidate.sourceSearchId, revision,
    recipients: scope.wantedReleaseIds, policy: scope.requiredContext,
    participants: [...scope.participants].sort((a, b) => a.wantedReleaseId.localeCompare(b.wantedReleaseId)),
  })).digest('hex');
}

/** A continuation is authenticated navigation state, never selection authority. */
export function createQualityReviewCursorPolicy({ key = randomBytes(32), now = Date.now, ttlMs = 15 * 60_000 } = {}) {
  const sign = payload => createHmac('sha256', key).update(payload).digest();
  function encode({ anchor, direction, context, emptyFromStart = false, inclusive = false }) {
    const payload = Buffer.from(JSON.stringify({ v: 2, anchor, direction, context, emptyFromStart, inclusive, expires: now() + ttlMs })).toString('base64url');
    return `${payload}.${sign(payload).toString('base64url')}`;
  }
  function decode(cursor, context) {
    if (cursor == null) return { anchor: null, direction: 'next', emptyFromStart: true, inclusive: false };
    try {
      if (typeof cursor !== 'string' || cursor.length > 1024 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(cursor)) throw new Error();
      const [payload, signature] = cursor.split('.');
      const actual = Buffer.from(signature, 'base64url'); const expected = sign(payload);
      if (actual.toString('base64url') !== signature || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (data.v !== 2 || !UUID.test(data.anchor) || !['next', 'previous'].includes(data.direction)
        || typeof data.emptyFromStart !== 'boolean' || typeof data.inclusive !== 'boolean' || (data.emptyFromStart && data.direction !== 'next')
        || data.context !== context || !Number.isSafeInteger(data.expires) || data.expires <= now()) throw new Error();
      return { anchor: data.anchor, direction: data.direction, emptyFromStart: data.emptyFromStart, inclusive: data.inclusive };
    } catch { throw qualityReviewCursorChanged(); }
  }
  return { encode, decode };
}
