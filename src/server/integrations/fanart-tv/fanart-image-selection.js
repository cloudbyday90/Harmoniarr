/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

const artistImageTypes = ['artistthumb', 'artistbackground', 'hdmusiclogo', 'musiclogo'];
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function invalidAlbumResponse() {
  return Object.assign(new Error('Fanart.tv album response does not identify the requested release group'), {
    code: 'fanarttv_invalid_response', diagnosticCode: 'response_invalid',
    details: { retryable: false, status: 200 },
  });
}

function selectImages(response, imageTypes) {
  if (!isRecord(response)) return [];
  const results = [];
  for (const imageType of imageTypes) {
    if (!Array.isArray(response[imageType])) continue;
    const sorted = response[imageType]
      .filter(image => isRecord(image) && typeof image.url === 'string' && image.url.trim().length > 0)
      .sort((a, b) => (Number(b.likes) || 0) - (Number(a.likes) || 0));
    const image = sorted.find(candidate => candidate.lang === '' || candidate.lang == null) ?? sorted[0];
    if (image) results.push({ imageType, url: image.url, id: image.id, likes: Number(image.likes) || 0 });
  }
  return results;
}

export function selectArtistImages(response) {
  return selectImages(response, artistImageTypes);
}

function selectAlbumRecord(response, mbid) {
  if (!isRecord(response)) throw invalidAlbumResponse();
  if (!Object.hasOwn(response, 'albums')) {
    // Historical flat endpoint fixtures remain supported; never fall back here
    // from an invalid nested envelope or use the envelope's artist MBID.
    if (Object.hasOwn(response, 'release_group_id') && response.release_group_id !== mbid) throw invalidAlbumResponse();
    return response;
  }
  if (typeof mbid !== 'string' || mbid.length === 0) throw invalidAlbumResponse();
  const albums = response.albums;
  if (Array.isArray(albums)) {
    if (albums.length === 0) return null;
    if (albums.some(album => !isRecord(album) || typeof album.release_group_id !== 'string' || album.release_group_id.length === 0)) {
      throw invalidAlbumResponse();
    }
    const matches = albums.filter(album => album.release_group_id === mbid);
    if (matches.length !== 1) throw invalidAlbumResponse();
    return matches[0];
  }
  if (!isRecord(albums)) throw invalidAlbumResponse();
  if (Object.keys(albums).length === 0) return null;
  if (!Object.hasOwn(albums, mbid) || !isRecord(albums[mbid])) throw invalidAlbumResponse();
  const album = albums[mbid];
  if (Object.hasOwn(album, 'release_group_id') && album.release_group_id !== mbid) throw invalidAlbumResponse();
  return album;
}

export function selectAlbumImages(response, mbid) {
  if (response == null) return [];
  return selectImages(selectAlbumRecord(response, mbid), ['albumcover']);
}
