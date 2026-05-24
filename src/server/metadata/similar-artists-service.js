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

import { createLastFmClient } from '../integrations/lastfm/lastfm-client.js';
import { createListenBrainzClient } from '../integrations/listenbrainz/listenbrainz-client.js';
import { createMusicBrainzClient } from '../integrations/musicbrainz/musicbrainz-client.js';

// MusicBrainz artist-to-artist relationship types and their similarity weights.
// Lower-cased for case-insensitive matching against MB relation type strings.
const MB_RELATIONSHIP_WEIGHTS = new Map([
  ['similar artist', 0.7],
  ['influenced by', 0.5],
  ['collaboration', 0.4],
  ['member of band', 0.4],
]);

// Simple in-memory TTL cache keyed by MBID.
export function createSimilarArtistsCache(ttlMs) {
  const store = new Map();

  function get(key) {
    const entry = store.get(key);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return undefined;
    }

    return entry.data;
  }

  function set(key, data) {
    store.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  return { get, set };
}

// Extracts similar artists from a MusicBrainz artist-rels response.
// Each relation whose type matches MB_RELATIONSHIP_WEIGHTS produces one entry.
export function extractMbRelatedArtists(relations) {
  if (!Array.isArray(relations)) {
    return [];
  }

  const results = [];

  for (const rel of relations) {
    if (!rel || typeof rel.type !== 'string') {
      continue;
    }

    const weight = MB_RELATIONSHIP_WEIGHTS.get(rel.type.toLowerCase());
    if (weight == null) {
      continue;
    }

    // Artist-to-artist relations carry the other artist in rel.artist.
    const related = rel.artist;
    if (!related?.id || typeof related.id !== 'string') {
      continue;
    }

    results.push({
      mbid: related.id,
      name: typeof related.name === 'string' ? related.name : null,
      score: weight,
    });
  }

  return results;
}

export function mergeSimilarArtists(lbArtists, mbArtists, { limit }, lastfmArtists = []) {
  const byMbid = new Map();

  function insert(artist, sourceName) {
    if (!artist?.mbid) {
      return;
    }

    const existing = byMbid.get(artist.mbid);
    if (!existing) {
      byMbid.set(artist.mbid, {
        id: artist.mbid,
        name: artist.name ?? null,
        score: artist.score,
        source: sourceName,
      });
    } else {
      const merged = existing.score >= artist.score
        ? { ...existing, source: 'both' }
        : { ...existing, score: artist.score, source: 'both' };
      byMbid.set(artist.mbid, merged);
    }
  }

  for (const artist of lbArtists) {
    insert(artist, 'listenbrainz');
  }

  for (const artist of mbArtists) {
    insert(artist, 'musicbrainz');
  }

  for (const artist of lastfmArtists) {
    insert(artist, 'lastfm');
  }

  return [...byMbid.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function createSimilarArtistsService({
  lastFmClient = createLastFmClient(),
  listenBrainzClient = createListenBrainzClient(),
  musicBrainzClient = createMusicBrainzClient(),
  cacheTtlMs = 24 * 60 * 60 * 1000,
  cache = null,
} = {}) {
  const ttlCache = cache ?? createSimilarArtistsCache(cacheTtlMs);

  async function getSimilarArtists({ artistMbid, limit = 20 }) {
    const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
    const cached = ttlCache.get(artistMbid);
    if (cached !== undefined) {
      return { similar: cached.slice(0, safeLimit) };
    }

    const [lbResult, mbResult, lastfmResult] = await Promise.allSettled([
      listenBrainzClient.getSimilarArtists({ mbid: artistMbid, limit: 100 }),
      musicBrainzClient.lookupArtistRelations({ artistId: artistMbid }),
      lastFmClient.getSimilarArtists({ mbid: artistMbid, limit: 100 }),
    ]);

    const lbArtists = lbResult.status === 'fulfilled' ? lbResult.value : [];
    const mbRelations = mbResult.status === 'fulfilled'
      ? (mbResult.value?.relations ?? [])
      : [];
    const mbArtists = extractMbRelatedArtists(mbRelations);
    let lastfmArtists = lastfmResult.status === 'fulfilled' ? lastfmResult.value : [];

    if (lastfmArtists.length === 0 && mbResult.status === 'fulfilled') {
      const artistName = mbResult.value?.name;
      if (typeof artistName === 'string' && artistName.length > 0) {
        try {
          lastfmArtists = await lastFmClient.getSimilarArtists({ artistName, limit: 100 });
        } catch {
          // Fallback failure is non-fatal; proceed with empty Last.fm results.
        }
      }
    }

    const merged = mergeSimilarArtists(lbArtists, mbArtists, { limit: 100 }, lastfmArtists);
    ttlCache.set(artistMbid, merged);

    return { similar: merged.slice(0, safeLimit) };
  }

  return { getSimilarArtists };
}
