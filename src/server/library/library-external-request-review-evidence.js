/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function text(value) {
  return typeof value === 'string' ? value.trim().slice(0, 500) : '';
}

// Provider data is display evidence. It never supplies a local release identity.
export function projectExternalRequestReviewItem(row) {
  const response = row.evidence?.response;
  const album = row.sourceProvider === 'apple_music' ? response?.data?.[0] : response;
  const attributes = row.sourceProvider === 'apple_music' ? album?.attributes : album;
  const title = text(attributes?.name);
  const artistName = row.sourceProvider === 'spotify'
    ? (Array.isArray(album?.artists) ? album.artists.map((artist) => text(artist?.name)).filter(Boolean).join(', ').slice(0, 500) : '')
    : text(attributes?.artistName);
  const count = attributes?.total_tracks ?? attributes?.trackCount;
  const trackCount = Number.isSafeInteger(count) && count >= 0 ? count : null;
  const supportedAlbum = ['spotify', 'apple_music'].includes(row.sourceProvider)
    && row.ingestTargetType === 'release' && row.sourceResourceType === 'release';
  return {
    id: row.id,
    providerKey: `${row.sourceProvider}:release:${row.sourceIdentifier}`,
    sourceProvider: row.sourceProvider,
    sourceIdentifier: row.sourceIdentifier,
    title: title || text(row.evidence?.albumName) || null,
    artistName: artistName || null,
    releaseDate: text(attributes?.release_date ?? attributes?.releaseDate) || null,
    trackCount,
    fetchedAt: text(row.evidence?.fetchedAt) || null,
    status: row.status,
    reviewable: supportedAlbum && row.status === 'completed'
      && String(album?.id ?? '') === row.sourceIdentifier && Boolean(title && artistName),
  };
}

export function buildExternalRequestPreparationState({ items, activeRun }) {
  const action = items.length === 0 ? 'plan'
    : items.some((item) => ['planned', 'failed'].includes(item.status)) ? 'execute' : null;
  return { canRecover: !activeRun && Boolean(action), action: activeRun ? null : action };
}
