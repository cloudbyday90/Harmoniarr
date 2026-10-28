/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createApiError } from '../api-error.js';
import { FOLDER_CURSOR_LIMIT } from '../../shared/folder-browse-policy.js';

export const folderPageChanged = () => createApiError(409, 'folder_page_changed', 'Folder contents changed or this page expired. Start again to reload the folder.');

export function createFolderCursorPolicy({ key = randomBytes(32), now = Date.now } = {}) {
  const sign = payload => createHmac('sha256', key).update(payload).digest();
  function encode({ anchor, direction, context }) {
    const payload = Buffer.from(JSON.stringify({ v: 1, anchor, direction, context, expires: now() + 10 * 60_000 })).toString('base64url');
    return `${payload}.${sign(payload).toString('base64url')}`;
  }
  function decode(cursor) {
    if (cursor === undefined || cursor === null) return null;
    try {
      if (typeof cursor !== 'string' || cursor.length > FOLDER_CURSOR_LIMIT || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(cursor)) throw new Error();
      const [payload, signature] = cursor.split('.');
      const actual = Buffer.from(signature, 'base64url'), expected = sign(payload);
      if (actual.toString('base64url') !== signature || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (data.v !== 1 || typeof data.anchor !== 'string' || !data.anchor || data.anchor.length > 512 || data.anchor.includes('\0')
        || !['next', 'previous'].includes(data.direction) || !/^[a-f0-9]{64}$/u.test(data.context)
        || !Number.isSafeInteger(data.expires) || data.expires <= now()) throw new Error();
      return data;
    } catch { throw folderPageChanged(); }
  }
  return { encode, decode };
}
