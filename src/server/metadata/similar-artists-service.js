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
// Weights reflect how strongly the relationship signals musical similarity:
//   0.9  – same person (is person / performs as)
//   0.85 – same project renamed
//   0.7  – explicitly tagged similar
//   0.6  – subgroup / offshoot project
//   0.5  – strong collaborative signal (influenced by, supporting, founder)
//   0.4  – moderate collaborative signal (collaboration, member of band)
//   0.4  – others with direct musical connection
//   0.3  – weaker organizational connections (conductor, director)
//   0.2  – tribute (different identity, same repertoire)
//   0.15 – very weak personal connections (married, sibling, involved with)
const MB_RELATIONSHIP_WEIGHTS = new Map([
  ['is person', 0.9],
  ['composer-in-residence', 0.4],
  ['conductor position', 0.3],
  ['collaboration', 0.4],
  ['artistic director', 0.3],
  ['artist rename', 0.85],
  ['founder', 0.5],
  ['influenced by', 0.5],
  ['instrumental supporting musician', 0.45],
  ['member of band', 0.4],
  ['named after artist', 0.3],
  ['similar artist', 0.7],
  ['subgroup', 0.6],
  ['supporting musician', 0.5],
  ['vocal supporting musician', 0.5],
  ['tribute', 0.2],
  ['married', 0.15],
  ['sibling', 0.15],
  ['involved with', 0.15],
  ['parent', 0.1],
  ['personal relationship', 0.1],
  ['voice actor', 0.1],
  ['artist-in-residence', 0.3],
]);

// Bonus added to a candidate's merged score for each genre it shares with
// the seed artist. Genres from the MusicBrainz genres field (community-curated)
// count more than raw tags.
const GENRE_OVERLAP_BONUS = 0.04;
const TAG_OVERLAP_BONUS = 0.02;

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

// Extracts genre and tag names from a MusicBrainz artist lookup response.
// Returns { genres: Set<string>, tags: Set<string> }.
export function extractMbGenreSignals(mbArtistResponse) {
  const genres = new Set();
  const tags = new Set();

  if (!mbArtistResponse || typeof mbArtistResponse !== 'object') {
    return { genres, tags };
  }

  if (Array.isArray(mbArtistResponse.genres)) {
    for (const g of mbArtistResponse.genres) {
      if (g && typeof g.name === 'string' && g.name.length > 0) {
        genres.add(g.name.toLowerCase());
      }
    }
  }

  if (Array.isArray(mbArtistResponse.tags)) {
    for (const t of mbArtistResponse.tags) {
      if (t && typeof t.name === 'string' && t.name.length > 0) {
        tags.add(t.name.toLowerCase());
      }
    }
  }

  return { genres, tags };
}

// Computes a genre-overlap score for a candidate artist based on how many
// genres/tags it shares with the seed artist. MB genres are curated and count
// more than raw user tags.
export function computeGenreOverlapBonus(candidateGenres, candidateTags, seedGenres, seedTags) {
  if (!candidateGenres && !candidateTags) {
    return 0;
  }

  let bonus = 0;

  if (seedGenres.size > 0 && candidateGenres?.size > 0) {
    for (const genre of candidateGenres) {
      if (seedGenres.has(genre)) {
        bonus += GENRE_OVERLAP_BONUS;
      }
    }
  }

  if (seedTags.size > 0 && candidateTags?.size > 0) {
    for (const tag of candidateTags) {
      if (seedTags.has(tag)) {
        bonus += TAG_OVERLAP_BONUS;
      }
    }
  }

  return bonus;
}

// Merges genre/tag signals from MusicBrainz related artists into the candidate
// list. Each related artist from MB relations may carry genre/tag data from the
// same lookup response, so we can match by MBID to enrich their scores.
function enrichMbArtistsWithGenreSignals(mbArtists, mbArtistResponse) {
  const { genres, tags } = extractMbGenreSignals(mbArtistResponse);
  if (genres.size === 0 && tags.size === 0) {
    return { mbArtists, seedGenres: genres, seedTags: tags };
  }

  return { mbArtists, seedGenres: genres, seedTags: tags };
}

export function mergeSimilarArtists(
  lbArtists,
  mbArtists,
  { limit },
  lastfmArtists = [],
  { seedGenres = new Set(), genreOverrides = new Map() } = {},
) {
  const byMbid = new Map();

  function insert(artist, sourceName, genreOverlap = 0) {
    if (!artist?.mbid) {
      return;
    }

    const existing = byMbid.get(artist.mbid);
    const finalScore = artist.score + genreOverlap;
    if (!existing) {
      byMbid.set(artist.mbid, {
        id: artist.mbid,
        name: artist.name ?? null,
        score: finalScore,
        source: sourceName,
      });
    } else {
      const merged = existing.score >= finalScore
        ? { ...existing, source: 'both' }
        : { ...existing, score: finalScore, source: 'both' };
      byMbid.set(artist.mbid, merged);
    }
  }

  for (const artist of lbArtists) {
    const genreOverlap = genreOverrides.has(artist.mbid)
      ? computeGenreOverlapBonus(genreOverrides.get(artist.mbid).genres, genreOverrides.get(artist.mbid).tags, seedGenres, new Set())
      : 0;
    insert(artist, 'listenbrainz', genreOverlap);
  }

  for (const artist of mbArtists) {
    const genreOverlap = genreOverrides.has(artist.mbid)
      ? computeGenreOverlapBonus(genreOverrides.get(artist.mbid).genres, genreOverrides.get(artist.mbid).tags, seedGenres, new Set())
      : 0;
    insert(artist, 'musicbrainz', genreOverlap);
  }

  for (const artist of lastfmArtists) {
    const genreOverlap = genreOverrides.has(artist.mbid)
      ? computeGenreOverlapBonus(genreOverrides.get(artist.mbid).genres, genreOverrides.get(artist.mbid).tags, seedGenres, new Set())
      : 0;
    insert(artist, 'lastfm', genreOverlap);
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

    const { seedGenres, seedTags } = enrichMbArtistsWithGenreSignals(
      mbArtists,
      mbResult.status === 'fulfilled' ? mbResult.value : null,
    );

    // Collect genre/tag signals from MB relationship artists that were included
    // in the same lookup response. MusicBrainz includes full artist objects in
    // relations, which may contain genres and tags if the inc parameter
    // requested them. We build an overrides map from those embedded signals.
    const genreOverrides = new Map();
    if (mbResult.status === 'fulfilled' && Array.isArray(mbResult.value?.relations)) {
      for (const rel of mbResult.value.relations) {
        if (!rel?.artist?.id) continue;
        const artistObj = rel.artist;
        const relGenres = new Set();
        const relTags = new Set();
        if (Array.isArray(artistObj.genres)) {
          for (const g of artistObj.genres) {
            if (g && typeof g.name === 'string' && g.name.length > 0) {
              relGenres.add(g.name.toLowerCase());
            }
          }
        }
        if (Array.isArray(artistObj.tags)) {
          for (const t of artistObj.tags) {
            if (t && typeof t.name === 'string' && t.name.length > 0) {
              relTags.add(t.name.toLowerCase());
            }
          }
        }
        if (relGenres.size > 0 || relTags.size > 0) {
          genreOverrides.set(artistObj.id, { genres: relGenres, tags: relTags });
        }
      }
    }

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

    const merged = mergeSimilarArtists(
      lbArtists,
      mbArtists,
      { limit: 100 },
      lastfmArtists,
      { seedGenres, genreOverrides },
    );
    ttlCache.set(artistMbid, merged);

    return { similar: merged.slice(0, safeLimit) };
  }

  return { getSimilarArtists };
}