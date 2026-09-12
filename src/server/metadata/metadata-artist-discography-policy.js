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

import { Buffer } from 'node:buffer';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function invalid(message) {
  return Object.assign(new Error(message), { status: 400, code: 'validation_error' });
}

export function encodeArtistDiscographyCursor(metadataArtistId, afterId) {
  return Buffer.from(JSON.stringify({ v: 1, artist: metadataArtistId, after: afterId })).toString('base64url');
}

export function normalizeArtistDiscographyPage({ metadataArtistId, limit = 25, cursor } = {}) {
  if (typeof metadataArtistId !== 'string' || !uuidPattern.test(metadataArtistId)) {
    throw invalid('artistId must be a UUID');
  }
  const artistId = metadataArtistId.toLowerCase();
  const pageLimit = typeof limit === 'string' && /^[1-9][0-9]?$/u.test(limit) ? Number(limit) : limit;
  if (!Number.isSafeInteger(pageLimit) || pageLimit < 1 || pageLimit > 25) {
    throw invalid('limit must be an integer between 1 and 25');
  }
  if (cursor === undefined) return { metadataArtistId: artistId, limit: pageLimit, afterId: null };
  if (typeof cursor !== 'string' || cursor.length > 512 || !/^[A-Za-z0-9_-]+$/u.test(cursor)) {
    throw invalid('cursor is invalid for this artist discography');
  }
  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalid('cursor is invalid for this artist discography');
  }
  if (decoded?.v !== 1 || decoded.artist !== artistId
    || typeof decoded.after !== 'string' || !uuidPattern.test(decoded.after)
    || encodeArtistDiscographyCursor(artistId, decoded.after) !== cursor) {
    throw invalid('cursor is invalid for this artist discography');
  }
  return { metadataArtistId: artistId, limit: pageLimit, afterId: decoded.after };
}
