/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { buildCollectionWorkKey, collectionProtocolError, parseCollectionNextCursor, parseCollectionOffset, requireCollectionPageItems, requireProviderIdentifier } from './provider-collection-cursor-policy.js';

const text = (value) => typeof value === 'string' ? value.trim().slice(0, 500) : null;

function childWork({ row, id, kind, storefront }) {
  requireProviderIdentifier(id);
  const canonicalUrl = row.sourceProvider === 'spotify' ? `https://open.spotify.com/${kind === 'release' ? 'album' : 'track'}/${id}`
    : `https://music.apple.com/${storefront}/${kind === 'release' ? 'album' : 'song'}/${id}`;
  const child = {
    mediaRequestId: row.mediaRequestId, sourceProvider: row.sourceProvider, sourceResourceType: kind,
    ingestTargetType: kind, sourceIdentifier: id, canonicalUrl, pageCursor: null, pageNumber: 1,
    evidence: { storefront },
  };
  return { ...child, ingestKey: buildCollectionWorkKey(child) };
}

function unsupportedItem({ row, sourceIdentifier = null, title = null, reason, position }) {
  return {
    itemKey: sourceIdentifier ? `${row.sourceProvider}:unsupported:${sourceIdentifier}` : `unsupported:${row.ingestKey}:${position}`,
    sourceProvider: row.sourceProvider, sourceIdentifier, itemKind: 'unsupported', title: text(title), artistName: null,
    evidence: { reason },
  };
}

