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

const COMMENT_TAG_HINTS = [
  { pattern: /\bcontemporary christian\b/i, tag: 'contemporary christian', weight: 0.58 },
  { pattern: /\bccm\b/i, tag: 'ccm', weight: 0.56 },
  { pattern: /\bchristian\b/i, tag: 'christian', weight: 0.54 },
  { pattern: /\bgospel\b/i, tag: 'gospel', weight: 0.5 },
  { pattern: /\bsinger-songwriter\b/i, tag: 'singer-songwriter', weight: 0.46 },
];

function normalizeSignalName(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function quoteLuceneTerm(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

function coerceArtistType(value) {
  const normalized = normalizeSignalName(value);
  return normalized == null ? null : normalized;
}

function createSignalSet(values) {
  const results = new Set();
  for (const value of values ?? []) {
    const normalized = normalizeSignalName(value?.name ?? value);
    if (normalized != null) {
      results.add(normalized);
    }
  }
  return results;
}

export function extractFallbackTagSignals(seedArtist) {
  const byTag = new Map();

  function upsert(tag, weight, source) {
    const normalizedTag = normalizeSignalName(tag);
    if (normalizedTag == null) {
      return;
    }

    const existing = byTag.get(normalizedTag);
    if (!existing || weight > existing.weight) {
      byTag.set(normalizedTag, {
        source,
        tag: normalizedTag,
        weight,
      });
    }
  }

  for (const genre of seedArtist?.genres ?? []) {
    upsert(genre?.name, 0.64, 'genre');
  }

  for (const tag of seedArtist?.tags ?? []) {
    upsert(tag?.name, 0.6, 'tag');
  }

  const disambiguation = typeof seedArtist?.disambiguation === 'string'
    ? seedArtist.disambiguation
    : '';
  for (const hint of COMMENT_TAG_HINTS) {
    if (hint.pattern.test(disambiguation)) {
      upsert(hint.tag, hint.weight, 'comment');
    }
  }

  return [...byTag.values()]
    .sort((a, b) => b.weight - a.weight || a.tag.localeCompare(b.tag));
}

export function createSeedSignalProfile(seedArtist) {
  const weightedSignals = extractFallbackTagSignals(seedArtist);
  const tags = createSignalSet(seedArtist?.tags);
  for (const signal of weightedSignals) {
    tags.add(signal.tag);
  }

  return {
    country: typeof seedArtist?.country === 'string'
      ? seedArtist.country.trim().toLowerCase()
      : null,
    genres: createSignalSet(seedArtist?.genres),
    tags,
    type: coerceArtistType(seedArtist?.type),
    weightedSignals,
  };
}

function buildSignalDescriptor(signals) {
  const tags = [...signals];
  const highestWeight = Math.max(...signals.map((signal) => signal.weight));
  return {
    tags: tags.map((signal) => signal.tag),
    weight: tags.length > 1
      ? Math.min(0.76, highestWeight + 0.12)
      : highestWeight,
  };
}

export function buildMusicBrainzFallbackQueries(seedArtist, { limit = 4 } = {}) {
  const profile = createSeedSignalProfile(seedArtist);
  const signalPool = profile.weightedSignals.slice(0, Math.max(2, limit));
  const queries = [];
  const seenQueries = new Set();

  function appendQuery(signalDescriptor) {
    const query = [
      ...signalDescriptor.tags.map((tag) => `tag:${quoteLuceneTerm(tag)}`),
      profile.country ? `country:${profile.country}` : null,
      profile.type ? `type:${profile.type}` : null,
    ].filter(Boolean).join(' AND ');

    if (!seenQueries.has(query)) {
      seenQueries.add(query);
      queries.push({
        query,
        signal: signalDescriptor,
      });
    }
  }

  for (let index = 0; index < signalPool.length - 1 && queries.length < limit; index += 1) {
    appendQuery(buildSignalDescriptor([
      signalPool[index],
      signalPool[index + 1],
    ]));
  }

  for (const signal of signalPool) {
    if (queries.length >= limit) {
      break;
    }
    appendQuery(buildSignalDescriptor([signal]));
  }

  return queries;
}

function createArtistSignalProfile(artist) {
  return {
    genres: createSignalSet(artist?.genres),
    tags: createSignalSet(artist?.tags),
  };
}

export function computeSignalOverlap(seedProfile, candidateArtist) {
  const candidateProfile = createArtistSignalProfile(candidateArtist);
  const matchedSignals = new Set();

  for (const genre of candidateProfile.genres) {
    if (seedProfile.genres.has(genre) || seedProfile.tags.has(genre)) {
      matchedSignals.add(genre);
    }
  }

  for (const tag of candidateProfile.tags) {
    if (seedProfile.genres.has(tag) || seedProfile.tags.has(tag)) {
      matchedSignals.add(tag);
    }
  }

  return {
    candidateProfile,
    count: matchedSignals.size,
    hasCandidateSignals: candidateProfile.genres.size > 0 || candidateProfile.tags.size > 0,
    matchedSignals,
  };
}

function createMusicBrainzSearchCandidate(artist, { score }) {
  return {
    mbid: artist.id,
    name: typeof artist.name === 'string' ? artist.name : null,
    score,
  };
}

function mergeCandidates(existing, candidate) {
  if (!existing) {
    return candidate;
  }

  if (candidate.score > existing.score) {
    return {
      ...candidate,
      score: Math.min(0.84, candidate.score + 0.03),
    };
  }

  return {
    ...existing,
    score: Math.min(0.84, existing.score + 0.03),
  };
}

export function scoreMusicBrainzFallbackCandidate(artist, signalDescriptor, seedProfile) {
  const rawScore = Number(artist?.score);
  const normalizedScore = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(rawScore / 100, 1))
    : 0;

  const overlap = computeSignalOverlap(seedProfile, artist);
  const overlapBonus = Math.min(0.16, overlap.count * 0.08);
  const multiSignalBonus = signalDescriptor.tags.length > 1 ? 0.04 : 0;

  return Math.min(
    0.84,
    (normalizedScore * signalDescriptor.weight) + overlapBonus + multiSignalBonus,
  );
}

function scoreListenBrainzRadioCandidate(candidate, overlap) {
  if (!overlap.hasCandidateSignals) {
    return candidate.score;
  }

  if (overlap.count === 0) {
    return Math.min(candidate.score, 0.34);
  }

  return Math.min(0.82, candidate.score + Math.min(0.16, overlap.count * 0.08));
}

export function createSimilarArtistsFallbackService({
  listenBrainzClient,
  musicBrainzClient,
} = {}) {
  async function getListenBrainzRadioFallback({ artistMbid, limit = 20, seedArtist = null }) {
    if (typeof listenBrainzClient?.getRadioSimilarArtists !== 'function') {
      return [];
    }

    let candidates;
    try {
      candidates = await listenBrainzClient.getRadioSimilarArtists({ mbid: artistMbid, limit });
    } catch {
      return [];
    }

    if (!seedArtist || typeof musicBrainzClient?.lookupArtistRelations !== 'function') {
      return candidates;
    }

    const seedProfile = createSeedSignalProfile(seedArtist);
    if (seedProfile.weightedSignals.length === 0) {
      return candidates;
    }

    const reranked = [];
    for (const candidate of candidates.slice(0, Math.min(limit, 10))) {
      try {
        const metadata = await musicBrainzClient.lookupArtistRelations({ artistId: candidate.mbid });
        const overlap = computeSignalOverlap(seedProfile, metadata);
        reranked.push({
          ...candidate,
          score: scoreListenBrainzRadioCandidate(candidate, overlap),
        });
      } catch {
        reranked.push(candidate);
      }
    }

    return reranked
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async function searchMusicBrainzFallbackArtists({
    artistMbid,
    seedArtist,
    limit = 20,
  }) {
    if (typeof musicBrainzClient?.searchArtists !== 'function' || !seedArtist) {
      return [];
    }

    const seedProfile = createSeedSignalProfile(seedArtist);
    const queries = buildMusicBrainzFallbackQueries(seedArtist);
    if (queries.length === 0) {
      return [];
    }

    const candidateMap = new Map();
    for (const { query, signal } of queries) {
      let payload;
      try {
        payload = await musicBrainzClient.searchArtists({
          dismax: false,
          limit: Math.min(Math.max(limit * 2, 10), 25),
          query,
        });
      } catch {
        continue;
      }

      for (const artist of payload?.artists ?? []) {
        if (typeof artist?.id !== 'string' || artist.id.length === 0 || artist.id === artistMbid) {
          continue;
        }

        const candidate = createMusicBrainzSearchCandidate(artist, {
          score: scoreMusicBrainzFallbackCandidate(artist, signal, seedProfile),
        });
        const existing = candidateMap.get(candidate.mbid);
        candidateMap.set(candidate.mbid, mergeCandidates(existing, candidate));
      }
    }

    return [...candidateMap.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  return {
    getListenBrainzRadioFallback,
    searchMusicBrainzFallbackArtists,
  };
}
