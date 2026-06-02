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
    metadataReleaseGroupId: 'metadata-rg-tomorrows-harvest',
    metadataReleaseId: 'metadata-release-tomorrows-harvest',
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
    metadataReleaseGroupId: 'metadata-rg-saw-85-92',
    metadataReleaseId: 'metadata-release-saw-85-92',
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
  Object.freeze({
    artistName: 'Boards of Canada',
    duplicateTrackCount: 0,
    expectedTrackCount: 23,
    matchedFileCount: 18,
    matchedTrackCount: 18,
    metadataArtistId: 'metadata-artist-boards',
    metadataReleaseGroupId: 'metadata-rg-geogaddi',
    metadataReleaseId: 'metadata-release-geogaddi',
    missingTrackCount: 5,
    musicbrainzReleaseGroupId: 'mb-rg-geogaddi',
    musicbrainzReleaseId: 'mb-release-geogaddi-flac',
    reconciliationStatus: 'partial',
    releaseDate: '2002-02-18',
    releaseDisambiguation: null,
    releaseGroupType: 'Album',
    releaseTitle: 'Geogaddi',
    sourceFormats: ['FLAC'],
  }),
  Object.freeze({
    artistName: 'Autechre',
    duplicateFileCount: 3,
    duplicateTrackCount: 3,
    expectedTrackCount: 14,
    matchedFileCount: 17,
    matchedTrackCount: 14,
    metadataArtistId: 'metadata-artist-autechre',
    metadataReleaseGroupId: 'metadata-rg-tri-repetae',
    metadataReleaseId: 'metadata-release-tri-repetae',
    missingTrackCount: 0,
    musicbrainzReleaseGroupId: 'mb-rg-tri-repetae',
    musicbrainzReleaseId: 'mb-release-tri-repetae-flac',
    reconciliationStatus: 'duplicate',
    releaseDate: '1995-11-06',
    releaseDisambiguation: null,
    releaseGroupType: 'Album',
    releaseTitle: 'Tri Repetae',
    sourceFormats: ['FLAC'],
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
  const status = url.searchParams.get('status');
  let releases = [...libraryReleases];

  if (format) {
    const normalizedFormat = format.toUpperCase();
    releases = releases.filter((release) =>
      release.sourceFormats.some((sourceFormat) => sourceFormat.toUpperCase() === normalizedFormat),
    );
  }

  if (status) {
    releases = releases.filter((release) => release.reconciliationStatus === status);
  }

  return releases;
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

  await browserContext.route(/\/api\/v1\/metadata\/musicbrainz\/release-groups\/mb-rg-geogaddi\/tracklist(?:\?.*)?$/, async (route) => {
    await route.fulfill(buildJsonResponse({
      allReleases: [
        {
          country: 'GB',
          id: 'metadata-release-geogaddi',
          musicbrainzReleaseId: 'mb-release-geogaddi-flac',
          releaseDate: '2002-02-18',
          trackCount: 23,
        },
      ],
      media: [
        {
          format: 'CD',
          position: 1,
          title: null,
          tracks: [
            {
              isOwned: true,
              lengthMs: 147000,
              numberText: '1',
              position: 1,
              title: 'Ready Lets Go',
            },
            {
              isOwned: false,
              lengthMs: 360000,
              numberText: '2',
              position: 2,
              title: 'Music Is Math',
            },
          ],
        },
      ],
      ok: true,
      ownership: {
        expectedTrackCount: 23,
        matchedTrackCount: 18,
        releaseId: 'metadata-release-geogaddi',
      },
      release: {
        id: 'metadata-release-geogaddi',
        musicbrainzReleaseId: 'mb-release-geogaddi-flac',
        releaseDate: '2002-02-18',
        status: 'Official',
        title: 'Geogaddi',
        trackCount: 23,
      },
      requestState: { status: 'available' },
      source: 'local',
    }));
  });
}
