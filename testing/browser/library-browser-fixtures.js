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

const libraryReleases = Object.freeze([
  Object.freeze({
    artistName: 'Boards of Canada',
    duplicateTrackCount: 0,
    expectedTrackCount: 17,
    matchedFileCount: 17,
    matchedTrackCount: 17,
    metadataArtistId: 'metadata-artist-boards',
    missingTrackCount: 0,
    musicbrainzReleaseGroupId: 'mb-rg-tomorrows-harvest',
    musicbrainzReleaseId: 'mb-release-tomorrows-harvest-flac',
    reconciliationStatus: 'complete',
    releaseDate: '2013-06-05',
    releaseDisambiguation: null,
    releaseGroupType: 'Album',
    releaseTitle: "Tomorrow's Harvest",
    sourceFormats: ['FLAC'],
  }),
  Object.freeze({
    artistName: 'Aphex Twin',
    duplicateTrackCount: 0,
    expectedTrackCount: 10,
    matchedFileCount: 10,
    matchedTrackCount: 10,
    metadataArtistId: 'metadata-artist-aphex',
    missingTrackCount: 0,
    musicbrainzReleaseGroupId: 'mb-rg-saw-85-92',
    musicbrainzReleaseId: 'mb-release-saw-85-92-mp3',
    reconciliationStatus: 'complete',
    releaseDate: '1992-02-12',
    releaseDisambiguation: null,
    releaseGroupType: 'Album',
    releaseTitle: 'Selected Ambient Works 85-92',
    sourceFormats: ['MP3'],
  }),
]);

function buildJsonResponse(body, status = 200) {
  return {
    body: JSON.stringify(body),
    contentType: 'application/json',
    status,
  };
}

function filterLibraryReleases(url) {
  const format = url.searchParams.get('format');
  if (!format) return [...libraryReleases];

  const normalizedFormat = format.toUpperCase();
  return libraryReleases.filter((release) =>
    release.sourceFormats.some((sourceFormat) => sourceFormat.toUpperCase() === normalizedFormat),
  );
}

export async function installLibraryBrowserFixtures(browserContext) {
  await browserContext.route(/\/api\/v1\/library\/filter-options(?:\?.*)?$/, async (route) => {
    await route.fulfill(buildJsonResponse({
      formats: ['FLAC', 'MP3'],
      genres: [],
      ok: true,
    }));
  });

  await browserContext.route(/\/api\/v1\/library\/releases(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const releases = filterLibraryReleases(url);

    await route.fulfill(buildJsonResponse({
      limit: 500,
      offset: 0,
      ok: true,
      releases,
      total: releases.length,
    }));
  });

  await browserContext.route(/\/api\/v1\/artwork\/resolve-batch(?:\?.*)?$/, async (route) => {
    await route.fulfill(buildJsonResponse({
      ok: true,
      resolved: {},
    }));
  });
}
