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

// Merges ListenBrainz and MusicBrainz similar-artist lists into a single
// deduplicated list. When a MBID appears in both sources, the higher score wins
// and the source is recorded as 'both'. Returns items sorted descending by score,
// capped at `limit`.
export function mergeSimilarArtists(lbArtists, mbArtists, { limit }) {
  const byMbid = new Map();

  for (const artist of lbArtists) {
    if (!artist?.mbid) {
      continue;
    }

    const existing = byMbid.get(artist.mbid);
    if (!existing || artist.score > existing.score) {
      byMbid.set(artist.mbid, {
        id: artist.mbid,
        name: artist.name ?? null,
        score: artist.score,
        source: 'listenbrainz',
      });
    }
  }

  for (const artist of mbArtists) {
    if (!artist?.mbid) {
      continue;
    }

    const existing = byMbid.get(artist.mbid);
    if (!existing) {
      byMbid.set(artist.mbid, {
        id: artist.mbid,
        name: artist.name ?? null,
        score: artist.score,
        source: 'musicbrainz',
      });
    } else {
      // Record that this artist came from both sources.
      const merged = existing.score >= artist.score
        ? { ...existing, source: 'both' }
        : { ...existing, score: artist.score, source: 'both' };
      byMbid.set(artist.mbid, merged);
    }
  }

  return [...byMbid.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function createSimilarArtistsService({
  listenBrainzClient = createListenBrainzClient(),
  musicBrainzClient = createMusicBrainzClient(),
  cacheTtlMs = 24 * 60 * 60 * 1000,
  cache = null,
} = {}) {
  const ttlCache = cache ?? createSimilarArtistsCache(cacheTtlMs);

  // Returns { similar: [{ id, name, score, source }] } for the given artist MBID.
  // Both source fetches run in parallel. If one source fails, it is silently
  // excluded. Results are cached per MBID for cacheTtlMs milliseconds.
  async function getSimilarArtists({ artistMbid, limit = 20 }) {
    const cached = ttlCache.get(artistMbid);
    if (cached !== undefined) {
      return { similar: cached.slice(0, limit) };
    }

    // Fetch from both sources concurrently; individual failures are non-fatal.
    const [lbResult, mbResult] = await Promise.allSettled([
      listenBrainzClient.getSimilarArtists({ mbid: artistMbid, limit: 100 }),
      musicBrainzClient.lookupArtistRelations({ artistId: artistMbid }),
    ]);

    const lbArtists = lbResult.status === 'fulfilled' ? lbResult.value : [];
    const mbRelations = mbResult.status === 'fulfilled'
      ? (mbResult.value?.relations ?? [])
      : [];
    const mbArtists = extractMbRelatedArtists(mbRelations);

    // Cache up to 100 merged results; requests slice at serve time.
    const merged = mergeSimilarArtists(lbArtists, mbArtists, { limit: 100 });
    ttlCache.set(artistMbid, merged);

    return { similar: merged.slice(0, limit) };
  }

  return { getSimilarArtists };
}
