/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createHash } from 'node:crypto';
import { createApiError } from '../auth.js';

export const MISSING_MUSIC_PAGE_LIMIT = 50;
export const MISSING_MUSIC_MAX_PAGE_LIMIT = 100;
export const MISSING_MUSIC_MAX_SCAN_ROWS = 200;

export function normalizeMissingMusicPageLimit(value) {
  const parsed = Number.parseInt(String(value ?? MISSING_MUSIC_PAGE_LIMIT), 10);
  return Math.min(Math.max(Number.isInteger(parsed) ? parsed : MISSING_MUSIC_PAGE_LIMIT, 1), MISSING_MUSIC_MAX_PAGE_LIMIT);
}

export function assertMissingMusicCursorPagination(offset) {
  if (Number(offset ?? 0) !== 0) {
    throw createApiError(400, 'validation_error', 'Use cursor pagination to continue the Missing Music worklist.');
  }
}

export function buildMissingMusicCursorContext({ actorUserId, accountStatus, limit, scope, search, state, targetUserIds }) {
  return createHash('sha256').update(JSON.stringify({
    actorUserId, accountStatus, limit, scope, search: search?.toLowerCase() ?? null, state,
    targetUserIds: [...targetUserIds].sort(),
  })).digest('hex');
}

function invalidCursor() {
  return createApiError(400, 'missing_music_cursor_invalid', 'This worklist cursor is invalid or its filters changed. Return to the first page.');
}

function isTimestampKey(value) {
  if (typeof value !== 'string' || value.startsWith('0000-') || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/u.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 19) === value.slice(0, 19);
}

export function decodeMissingMusicCursor(cursor, context) {
  if (cursor === null || cursor === undefined || cursor === '') return null;
  if (typeof cursor !== 'string' || cursor.length > 1024 || !/^[A-Za-z0-9_-]+$/u.test(cursor)) throw invalidCursor();
  try {
    const decoded = Buffer.from(cursor, 'base64url');
    if (decoded.toString('base64url') !== cursor) throw invalidCursor();
    const value = JSON.parse(decoded.toString('utf8'));
    if (!value || Array.isArray(value) || typeof value !== 'object'
      || Object.keys(value).sort().join(',') !== 'c,f,i,v'
      || value.v !== 1 || value.f !== context || !isTimestampKey(value.c)
      || typeof value.i !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u.test(value.i)) throw invalidCursor();
    return { createdAtKey: value.c, id: value.i };
  } catch { throw invalidCursor(); }
}

export function encodeMissingMusicCursor(row, context) {
  return Buffer.from(JSON.stringify({ v: 1, f: context, c: row.createdAtKey, i: row.id })).toString('base64url');
}
