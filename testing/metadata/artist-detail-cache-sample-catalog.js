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

/**
 * A deterministic query understood only by the browser fixture. It does not
 * reach a metadata provider or add records to a local walkthrough database.
 */
export const artistDetailCacheSampleSearchQuery = 'artist detail cache samples';

const artistDefinitions = [
  { name: 'Beyonc\u00e9', slug: 'beyonce', tier: 'widely_known' },
  { name: 'Daft Punk', slug: 'daft-punk', tier: 'widely_known' },
  { name: 'Radiohead', slug: 'radiohead', tier: 'widely_known' },
  { name: 'Kendrick Lamar', slug: 'kendrick-lamar', tier: 'widely_known' },
  { name: 'Taylor Swift', slug: 'taylor-swift', tier: 'widely_known' },
  { name: 'Miles Davis', slug: 'miles-davis', tier: 'widely_known' },
  { name: 'Fleetwood Mac', slug: 'fleetwood-mac', tier: 'widely_known' },
  { name: 'Nine Inch Nails', slug: 'nine-inch-nails', tier: 'widely_known' },
  { name: 'Bj\u00f6rk', slug: 'bjork', tier: 'widely_known' },
  { name: 'The Cure', slug: 'the-cure', tier: 'widely_known' },
  { name: 'Kaitlyn Aurelia Smith', slug: 'kaitlyn-aurelia-smith', tier: 'semi_known' },
  { name: 'Moor Mother', slug: 'moor-mother', tier: 'semi_known' },
  { name: 'Kiasmos', slug: 'kiasmos', tier: 'semi_known' },
  { name: 'Forest Swords', slug: 'forest-swords', tier: 'semi_known' },
  { name: 'Loraine James', slug: 'loraine-james', tier: 'semi_known' },
  { name: 'Makaya McCraven', slug: 'makaya-mccraven', tier: 'semi_known' },
  { name: 'Yaeji', slug: 'yaeji', tier: 'semi_known' },
  { name: 'Mdou Moctar', slug: 'mdou-moctar', tier: 'semi_known' },
  { name: 'Kelly Lee Owens', slug: 'kelly-lee-owens', tier: 'semi_known' },
  { name: 'BADBADNOTGOOD', slug: 'badbadnotgood', tier: 'semi_known' },
];

function createCacheSampleArtist(definition, index) {
  const musicBrainzArtistId = `fixture-cache-artist-${definition.slug}`;
  const localArtistId = `fixture-cache-local-artist-${definition.slug}`;
  const releaseGroupId = `fixture-cache-release-group-${definition.slug}`;
  const releaseGroupMbid = `fixture-cache-mb-release-group-${definition.slug}`;
  const releaseTitle = `${definition.name} local cache fixture`;
  const artist = Object.freeze({
    country: null,
    disambiguation: 'Deterministic local cache sample',
    id: musicBrainzArtistId,
    name: definition.name,
    type: 'Artist',
  });

  return Object.freeze({
    localPayload: Object.freeze({
      aliases: Object.freeze([]),
      artist: Object.freeze({
        beginDate: null,
        country: null,
        id: localArtistId,
        musicBrainzArtistId,
        name: definition.name,
        type: 'Artist',
      }),
      detectionEvents: Object.freeze([]),
      detectionEventsPageInfo: Object.freeze({
        hasMore: false,
        nextCursor: null,
      }),
      monitoring: Object.freeze({
        monitored: false,
      }),
      releaseGroups: Object.freeze([]),
      releases: Object.freeze([]),
    }),
    musicBrainzArtistId,
    recognitionTier: definition.tier,
    releaseGroups: Object.freeze([Object.freeze({
      artistCredit: definition.name,
      firstReleaseDate: `202${index % 6}-01-01`,
      id: releaseGroupId,
      musicbrainzReleaseGroupId: releaseGroupMbid,
      primaryType: 'Album',
      title: releaseTitle,
    })]),
    releaseTitle,
    searchResult: artist,
    slug: definition.slug,
  });
}

function createRelatedArtists(catalog) {
  return Object.freeze(catalog.map((sample, index) => Object.freeze({
    ...sample,
    relatedArtists: Object.freeze([1, 2, 3].map((offset) => {
      const relatedSample = catalog[(index + offset) % catalog.length];
      return Object.freeze({
        id: relatedSample.musicBrainzArtistId,
        name: relatedSample.searchResult.name,
        score: Number((1 - (offset * 0.1)).toFixed(2)),
        source: 'fixture',
      });
    })),
  })));
}

/**
 * Twenty local-only Artist Detail inputs: ten broadly recognisable and ten
 * semi-known names. Only names are representative; all IDs, artist metadata,
 * release titles, and similar-artist scores are synthetic. Artwork payloads
 * are intentionally omitted so the browser fixture exercises the fallback.
 */
export const artistDetailCacheSampleCatalog = createRelatedArtists(
  artistDefinitions.map(createCacheSampleArtist),
);

export const artistDetailCacheSampleTierCounts = Object.freeze({
  semi_known: artistDetailCacheSampleCatalog.filter((sample) => sample.recognitionTier === 'semi_known').length,
  widely_known: artistDetailCacheSampleCatalog.filter((sample) => sample.recognitionTier === 'widely_known').length,
});
