/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const collectionIntakeLimits = Object.freeze({ pages: 50, items: 1000, batch: 10, pageItems: 100, responseBytes: 2_000_000 });

export function collectionProtocolError(code = 'provider_collection_schema_invalid') {
  return Object.assign(new Error('Provider collection details require review before preparation can continue.'), { code, collectionBlocked: true });
}

export function requireProviderIdentifier(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]{1,200}$/.test(value)) throw collectionProtocolError();
  return value;
}

export function buildCollectionWorkKey(row) {
  return JSON.stringify([row.sourceProvider, row.ingestTargetType, row.sourceIdentifier, row.pageCursor ?? '']);
}

export function isCollectionSource(source) {
  return ['spotify', 'apple_music'].includes(source?.provider) && ['playlist', 'artist'].includes(source?.resourceType)
    || source?.provider === 'youtube' && source?.resourceType === 'playlist';
}

export function parseCollectionOffset(value) {
  const text = value ?? '0';
  if (typeof text !== 'string' || !/^(0|[1-9]\d*)$/.test(text) || !Number.isSafeInteger(Number(text))) throw collectionProtocolError('provider_collection_cursor_invalid');
  return Number(text);
}

export function parseCollectionNextCursor({ value, row, storefront }) {
  if (value === null || value === undefined) return null;
  if (row.sourceProvider === 'youtube') {
    if (typeof value !== 'string' || value.length === 0 || value.length > 2048 || [...value].some((character) => character.charCodeAt(0) <= 32)) throw collectionProtocolError('provider_collection_cursor_invalid');
    if (value === row.pageCursor) throw collectionProtocolError('provider_collection_cursor_cycle');
    return value;
  }
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) throw collectionProtocolError('provider_collection_cursor_invalid');
  const spotify = row.sourceProvider === 'spotify';
  const origin = spotify ? 'https://api.spotify.com' : 'https://api.music.apple.com';
  const resource = row.ingestTargetType === 'artist' ? 'artists' : 'playlists';
  const relationship = row.ingestTargetType === 'artist' ? 'albums' : spotify ? 'items' : 'tracks';
  const expectedPath = spotify ? `/v1/${resource}/${row.sourceIdentifier}/${relationship}`
    : `/v1/catalog/${storefront}/${resource}/${row.sourceIdentifier}/${relationship}`;
  let url;
  try { url = new URL(value, origin); } catch { throw collectionProtocolError('provider_collection_cursor_invalid'); }
  if (url.origin !== origin || url.pathname !== expectedPath || url.username || url.password || url.hash
    || url.searchParams.getAll('offset').length !== 1) throw collectionProtocolError('provider_collection_cursor_invalid');
  const offset = parseCollectionOffset(url.searchParams.get('offset'));
  if (offset <= parseCollectionOffset(row.pageCursor)) throw collectionProtocolError('provider_collection_cursor_cycle');
  return String(offset);
}

export function requireCollectionPageItems(value) {
  if (!Array.isArray(value) || value.length > collectionIntakeLimits.pageItems) throw collectionProtocolError();
  return value;
}
