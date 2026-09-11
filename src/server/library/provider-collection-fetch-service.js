/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { collectionIntakeLimits, collectionProtocolError, parseCollectionOffset } from './provider-collection-cursor-policy.js';

function snapshotVersion(snapshot, sourceIdentifier) {
  if (snapshot?.id !== sourceIdentifier || typeof snapshot.snapshot_id !== 'string' || !snapshot.snapshot_id || snapshot.snapshot_id.length > 500) throw collectionProtocolError('provider_collection_snapshot_invalid');
  return snapshot.snapshot_id;
}

export async function fetchProviderCollectionWork({ row, collection, clients, assertActive }) {
  const client = row.sourceProvider === 'apple_music' ? clients.appleMusic : clients[row.sourceProvider];
  if (!client) throw Object.assign(new Error('Provider is not configured'), { code: 'provider_collection_unavailable' });
  await assertActive();
  let response;
  let providerSnapshot = null;
  if (row.sourceProvider === 'spotify') {
    if (row.ingestTargetType === 'playlist_page') {
      const before = snapshotVersion(await client.getPlaylistSnapshot(row.sourceIdentifier), row.sourceIdentifier);
      if (collection.providerSnapshot && collection.providerSnapshot !== before) throw collectionProtocolError('provider_collection_snapshot_changed');
      await assertActive();
      response = await client.getPlaylistItems(row.sourceIdentifier, { offset: parseCollectionOffset(row.pageCursor), limit: 50 });
      await assertActive();
      const after = snapshotVersion(await client.getPlaylistSnapshot(row.sourceIdentifier), row.sourceIdentifier);
      if (before !== after) throw collectionProtocolError('provider_collection_snapshot_changed');
      providerSnapshot = after;
    } else if (row.ingestTargetType === 'artist') {
      response = await client.getArtistAlbums(row.sourceIdentifier, { offset: parseCollectionOffset(row.pageCursor), limit: 10 });
    } else if (row.ingestTargetType === 'release') response = await client.getAlbum(row.sourceIdentifier);
    else response = await client.getTrack(row.sourceIdentifier);
  } else if (row.sourceProvider === 'apple_music') {
    if (row.ingestTargetType === 'playlist_page') response = await client.getCatalogPlaylistTracks(collection.storefront, row.sourceIdentifier, { offset: parseCollectionOffset(row.pageCursor), limit: 100 });
    else if (row.ingestTargetType === 'artist') response = await client.getCatalogArtistAlbums(collection.storefront, row.sourceIdentifier, { offset: parseCollectionOffset(row.pageCursor), limit: 25 });
    else if (row.ingestTargetType === 'release') response = await client.getCatalogAlbum(collection.storefront, row.sourceIdentifier);
    else response = await client.getCatalogSong(collection.storefront, row.sourceIdentifier);
  } else response = await client.listPlaylistItems(row.sourceIdentifier, { pageToken: row.pageCursor, maxResults: 50 });
  await assertActive();
  if (!response || typeof response !== 'object' || Array.isArray(response)
    || Buffer.byteLength(JSON.stringify(response), 'utf8') > collectionIntakeLimits.responseBytes) throw collectionProtocolError();
  return { response, providerSnapshot };
}