export function adaptProviderCollectionPage({ row, response, storefront }) {
  const derivedRequests = [];
  const items = [];
  const addAlbum = (album) => {
    const id = requireProviderIdentifier(album?.id);
    const attributes = album?.attributes ?? album;
    const work = childWork({ row, id, kind: 'release', storefront });
    derivedRequests.push(work);
    items.push({
      itemKey: `${row.sourceProvider}:release:${id}`, sourceProvider: row.sourceProvider, sourceIdentifier: id, itemKind: 'release',
      title: text(attributes.name), artistName: text(attributes.artistName)
        ?? (Array.isArray(album.artists) ? album.artists.map((artist) => text(artist?.name)).filter(Boolean).join(', ').slice(0, 500) : null),
      evidence: {}, workKey: work.ingestKey,
    });
  };
  const addSong = (song, position) => {
    if (!song || song.is_local || song.type === 'episode' || song.type === 'music-videos') {
      items.push(unsupportedItem({ row, position, title: song?.name ?? song?.attributes?.name, reason: 'unsupported_or_unavailable_entry' }));
      return;
    }
    if (!song.id) {
      items.push(unsupportedItem({ row, position, title: song.name, reason: 'missing_provider_identity' }));
      return;
    }
    if (row.sourceProvider === 'apple_music' && song.relationships?.albums?.next != null) throw collectionProtocolError('provider_collection_album_relationship_incomplete');
    const albums = row.sourceProvider === 'spotify' ? song.album ? [song.album] : [] : song.relationships?.albums?.data;
    if (Array.isArray(albums) && albums.length > 0) {
      for (const album of requireCollectionPageItems(albums)) addAlbum(album);
    } else {
      derivedRequests.push(childWork({ row, id: song.id, kind: 'track', storefront }));
    }
  };
  const containerPage = ['playlist_page', 'artist'].includes(row.ingestTargetType);
  let itemsSeen = 0;
  let nextValue = null;
  if (row.ingestTargetType === 'release') {
    const album = row.sourceProvider === 'apple_music' ? response?.data?.[0] : response;
    if (!album || String(album.id) !== row.sourceIdentifier) throw collectionProtocolError();
    const attributes = album.attributes ?? album;
    const artistName = text(attributes.artistName) ?? (Array.isArray(album.artists) ? album.artists.map((artist) => text(artist?.name)).filter(Boolean).join(', ').slice(0, 500) : null);
    if (!text(attributes.name) || !artistName) throw collectionProtocolError();
    items.push({ itemKey: `${row.sourceProvider}:release:${row.sourceIdentifier}`, sourceProvider: row.sourceProvider,
      sourceIdentifier: row.sourceIdentifier, itemKind: 'release', title: text(attributes.name), artistName, evidence: {}, workKey: row.ingestKey });
  } else if (row.ingestTargetType === 'track') {
    const song = row.sourceProvider === 'apple_music' ? response?.data?.[0] : response;
    if (!song || String(song.id) !== row.sourceIdentifier) throw collectionProtocolError();
    if (row.sourceProvider === 'apple_music' && song.relationships?.albums?.next != null) throw collectionProtocolError('provider_collection_album_relationship_incomplete');
    const albums = row.sourceProvider === 'spotify' ? song.album ? [song.album] : [] : song.relationships?.albums?.data;
    if (Array.isArray(albums) && albums.length > 0) {
      for (const album of requireCollectionPageItems(albums)) addAlbum(album);
    } else items.push(unsupportedItem({ row, sourceIdentifier: row.sourceIdentifier, title: song.name ?? song.attributes?.name, reason: 'album_relationship_unavailable' }));
  } else if (row.sourceProvider === 'spotify') {
    const pageItems = requireCollectionPageItems(response?.items);
    itemsSeen = pageItems.length;
    if (!Number.isSafeInteger(response?.total) || response.total < 0 || response.offset !== parseCollectionOffset(row.pageCursor)
      || !Object.hasOwn(response, 'next')) throw collectionProtocolError();
    if (response.offset + pageItems.length > response.total) throw collectionProtocolError('provider_collection_contents_invalid');
    if (response.next === null && response.offset + pageItems.length < response.total) throw collectionProtocolError('provider_collection_contents_missing');
    if (response.next !== null && pageItems.length === 0) throw collectionProtocolError('provider_collection_contents_missing');
    nextValue = response.next;
    if (row.ingestTargetType === 'artist') pageItems.forEach(addAlbum);
    else pageItems.forEach((entry, index) => { addSong(entry?.item ?? entry?.track, index); });
  } else if (row.sourceProvider === 'apple_music') {
    const pageItems = requireCollectionPageItems(response?.data);
    itemsSeen = pageItems.length;
    nextValue = response?.next;
    if (row.ingestTargetType === 'artist') pageItems.forEach(addAlbum);
    else pageItems.forEach(addSong);
  } else if (row.sourceProvider === 'youtube') {
    const pageItems = requireCollectionPageItems(response?.items);
    itemsSeen = pageItems.length;
    pageItems.forEach((entry, index) => {
      const videoId = entry?.snippet?.resourceId?.videoId;
      const membershipId = entry?.id ?? null;
      // Playlist membership IDs are opaque evidence, never interpolated into provider paths.
      if (membershipId !== null && (typeof membershipId !== 'string' || !membershipId || membershipId.length > 500)) throw collectionProtocolError();
      const item = unsupportedItem({ row, title: entry?.snippet?.title, position: index, reason: 'video_requires_explicit_exclusion' });
      items.push({ ...item, itemKey: membershipId ? `youtube:membership:${membershipId}` : item.itemKey,
        sourceIdentifier: videoId ? requireProviderIdentifier(videoId) : null, evidence: { ...item.evidence, playlistItemId: membershipId } });
    });
    nextValue = response?.nextPageToken;
  } else throw collectionProtocolError();

  const nextPageCursor = containerPage ? parseCollectionNextCursor({ value: nextValue, row, storefront }) : null;
  if (nextPageCursor !== null && row.sourceProvider !== 'youtube'
    && parseCollectionOffset(nextPageCursor) !== parseCollectionOffset(row.pageCursor) + itemsSeen) throw collectionProtocolError('provider_collection_cursor_gap');
  if (nextPageCursor !== null) {
    const next = { ...row, pageCursor: nextPageCursor, pageNumber: row.pageNumber + 1, evidence: { storefront } };
    next.ingestKey = buildCollectionWorkKey(next);
    derivedRequests.push(next);
  }
  return {
    containerPage, nextPageCursor, itemsSeen,
    derivedRequests: [...new Map(derivedRequests.map((request) => [request.ingestKey, request])).values()],
    items: [...new Map(items.map((item) => [item.itemKey, item])).values()],
  };
}
