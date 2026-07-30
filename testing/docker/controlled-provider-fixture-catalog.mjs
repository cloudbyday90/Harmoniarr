/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const fixtureArtistPrefix = 'Harmoniarr Fixture Artist';

function createFixture(index, { format, popularityTier, scenario }) {
  const id = `fixture-${String(index).padStart(2, '0')}`;
  const artistName = `${fixtureArtistPrefix} ${String(index).padStart(2, '0')}`;
  const releaseTitle = `Controlled ${format.toUpperCase()} release ${String(index).padStart(2, '0')}`;
  const filename = `track-${String(index).padStart(2, '0')}.${format}`;

  return Object.freeze({
    artistName,
    filename,
    format,
    id,
    popularityTier,
    releaseTitle,
    scenario,
    searchKey: `${artistName} ${releaseTitle}`,
    trackTitle: `Controlled track ${String(index).padStart(2, '0')}`,
  });
}

// Synthetic names and generated tones keep this test independent of copyrighted
// recordings and live peer availability. Popularity tiers exercise ranking data
// shapes only; they do not represent real artists.
export const controlledProviderFixtureCatalog = Object.freeze([
  createFixture(1, { format: 'flac', popularityTier: 'headliner', scenario: 'delayed_lossless' }),
  createFixture(2, { format: 'flac', popularityTier: 'headliner', scenario: 'lossless' }),
  createFixture(3, { format: 'alac', popularityTier: 'headliner', scenario: 'lossless' }),
  createFixture(4, { format: 'wav', popularityTier: 'headliner', scenario: 'lossless' }),
  createFixture(5, { format: 'mp3', popularityTier: 'headliner', scenario: 'high_quality_lossy' }),
  createFixture(6, { format: 'aac', popularityTier: 'established', scenario: 'high_quality_lossy' }),
  createFixture(7, { format: 'opus', popularityTier: 'established', scenario: 'high_quality_lossy' }),
  createFixture(8, { format: 'ogg', popularityTier: 'established', scenario: 'high_quality_lossy' }),
  createFixture(9, { format: 'flac', popularityTier: 'established', scenario: 'transcoded_lossless_claim' }),
  createFixture(10, { format: 'flac', popularityTier: 'established', scenario: 'locked_extra_file' }),
  createFixture(11, { format: 'flac', popularityTier: 'emerging', scenario: 'recovery_fallback' }),
  createFixture(12, { format: 'flac', popularityTier: 'emerging', scenario: 'completed_source_disappears' }),
  createFixture(13, { format: 'flac', popularityTier: 'emerging', scenario: 'quality_recovery' }),
  createFixture(14, { format: 'flac', popularityTier: 'emerging', scenario: 'quality_exhausted' }),
  createFixture(15, { format: 'flac', popularityTier: 'emerging', scenario: 'no_response' }),
]);

export function findControlledProviderFixtureBySearchText(searchText) {
  const normalizedSearchText = typeof searchText === 'string' ? searchText.toLowerCase() : '';
  return controlledProviderFixtureCatalog.find((fixture) => (
    normalizedSearchText.includes(fixture.artistName.toLowerCase())
      && normalizedSearchText.includes(fixture.releaseTitle.toLowerCase())
  )) ?? null;
}

export function buildControlledProviderFixtureFilename(fixture, { variant = 'primary' } = {}) {
  if (variant === 'fallback') {
    const extension = fixture.filename.split('.').at(-1);
    return `${fixture.filename.slice(0, -(extension.length + 1))}-fallback.${extension}`;
  }

  return fixture.filename;
}

export function buildControlledProviderRemoteFilename(fixture, { variant = 'primary' } = {}) {
  return `\\data\\downloads\\complete\\${fixture.id}-${variant}\\${buildControlledProviderFixtureFilename(fixture, { variant })}`;
}
