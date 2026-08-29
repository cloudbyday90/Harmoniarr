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

import {
  artistDetailCacheSampleCatalog,
  artistDetailCacheSampleSearchQuery,
} from '../metadata/artist-detail-cache-sample-catalog.js';

function buildArtworkKey(ownerType, ownerId, artworkRole = 'cover_front') {
  return `${ownerType}:${ownerId}:${artworkRole}`;
}

function buildArtworkDataUri(label, background, foreground = '#f6f8fb') {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">
      <rect width="240" height="240" fill="${background}" rx="24"/>
      <text
        x="120"
        y="128"
        fill="${foreground}"
        font-family="Arial, sans-serif"
        font-size="22"
        text-anchor="middle"
      >${label}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

const boardsOfCanadaArtist = {
  country: 'GB',
  disambiguation: 'Scottish electronic duo',
  id: 'mb-artist-boards',
  name: 'Boards of Canada',
  type: 'Group',
};

const autechreArtist = {
  country: 'GB',
  disambiguation: 'Electronic duo',
  id: 'mb-artist-autechre',
  name: 'Autechre',
  type: 'Group',
};

const tychoArtist = {
  country: 'US',
  disambiguation: 'Ambient electronic project',
  id: 'mb-artist-tycho',
  name: 'Tycho',
  type: 'Person',
};

const aphexTwinArtist = {
  country: 'GB',
  disambiguation: 'Electronic musician',
  id: 'mb-artist-aphex-twin',
  name: 'Aphex Twin',
  type: 'Person',
};

const musicHasTheRightToChildren = {
  artistCredit: 'Boards of Canada',
  date: '1998-04-20',
  id: 'mb-release-mhtrtc',
  releaseGroup: {
    id: 'mb-rg-mhtrtc',
    primaryType: 'Album',
  },
  status: 'Official',
  title: 'Music Has the Right to Children',
};

const amberReleaseResult = {
  artistCredit: 'Autechre',
  date: '1994-11-07',
  id: 'mb-release-amber',
  releaseGroup: {
    id: 'mb-rg-amber',
    primaryType: 'Album',
  },
  status: 'Official',
  title: 'Amber',
};

const selectedAmbientWorksReleaseResult = {
  artistCredit: 'Aphex Twin',
  date: '1992-02-12',
  id: 'mb-release-saw-85-92',
  releaseGroup: {
    id: 'mb-rg-saw-85-92',
    primaryType: 'Album',
  },
  status: 'Official',
  title: 'Selected Ambient Works 85-92',
};

const musicHasTheRightToChildrenRelease = {
  country: 'GB',
  id: 'metadata-release-mhtrtc',
  isCanonical: true,
  mediumCount: 1,
  musicbrainzReleaseId: musicHasTheRightToChildren.id,
  releaseDate: musicHasTheRightToChildren.date,
  status: 'Official',
  title: musicHasTheRightToChildren.title,
  trackCount: 3,
};

const musicHasTheRightToChildrenUsRelease = {
  country: 'US',
  id: 'metadata-release-mhtrtc-us',
  isCanonical: false,
  mediumCount: 1,
  musicbrainzReleaseId: 'mb-release-mhtrtc-us',
  releaseDate: '1998-08-20',
  status: 'Official',
  title: musicHasTheRightToChildren.title,
  trackCount: 4,
};

const musicHasTheRightToChildrenMedia = [
  {
    format: 'CD',
    position: 1,
    title: null,
    trackCount: 3,
    tracks: [
      {
        artistCredit: 'Boards of Canada',
        isOwned: true,
        lengthMs: 301000,
        numberText: '1',
        position: 1,
        recordingMbid: 'mb-recording-wildlife-analysis',
        title: 'Wildlife Analysis',
      },
      {
        artistCredit: 'Boards of Canada',
        isOwned: false,
        lengthMs: 143000,
        numberText: '2',
        position: 2,
        recordingMbid: 'mb-recording-an-eagle-in-your-mind',
        title: 'An Eagle in Your Mind',
      },
      {
        artistCredit: 'Boards of Canada',
        isOwned: false,
        lengthMs: 153000,
        numberText: '3',
        position: 3,
        recordingMbid: 'mb-recording-roygbiv',
        title: 'Roygbiv',
      },
    ],
  },
];

const musicHasTheRightToChildrenUsMedia = [
  {
    format: 'CD',
    position: 1,
    title: 'US edition',
    trackCount: 4,
    tracks: [
      {
        artistCredit: 'Boards of Canada',
        isOwned: false,
        lengthMs: 301000,
        numberText: '1',
        position: 1,
        recordingMbid: 'mb-recording-wildlife-analysis-us',
        title: 'Wildlife Analysis',
      },
      {
        artistCredit: 'Boards of Canada',
        isOwned: false,
        lengthMs: 143000,
        numberText: '2',
        position: 2,
        recordingMbid: 'mb-recording-an-eagle-in-your-mind-us',
        title: 'An Eagle in Your Mind',
      },
      {
        artistCredit: 'Boards of Canada',
        isOwned: false,
        lengthMs: 153000,
        numberText: '3',
        position: 3,
        recordingMbid: 'mb-recording-roygbiv-us',
        title: 'Roygbiv',
      },
      {
        artistCredit: 'Boards of Canada',
        isOwned: false,
        lengthMs: 366000,
        numberText: '4',
        position: 4,
        recordingMbid: 'mb-recording-left-side-drive-us',
        title: 'Left Side Drive',
      },
    ],
  },
];

const geogaddiRelease = {
  country: 'GB',
  id: 'metadata-release-geogaddi',
  isCanonical: true,
  mediumCount: 1,
  musicbrainzReleaseId: 'mb-release-geogaddi',
  releaseDate: '2002-11-18',
  status: 'Official',
  title: 'Geogaddi',
  trackCount: 1,
};

const hiScoresReleaseGroup = {
  artistCredit: 'Boards of Canada',
  firstReleaseDate: '1996-12-01',
  id: 'metadata-rg-hi-scores',
  musicbrainzReleaseGroupId: 'mb-rg-hi-scores',
  primaryType: 'EP',
  title: 'Hi Scores',
};

const twoismReleaseGroup = {
  artistCredit: 'Boards of Canada',
  firstReleaseDate: '1995-08-01',
  id: 'metadata-rg-twoism',
  musicbrainzReleaseGroupId: 'mb-rg-twoism',
  primaryType: 'EP',
  title: 'Twoism',
};

const hiScoresRelease = {
  country: 'GB',
  id: 'metadata-release-hi-scores',
  isCanonical: true,
  mediumCount: 1,
  musicbrainzReleaseId: 'mb-release-hi-scores',
  releaseDate: hiScoresReleaseGroup.firstReleaseDate,
  status: 'Official',
  title: hiScoresReleaseGroup.title,
  trackCount: 1,
};

const twoismRelease = {
  country: 'GB',
  id: 'metadata-release-twoism',
  isCanonical: true,
  mediumCount: 1,
  musicbrainzReleaseId: 'mb-release-twoism',
  releaseDate: twoismReleaseGroup.firstReleaseDate,
  status: 'Official',
  title: twoismReleaseGroup.title,
  trackCount: 1,
};

function buildSingleTrackMedia({ artistCredit, lengthMs, numberText = '1', recordingMbid, title }) {
  return [{
    format: 'CD',
    position: 1,
    title: null,
    trackCount: 1,
    tracks: [{
      artistCredit,
      isOwned: false,
      lengthMs,
      numberText,
      position: 1,
      recordingMbid,
      title,
    }],
  }];
}

function resolveTracklistPayload(tracklistsByReleaseGroupId, releaseGroupId, searchParams = new URLSearchParams()) {
  const baseTracklist = tracklistsByReleaseGroupId[releaseGroupId] ?? null;
  if (!baseTracklist) return null;

  const { editionsByReleaseId, ...basePayload } = baseTracklist;
  const preferReleaseId = searchParams.get('preferReleaseId');
  if (preferReleaseId && editionsByReleaseId?.[preferReleaseId]) {
    return {
      ...basePayload,
      ...editionsByReleaseId[preferReleaseId],
    };
  }

  return basePayload;
}

const metadataFixture = {
  artistDetailCacheSampleCatalog,
  artistDetailCacheSampleSearchQuery,
  artistSearchResults: {
    'boards of canada': [boardsOfCanadaArtist],
    'fixture electronic': [boardsOfCanadaArtist, autechreArtist, aphexTwinArtist, tychoArtist],
    'music has the right to children': [boardsOfCanadaArtist],
  },
  artworkResponses: {
    [buildArtworkKey('musicbrainz_artist', boardsOfCanadaArtist.id, 'artist_background')]: {
      assetId: 'asset-boards-bg',
      dominantColor: { chroma: 0.09, hex: '#102533', hue: 236, lightness: 0.24 },
      url: buildArtworkDataUri('Boards', '#102533'),
    },
    [buildArtworkKey('musicbrainz_artist', boardsOfCanadaArtist.id, 'artist_thumbnail')]: {
      assetId: 'asset-boards-thumb',
      dominantColor: { chroma: 0.12, hex: '#1f3b4d', hue: 235, lightness: 0.34 },
      url: buildArtworkDataUri('BoC', '#1f3b4d'),
    },
    [buildArtworkKey('musicbrainz_artist', autechreArtist.id, 'artist_thumbnail')]: {
      assetId: 'asset-autechre-thumb',
      dominantColor: { chroma: 0.13, hex: '#42324d', hue: 320, lightness: 0.31 },
      url: buildArtworkDataUri('Ae', '#42324d'),
    },
    [buildArtworkKey('musicbrainz_artist', tychoArtist.id, 'artist_thumbnail')]: {
      assetId: 'asset-tycho-thumb',
      dominantColor: { chroma: 0.08, hex: '#274a36', hue: 156, lightness: 0.36 },
      url: buildArtworkDataUri('Ty', '#274a36'),
    },
    [buildArtworkKey('musicbrainz_artist', aphexTwinArtist.id, 'artist_thumbnail')]: {
      assetId: 'asset-aphex-thumb',
      dominantColor: { chroma: 0.1, hex: '#4d3431', hue: 12, lightness: 0.33 },
      url: buildArtworkDataUri('AT', '#4d3431'),
    },
    [buildArtworkKey('musicbrainz_release_group', musicHasTheRightToChildren.releaseGroup.id, 'cover_front')]: {
      assetId: 'asset-mhtrtc-rg',
      dominantColor: { chroma: 0.1, hex: '#654224', hue: 62, lightness: 0.41 },
      url: buildArtworkDataUri('MHTRTC', '#654224'),
    },
    [buildArtworkKey('musicbrainz_release', musicHasTheRightToChildren.id, 'cover_front')]: {
      assetId: 'asset-mhtrtc-release',
      dominantColor: { chroma: 0.1, hex: '#654224', hue: 62, lightness: 0.41 },
      url: buildArtworkDataUri('MHTRTC', '#654224'),
    },
    [buildArtworkKey('musicbrainz_release_group', 'mb-rg-geogaddi', 'cover_front')]: {
      assetId: 'asset-geogaddi-rg',
      dominantColor: { chroma: 0.11, hex: '#4d3431', hue: 12, lightness: 0.33 },
      url: buildArtworkDataUri('Geogaddi', '#4d3431'),
    },
    [buildArtworkKey('musicbrainz_release_group', hiScoresReleaseGroup.musicbrainzReleaseGroupId, 'cover_front')]: {
      assetId: 'asset-hi-scores-rg',
      dominantColor: { chroma: 0.1, hex: '#243f65', hue: 224, lightness: 0.39 },
      url: buildArtworkDataUri('Hi Scores', '#243f65'),
    },
    [buildArtworkKey('musicbrainz_release_group', twoismReleaseGroup.musicbrainzReleaseGroupId, 'cover_front')]: {
      assetId: 'asset-twoism-rg',
      dominantColor: { chroma: 0.12, hex: '#4b5330', hue: 74, lightness: 0.37 },
      url: buildArtworkDataUri('Twoism', '#4b5330'),
    },
  },
  boardsLocalArtistPayload: {
    aliases: [],
    artist: {
      beginDate: '1986-01-01',
      country: 'GB',
      id: 'metadata-artist-boards',
      musicBrainzArtistId: boardsOfCanadaArtist.id,
      name: boardsOfCanadaArtist.name,
      type: boardsOfCanadaArtist.type,
    },
    detectionEvents: [],
    detectionEventsPageInfo: {
      hasMore: false,
      nextCursor: null,
    },
    monitoring: {
      monitored: true,
    },
    releaseGroups: [],
    releases: [],
  },
  autechreLocalArtistPayload: {
    aliases: [],
    artist: {
      beginDate: '1987-01-01',
      country: 'GB',
      id: 'metadata-artist-autechre',
      musicBrainzArtistId: autechreArtist.id,
      name: autechreArtist.name,
      type: autechreArtist.type,
    },
    detectionEvents: [],
    detectionEventsPageInfo: {
      hasMore: false,
      nextCursor: null,
    },
    monitoring: {
      monitored: true,
    },
    releaseGroups: [],
    releases: [],
  },
  boardsReleaseGroups: [
    {
      artistCredit: 'Boards of Canada',
      firstReleaseDate: '1998-04-20',
      id: 'metadata-rg-mhtrtc',
      musicbrainzReleaseGroupId: 'mb-rg-mhtrtc',
      primaryType: 'Album',
      title: 'Music Has the Right to Children',
    },
    {
      artistCredit: 'Boards of Canada',
      firstReleaseDate: '2002-11-18',
      id: 'metadata-rg-geogaddi',
      musicbrainzReleaseGroupId: 'mb-rg-geogaddi',
      primaryType: 'Album',
      title: 'Geogaddi',
    },
    hiScoresReleaseGroup,
    twoismReleaseGroup,
  ],
  relatedArtistsById: {
    [boardsOfCanadaArtist.id]: {
      similar: [
        { id: autechreArtist.id, name: autechreArtist.name, score: 0.96, source: 'musicbrainz' },
        { id: tychoArtist.id, name: tychoArtist.name, score: 0.72, source: 'musicbrainz' },
        { id: aphexTwinArtist.id, name: aphexTwinArtist.name, score: 0.65, source: 'musicbrainz' },
      ],
    },
    [autechreArtist.id]: {
      similar: [
        { id: aphexTwinArtist.id, name: aphexTwinArtist.name, score: 0.95, source: 'musicbrainz' },
        { id: tychoArtist.id, name: tychoArtist.name, score: 0.45, source: 'musicbrainz' },
      ],
    },
    [aphexTwinArtist.id]: { similar: [] },
    [tychoArtist.id]: { similar: [] },
  },
  releaseSearchResults: {
    'boards of canada': [musicHasTheRightToChildren],
    'fixture electronic': [
      musicHasTheRightToChildren,
      amberReleaseResult,
      selectedAmbientWorksReleaseResult,
    ],
    'music has the right to children': [musicHasTheRightToChildren],
  },
  users: [
    {
      id: 'fixture-admin-user',
      isDisabled: false,
      mediaRequestTarget: { eligible: true },
      role: 'admin',
      username: 'admin',
    },
    {
      id: 'fixture-listener-user',
      isDisabled: false,
      mediaRequestTarget: { eligible: true },
      role: 'requester',
      username: 'listener',
    },
  ],
  tracklistsByReleaseGroupId: {
    'mb-rg-geogaddi': {
      allReleases: [geogaddiRelease],
      media: [{
        format: 'CD',
        position: 1,
        title: null,
        trackCount: 1,
        tracks: [{
          artistCredit: 'Boards of Canada',
          isOwned: false,
          lengthMs: 384000,
          numberText: '1',
          position: 1,
          recordingMbid: 'mb-recording-ready-lets-go',
          title: 'Ready Lets Go',
        }],
      }],
      ok: true,
      ownership: null,
      release: geogaddiRelease,
      requestState: null,
      source: 'local',
    },
    'mb-rg-mhtrtc': {
      allReleases: [musicHasTheRightToChildrenRelease, musicHasTheRightToChildrenUsRelease],
      editionsByReleaseId: {
        [musicHasTheRightToChildrenUsRelease.id]: {
          media: musicHasTheRightToChildrenUsMedia,
          ownership: null,
          release: musicHasTheRightToChildrenUsRelease,
        },
      },
      media: musicHasTheRightToChildrenMedia,
      ok: true,
      ownership: {
        expectedTrackCount: 3,
        matchedTrackCount: 1,
        reconciliationStatus: 'partial',
      },
      release: musicHasTheRightToChildrenRelease,
      requestState: null,
      source: 'local',
    },
    'mb-rg-hi-scores': {
      allReleases: [hiScoresRelease],
      media: buildSingleTrackMedia({
        artistCredit: 'Boards of Canada',
        lengthMs: 374000,
        recordingMbid: 'mb-recording-hi-scores',
        title: 'Hi Scores',
      }),
      ok: true,
      ownership: null,
      release: hiScoresRelease,
      requestState: null,
      source: 'local',
    },
    'mb-rg-twoism': {
      allReleases: [twoismRelease],
      media: buildSingleTrackMedia({
        artistCredit: 'Boards of Canada',
        lengthMs: 398000,
        recordingMbid: 'mb-recording-twoism',
        title: 'Twoism',
      }),
      ok: true,
      ownership: null,
      release: twoismRelease,
      requestState: null,
      source: 'local',
    },
    'metadata-rg-geogaddi': {
      allReleases: [geogaddiRelease],
      media: [{
        format: 'CD',
        position: 1,
        title: null,
        trackCount: 1,
        tracks: [{
          artistCredit: 'Boards of Canada',
          isOwned: false,
          lengthMs: 384000,
          numberText: '1',
          position: 1,
          recordingMbid: 'mb-recording-ready-lets-go',
          title: 'Ready Lets Go',
        }],
      }],
      ok: true,
      ownership: null,
      release: geogaddiRelease,
      requestState: null,
      source: 'local',
    },
    'metadata-rg-hi-scores': {
      allReleases: [hiScoresRelease],
      media: buildSingleTrackMedia({
        artistCredit: 'Boards of Canada',
        lengthMs: 374000,
        recordingMbid: 'mb-recording-hi-scores',
        title: 'Hi Scores',
      }),
      ok: true,
      ownership: null,
      release: hiScoresRelease,
      requestState: null,
      source: 'local',
    },
    'metadata-rg-mhtrtc': {
      allReleases: [musicHasTheRightToChildrenRelease, musicHasTheRightToChildrenUsRelease],
      editionsByReleaseId: {
        [musicHasTheRightToChildrenUsRelease.id]: {
          media: musicHasTheRightToChildrenUsMedia,
          ownership: null,
          release: musicHasTheRightToChildrenUsRelease,
        },
      },
      media: musicHasTheRightToChildrenMedia,
      ok: true,
      ownership: {
        expectedTrackCount: 3,
        matchedTrackCount: 1,
        reconciliationStatus: 'partial',
      },
      release: musicHasTheRightToChildrenRelease,
      requestState: null,
      source: 'local',
    },
    'metadata-rg-twoism': {
      allReleases: [twoismRelease],
      media: buildSingleTrackMedia({
        artistCredit: 'Boards of Canada',
        lengthMs: 398000,
        recordingMbid: 'mb-recording-twoism',
        title: 'Twoism',
      }),
      ok: true,
      ownership: null,
      release: twoismRelease,
      requestState: null,
      source: 'local',
    },
  },
};

export async function markBoardsOfCanadaAddedInMetadataBrowserFixture(page) {
  await page.evaluate(() => {
    const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
    const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
    const state = rawState ? JSON.parse(rawState) : {};
    const addedArtistIds = new Set(Array.isArray(state.addedArtistIds) ? state.addedArtistIds : []);
    addedArtistIds.add('mb-artist-boards');
    globalThis.sessionStorage.setItem(fixtureStateStorageKey, JSON.stringify({
      ...state,
      addedArtistIds: [...addedArtistIds],
      boardsIsAdded: true,
    }));
  });
}

export async function markBoardsTrackOverrideReviewNeededInMetadataBrowserFixture(page) {
  await page.evaluate(() => {
    const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
    const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
    const state = rawState ? JSON.parse(rawState) : {};
    globalThis.sessionStorage.setItem(fixtureStateStorageKey, JSON.stringify({
      ...state,
      boardsTrackOverrideReviewNeeded: true,
    }));
  });
}

export async function readMetadataBrowserFixtureState(page) {
  return page.evaluate(() => {
    const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
    const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
    return rawState ? JSON.parse(rawState) : {};
  });
}

export async function queueMetadataMediaRequestFailure(page, failure = {}) {
  await page.evaluate((queuedFailure) => {
    const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
    const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
    const state = rawState ? JSON.parse(rawState) : {};
    const failures = Array.isArray(state.mediaRequestFailures)
      ? state.mediaRequestFailures
      : [];
    globalThis.sessionStorage.setItem(fixtureStateStorageKey, JSON.stringify({
      ...state,
      mediaRequestFailures: [...failures, queuedFailure],
    }));
  }, failure);
}

export async function queueMetadataMediaRequestCancellationFailure(page, failure = {}) {
  await page.evaluate((queuedFailure) => {
    const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
    const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
    const state = rawState ? JSON.parse(rawState) : {};
    const failures = Array.isArray(state.mediaRequestCancellationFailures)
      ? state.mediaRequestCancellationFailures
      : [];
    globalThis.sessionStorage.setItem(fixtureStateStorageKey, JSON.stringify({
      ...state,
      mediaRequestCancellationFailures: [...failures, queuedFailure],
    }));
  }, failure);
}

export async function markMetadataMediaRequestCancelled(page, mediaRequestId) {
  await page.evaluate((requestId) => {
    const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
    const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
    const state = rawState ? JSON.parse(rawState) : {};
    const timestamp = new Date().toISOString();
    const mediaRequests = Array.isArray(state.mediaRequests)
      ? state.mediaRequests
      : [];
    globalThis.sessionStorage.setItem(fixtureStateStorageKey, JSON.stringify({
      ...state,
      mediaRequests: mediaRequests.map((mediaRequest) =>
        mediaRequest.id === requestId
          ? {
            ...mediaRequest,
            cancelledChildCount: mediaRequest.cancelledChildCount ?? 0,
            requestState: 'cancelled',
            updatedAt: timestamp,
          }
          : mediaRequest,
      ),
    }));
  }, mediaRequestId);
}

export async function seedMetadataMediaRequestEvents(page, mediaRequestId, eventPage = {}) {
  await page.evaluate(({ pageRequestId, pageEventConfig }) => {
    const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
    const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
    const state = rawState ? JSON.parse(rawState) : {};
    const eventsById = state.mediaRequestEventsById && typeof state.mediaRequestEventsById === 'object'
      ? state.mediaRequestEventsById
      : {};
    globalThis.sessionStorage.setItem(fixtureStateStorageKey, JSON.stringify({
      ...state,
      mediaRequestEventsById: {
        ...eventsById,
        [pageRequestId]: {
          events: Array.isArray(pageEventConfig.events) ? pageEventConfig.events : [],
          hasMore: Boolean(pageEventConfig.hasMore ?? pageEventConfig.nextCursor),
          nextCursor: pageEventConfig.nextCursor ?? null,
          pages: pageEventConfig.pages && typeof pageEventConfig.pages === 'object'
            ? pageEventConfig.pages
            : {},
        },
      },
    }));
  }, { pageEventConfig: eventPage, pageRequestId: mediaRequestId });
}

export async function updateMetadataMediaRequest(page, mediaRequestId, patch = {}) {
  await page.evaluate(({ pagePatch, pageRequestId }) => {
    const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
    const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
    const state = rawState ? JSON.parse(rawState) : {};
    const mediaRequests = Array.isArray(state.mediaRequests)
      ? state.mediaRequests
      : [];
    const timestamp = new Date().toISOString();
    globalThis.sessionStorage.setItem(fixtureStateStorageKey, JSON.stringify({
      ...state,
      mediaRequests: mediaRequests.map((mediaRequest) =>
        mediaRequest.id === pageRequestId
          ? {
            ...mediaRequest,
            ...pagePatch,
            updatedAt: pagePatch.updatedAt ?? timestamp,
          }
          : mediaRequest,
      ),
    }));
  }, { pagePatch: patch, pageRequestId: mediaRequestId });
}

export async function seedMetadataMediaRequestPipeline(page, mediaRequestId, pipeline = {}) {
  await page.evaluate(({ pagePipeline, pageRequestId }) => {
    const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
    const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
    const state = rawState ? JSON.parse(rawState) : {};
    const pipelineById = state.mediaRequestPipelineById && typeof state.mediaRequestPipelineById === 'object'
      ? state.mediaRequestPipelineById
      : {};
    globalThis.sessionStorage.setItem(fixtureStateStorageKey, JSON.stringify({
      ...state,
      mediaRequestPipelineById: {
        ...pipelineById,
        [pageRequestId]: {
          candidates: Array.isArray(pagePipeline.candidates) ? pagePipeline.candidates : [],
        },
      },
    }));
  }, { pagePipeline: pipeline, pageRequestId: mediaRequestId });
}

export async function seedMetadataImportReviewWorkspace(page, workspace = {}) {
  await page.evaluate((pageWorkspace) => {
    const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
    const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
    const state = rawState ? JSON.parse(rawState) : {};
    globalThis.sessionStorage.setItem(fixtureStateStorageKey, JSON.stringify({
      ...state,
      importReviewApplyPreviewById: pageWorkspace.applyPreviewById
        && typeof pageWorkspace.applyPreviewById === 'object'
        ? pageWorkspace.applyPreviewById
        : {},
      importReviewApplySummary: pageWorkspace.applySummary ?? null,
      importReviewCandidates: Array.isArray(pageWorkspace.candidates)
        ? pageWorkspace.candidates
        : [],
      importReviewExecutionSummary: pageWorkspace.executionSummary ?? null,
      importReviewMediaInspectionSummary: pageWorkspace.mediaInspectionSummary ?? null,
      importReviewPreviewById: pageWorkspace.previewById
        && typeof pageWorkspace.previewById === 'object'
        ? pageWorkspace.previewById
        : {},
      importReviewRunActions: Array.isArray(pageWorkspace.runActions)
        ? pageWorkspace.runActions
        : [],
      importReviewRunFailures: Array.isArray(pageWorkspace.runFailures)
        ? pageWorkspace.runFailures
        : [],
    }));
  }, workspace);
}

export async function queueMetadataImportReviewTransitionFailure(page, failure = {}) {
  await page.evaluate((queuedFailure) => {
    const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
    const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
    const state = rawState ? JSON.parse(rawState) : {};
    const failures = Array.isArray(state.importReviewTransitionFailures)
      ? state.importReviewTransitionFailures
      : [];
    globalThis.sessionStorage.setItem(fixtureStateStorageKey, JSON.stringify({
      ...state,
      importReviewTransitionFailures: [...failures, queuedFailure],
    }));
  }, failure);
}

export async function queueMetadataImportReviewRunFailure(page, failure = {}) {
  await page.evaluate((queuedFailure) => {
    const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
    const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
    const state = rawState ? JSON.parse(rawState) : {};
    const failures = Array.isArray(state.importReviewRunFailures)
      ? state.importReviewRunFailures
      : [];
    globalThis.sessionStorage.setItem(fixtureStateStorageKey, JSON.stringify({
      ...state,
      importReviewRunFailures: [...failures, queuedFailure],
    }));
  }, failure);
}

export async function queueMetadataImportReviewExecutionReconciliation(page, reconciliation = {}) {
  await page.evaluate((queuedReconciliation) => {
    const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
    const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
    const state = rawState ? JSON.parse(rawState) : {};
    const reconciliations = Array.isArray(state.importReviewExecutionReconciliations)
      ? state.importReviewExecutionReconciliations
      : [];
    globalThis.sessionStorage.setItem(fixtureStateStorageKey, JSON.stringify({
      ...state,
      importReviewExecutionReconciliations: [...reconciliations, queuedReconciliation],
    }));
  }, reconciliation);
}

export async function markMetadataReleaseRequestLinked(page, requestKey) {
  await page.evaluate((key) => {
    const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
    const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
    const state = rawState ? JSON.parse(rawState) : {};
    const requestedReleaseKeys = new Set(Array.isArray(state.requestedReleaseKeys)
      ? state.requestedReleaseKeys
      : []);
    requestedReleaseKeys.add(key);
    globalThis.sessionStorage.setItem(fixtureStateStorageKey, JSON.stringify({
      ...state,
      requestedReleaseKeys: [...requestedReleaseKeys],
    }));
  }, requestKey);
}

export async function installMetadataBrowserFixtures(browserContext, {
  artistDetailLocalDelayMs = 0,
  includeArtistDetailCacheSamples = false,
  similarArtistsDelayMs = 0,
} = {}) {
  await browserContext.addInitScript(({
    artistDetailLocalDelayMs: configuredArtistDetailLocalDelayMs,
    fixture,
    includeArtistDetailCacheSamples: includeCacheSamples,
    similarArtistsDelayMs: configuredSimilarArtistsDelayMs,
  }) => {
    const originalFetch = globalThis.fetch.bind(globalThis);
    const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
    const state = loadFixtureState();

    async function delayFixtureResponse(delayMs, input, init) {
      if (delayMs <= 0) {
        return;
      }

      const requestSignal = init?.signal
        ?? (input instanceof Request ? input.signal : null);
      if (requestSignal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }

      await new Promise((resolve, reject) => {
        let timer;
        const onAbort = () => {
          globalThis.clearTimeout(timer);
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        };
        const complete = () => {
          requestSignal?.removeEventListener('abort', onAbort);
          resolve();
        };

        timer = globalThis.setTimeout(complete, delayMs);
        requestSignal?.addEventListener('abort', onAbort, { once: true });
      });
    }

    function delaySimilarArtistsResponse(input, init) {
      return delayFixtureResponse(configuredSimilarArtistsDelayMs, input, init);
    }

    function delayArtistDetailLocalResponse(input, init) {
      return delayFixtureResponse(configuredArtistDetailLocalDelayMs, input, init);
    }

    function getArtistFixtureEntries() {
      const artistFixtures = [
        {
          localPayload: fixture.boardsLocalArtistPayload,
          musicBrainzArtistId: 'mb-artist-boards',
          releaseGroups: fixture.boardsReleaseGroups,
        },
        {
          localPayload: fixture.autechreLocalArtistPayload,
          musicBrainzArtistId: 'mb-artist-autechre',
          releaseGroups: [],
        },
      ];

      return includeCacheSamples
        ? [...artistFixtures, ...fixture.artistDetailCacheSampleCatalog]
        : artistFixtures;
    }

    function getArtistFixtureByMusicBrainzId(musicBrainzArtistId) {
      return getArtistFixtureEntries()
        .find((entry) => entry.musicBrainzArtistId === musicBrainzArtistId) ?? null;
    }

    function getArtistFixtureByLocalId(localArtistId) {
      return getArtistFixtureEntries()
        .find((entry) => entry.localPayload.artist.id === localArtistId) ?? null;
    }

    function getDefaultMonitoring() {
      return {
        acquisitionProfileKey: 'balanced_library',
        isMonitored: true,
        monitoredReleaseGroupTypes: ['album', 'ep'],
        releaseScope: 'future_only',
        searchOnAddMode: 'none',
        selectionSourceMode: 'policy_only',
        wantedAutomationMode: 'future_matching',
      };
    }

    function createInitialFixtureState() {
      const operatorProjectionsByMusicBrainzId = {};
      for (const artistFixture of getArtistFixtureEntries()) {
        operatorProjectionsByMusicBrainzId[artistFixture.musicBrainzArtistId] = buildOperatorProjection({
          artistFixture,
          monitoring: getDefaultMonitoring(),
          reconciliationStatus: 'idle',
          releaseGroupSelections: [],
          trackOverrides: [],
        });
      }

      return {
        addedArtistIds: [],
        activityEvents: [],
        autechreIsAdded: false,
        boardsIsAdded: false,
        boardsOperatorProjection: operatorProjectionsByMusicBrainzId['mb-artist-boards'],
        boardsTrackOverrideReviewNeeded: false,
        importReviewApplyPreviewById: {},
        importReviewApplySummary: null,
        importReviewCandidates: [],
        importReviewExecutionSummary: null,
        importReviewExecutionReconciliations: [],
        importReviewMediaInspectionSummary: null,
        importReviewPreviewById: {},
        importReviewRunActions: [],
        importReviewRunFailures: [],
        importReviewTransitionFailures: [],
        mediaRequestCancellationFailures: [],
        mediaRequestEventsById: {},
        mediaRequestFailures: [],
        mediaRequestPipelineById: {},
        mediaRequests: [],
        operatorSaveCount: 0,
        operatorProjectionsByMusicBrainzId,
        requestedReleaseKeys: [],
        userListFetchCount: 0,
      };
    }

    function applyBoardsTrackOverrideReviewState(sourceState = {}) {
      if (!sourceState.boardsTrackOverrideReviewNeeded) {
        return sourceState;
      }

      const projection = sourceState.operatorProjectionsByMusicBrainzId?.['mb-artist-boards'];
      if (!projection) {
        return sourceState;
      }

      const trackOverride = {
        isDesired: false,
        mediumPosition: 1,
        metadataReleaseGroupId: 'metadata-rg-mhtrtc',
        metadataReleaseId: 'metadata-release-mhtrtc',
        recordingMbid: 'mb-recording-roygbiv',
        remapStatus: 'review_needed',
        trackLengthMsSnapshot: 153000,
        trackMbid: null,
        trackPosition: 3,
        trackTitleSnapshot: 'Roygbiv',
      };
      const trackOverrides = [
        ...(projection.operator?.trackOverrides ?? [])
          .filter((override) => override.recordingMbid !== trackOverride.recordingMbid),
        trackOverride,
      ];
      const releaseGroups = (projection.releaseGroups ?? []).map((releaseGroup) => {
        if (releaseGroup.id !== trackOverride.metadataReleaseGroupId) {
          return releaseGroup;
        }

        const releaseGroupTrackOverrides = trackOverrides
          .filter((override) => override.metadataReleaseGroupId === releaseGroup.id);

        return {
          ...releaseGroup,
          operatorState: {
            ...releaseGroup.operatorState,
            trackOverrideSummary: {
              desiredCount: releaseGroupTrackOverrides
                .filter((override) => override.isDesired === true)
                .length,
              orphanedCount: releaseGroupTrackOverrides
                .filter((override) => override.remapStatus === 'orphaned')
                .length,
              reviewNeededCount: releaseGroupTrackOverrides
                .filter((override) => override.remapStatus === 'review_needed')
                .length,
              suppressedCount: releaseGroupTrackOverrides
                .filter((override) => override.isDesired === false)
                .length,
              totalCount: releaseGroupTrackOverrides.length,
            },
          },
        };
      });
      const nextProjection = {
        ...projection,
        operator: {
          ...projection.operator,
          overview: {
            ...projection.operator.overview,
            hasManualOverrides: true,
            reviewNeededTrackOverrideCount: trackOverrides
              .filter((override) => override.remapStatus === 'review_needed')
              .length,
            suppressedTrackOverrideCount: trackOverrides
              .filter((override) => override.isDesired === false)
              .length,
            trackOverrideCount: trackOverrides.length,
          },
          trackOverrides,
        },
        releaseGroups,
      };

      return {
        ...sourceState,
        boardsOperatorProjection: nextProjection,
        operatorProjectionsByMusicBrainzId: {
          ...sourceState.operatorProjectionsByMusicBrainzId,
          'mb-artist-boards': nextProjection,
        },
      };
    }

    function loadFixtureState() {
      try {
        const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
        if (rawState) {
          return applyBoardsTrackOverrideReviewState({
            ...createInitialFixtureState(),
            ...JSON.parse(rawState),
          });
        }
      } catch {
        // Fall through to a clean state when storage is unavailable or stale.
      }

      return applyBoardsTrackOverrideReviewState(createInitialFixtureState());
    }

    function persistFixtureState() {
      globalThis.sessionStorage.setItem(fixtureStateStorageKey, JSON.stringify({
        addedArtistIds: getAddedArtistIds(),
        activityEvents: Array.isArray(state.activityEvents) ? state.activityEvents : [],
        autechreIsAdded: state.autechreIsAdded,
        boardsIsAdded: state.boardsIsAdded,
        boardsOperatorProjection: state.boardsOperatorProjection,
        boardsTrackOverrideReviewNeeded: state.boardsTrackOverrideReviewNeeded,
        importReviewApplyPreviewById: state.importReviewApplyPreviewById,
        importReviewApplySummary: state.importReviewApplySummary,
        importReviewCandidates: state.importReviewCandidates,
        importReviewExecutionSummary: state.importReviewExecutionSummary,
        importReviewExecutionReconciliations: Array.isArray(state.importReviewExecutionReconciliations)
          ? state.importReviewExecutionReconciliations
          : [],
        importReviewMediaInspectionSummary: state.importReviewMediaInspectionSummary,
        importReviewPreviewById: state.importReviewPreviewById,
        importReviewRunActions: state.importReviewRunActions,
        importReviewRunFailures: state.importReviewRunFailures,
        importReviewTransitionFailures: state.importReviewTransitionFailures,
        mediaRequestCancellationFailures: state.mediaRequestCancellationFailures,
        mediaRequestEventsById: state.mediaRequestEventsById,
        mediaRequestFailures: state.mediaRequestFailures,
        mediaRequestPipelineById: state.mediaRequestPipelineById,
        mediaRequests: state.mediaRequests,
        operatorSaveCount: state.operatorSaveCount,
        operatorProjectionsByMusicBrainzId: state.operatorProjectionsByMusicBrainzId,
        requestedReleaseKeys: state.requestedReleaseKeys,
        userListFetchCount: state.userListFetchCount,
      }));
    }

    function buildJsonResponse(body, status = 200) {
      return new Response(JSON.stringify(body), {
        headers: {
          'Content-Type': 'application/json',
        },
        status,
      });
    }

    function normalizeSearchKey(value) {
      return String(value ?? '').trim().toLowerCase();
    }

    function buildFixtureArtworkKey(ownerType, ownerId, artworkRole = 'cover_front') {
      return `${ownerType}:${ownerId}:${artworkRole}`;
    }

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function parseJsonBody(input, init) {
      const rawBody = init?.body
        ?? (typeof input === 'object' && input !== null && 'body' in input ? input.body : '{}');
      return JSON.parse(typeof rawBody === 'string' ? rawBody : '{}');
    }

    function normalizeRequestKeyPart(value) {
      return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    function buildMediaRequestFixtureKey(payload) {
      if (payload.musicbrainzReleaseId) {
        return `release:${payload.musicbrainzReleaseId}`;
      }
      if (payload.releaseGroupId) {
        return `release-group:${payload.releaseGroupId}`;
      }
      return [
        'text',
        normalizeRequestKeyPart(payload.artistName),
        normalizeRequestKeyPart(payload.releaseTitle),
        payload.expectedReleaseDate ? String(payload.expectedReleaseDate).slice(0, 4) : '',
      ].join(':');
    }

    function consumeMediaRequestFailure(payload) {
      const failures = Array.isArray(state.mediaRequestFailures)
        ? state.mediaRequestFailures
        : [];
      const requestKey = buildMediaRequestFixtureKey(payload);
      const failureIndex = failures.findIndex((failure) =>
        !failure?.requestKey
        || failure.requestKey === requestKey
        || failure.releaseTitle === payload.releaseTitle,
      );
      if (failureIndex < 0) {
        return null;
      }

      const [failure] = failures.splice(failureIndex, 1);
      state.mediaRequestFailures = failures;
      persistFixtureState();
      return failure;
    }

    function consumeMediaRequestCancellationFailure(mediaRequestId) {
      const failures = Array.isArray(state.mediaRequestCancellationFailures)
        ? state.mediaRequestCancellationFailures
        : [];
      const failureIndex = failures.findIndex((failure) =>
        !failure?.mediaRequestId || failure.mediaRequestId === mediaRequestId,
      );
      if (failureIndex < 0) {
        return null;
      }

      const [failure] = failures.splice(failureIndex, 1);
      state.mediaRequestCancellationFailures = failures;
      persistFixtureState();
      return failure;
    }

    function consumeImportReviewTransitionFailure(importCandidateId, action) {
      const failures = Array.isArray(state.importReviewTransitionFailures)
        ? state.importReviewTransitionFailures
        : [];
      const failureIndex = failures.findIndex((failure) =>
        (!failure?.importCandidateId || failure.importCandidateId === importCandidateId)
        && (!failure?.action || failure.action === action),
      );
      if (failureIndex < 0) {
        return null;
      }

      const [failure] = failures.splice(failureIndex, 1);
      state.importReviewTransitionFailures = failures;
      persistFixtureState();
      return failure;
    }

    function consumeImportReviewRunFailure(action) {
      const failures = Array.isArray(state.importReviewRunFailures)
        ? state.importReviewRunFailures
        : [];
      const failureIndex = failures.findIndex((failure) =>
        !failure?.action || failure.action === action,
      );
      if (failureIndex < 0) {
        return null;
      }

      const [failure] = failures.splice(failureIndex, 1);
      state.importReviewRunFailures = failures;
      persistFixtureState();
      return failure;
    }

    function consumeImportReviewExecutionReconciliation() {
      const reconciliations = Array.isArray(state.importReviewExecutionReconciliations)
        ? state.importReviewExecutionReconciliations
        : [];
      if (reconciliations.length < 1) {
        return null;
      }

      const [reconciliation, ...remainingReconciliations] = reconciliations;
      state.importReviewExecutionReconciliations = remainingReconciliations;
      return reconciliation;
    }

    function updateImportReviewRecentRuns(recentRuns, run) {
      const runs = Array.isArray(recentRuns) ? recentRuns : [];
      const filteredRuns = runs.filter((recentRun) => recentRun?.id !== run?.id);
      return run ? [run, ...filteredRuns] : filteredRuns;
    }

    function applyImportReviewExecutionCandidateStatuses(candidateStatuses) {
      if (!candidateStatuses || typeof candidateStatuses !== 'object') {
        return;
      }

      const workspace = getImportReviewWorkspaceState();
      state.importReviewCandidates = workspace.candidates.map((candidate) => {
        const nextStatus = candidateStatuses[candidate.id];
        return nextStatus
          ? {
            ...candidate,
            status: nextStatus,
            updatedAt: new Date().toISOString(),
          }
          : candidate;
      });
    }

    async function resolveCurrentSessionUser() {
      try {
        const response = await originalFetch('/api/v1/auth/session', {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) return null;
        const sessionPayload = await response.json();
        return sessionPayload?.user ?? null;
      } catch {
        return null;
      }
    }

    function resolveFixtureUser(userId) {
      if (!userId) return null;
      return fixture.users.find((user) => user.id === userId) ?? null;
    }

    function normalizeRequestUser(user, fallback = {}) {
      if (!user) {
        return {
          id: fallback.id ?? null,
          role: fallback.role ?? null,
          username: fallback.username ?? null,
        };
      }

      return {
        id: user.id ?? fallback.id ?? null,
        role: user.role ?? fallback.role ?? null,
        username: user.username ?? fallback.username ?? null,
      };
    }

    function buildMediaRequestFulfillmentStatus(mediaRequest) {
      if (mediaRequest.requestState === 'already_exists') {
        return {
          code: 'already_available',
          detail: 'This request already maps to imported media.',
          label: 'In Library',
          occurredAt: mediaRequest.updatedAt,
          tone: 'selected',
        };
      }

      if (mediaRequest.requestState === 'cancelled') {
        return {
          code: 'cancelled',
          detail: 'Request was cancelled.',
          label: 'Cancelled',
          occurredAt: mediaRequest.updatedAt,
          tone: 'failed',
        };
      }

      return {
        code: 'queued',
        detail: 'Waiting for fetch and discovery follow-up.',
        label: 'Queued',
        occurredAt: mediaRequest.updatedAt,
        tone: 'held',
      };
    }

    function buildMediaRequestReadModel(mediaRequest) {
      return {
        artistName: mediaRequest.artistName ?? null,
        artistSortName: normalizeRequestKeyPart(mediaRequest.artistName),
        cancelledChildCount: mediaRequest.cancelledChildCount ?? 0,
        createdAt: mediaRequest.createdAt,
        evidence: mediaRequest.evidence ?? {},
        expectedReleaseDate: mediaRequest.expectedReleaseDate ?? null,
        fulfillmentStatus: mediaRequest.fulfillmentStatus ?? buildMediaRequestFulfillmentStatus(mediaRequest),
        id: mediaRequest.id,
        linkedRequestId: mediaRequest.linked ? mediaRequest.requestKey : null,
        matchedMetadataReleaseGroupId: mediaRequest.releaseGroupId ?? null,
        matchedMetadataReleaseId: mediaRequest.musicbrainzReleaseId ?? null,
        musicbrainzReleaseId: mediaRequest.musicbrainzReleaseId ?? null,
        notes: null,
        releaseGroupTitle: mediaRequest.releaseTitle ?? null,
        releaseTitle: mediaRequest.releaseTitle ?? null,
        requestKind: mediaRequest.requestKind ?? 'release',
        requestedAt: mediaRequest.createdAt,
        requestedByUser: normalizeRequestUser(mediaRequest.requestedByUser),
        requestedForUser: normalizeRequestUser(mediaRequest.requestedForUser),
        requestState: mediaRequest.requestState ?? 'needs_fetch',
        sourceProvider: null,
        sourceUrl: null,
        trackTitle: mediaRequest.trackTitle ?? null,
        updatedAt: mediaRequest.updatedAt,
      };
    }

    function listRecordedMediaRequestReadModels() {
      const currentState = loadFixtureState();
      const mediaRequests = Array.isArray(currentState.mediaRequests)
        ? currentState.mediaRequests
        : [];
      return mediaRequests
        .map((mediaRequest) => buildMediaRequestReadModel(mediaRequest))
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    }

    function buildMediaRequestSummaryPayload(mediaRequests) {
      const totalRequests = mediaRequests.length;
      const alreadyExists = mediaRequests
        .filter((mediaRequest) => mediaRequest.requestState === 'already_exists')
        .length;
      const needsReview = mediaRequests
        .filter((mediaRequest) => mediaRequest.requestState === 'needs_review')
        .length;
      const needsFetch = mediaRequests
        .filter((mediaRequest) => mediaRequest.requestState === 'needs_fetch')
        .length;

      return {
        counts: {
          alreadyExists,
          needsFetch,
          needsReview,
          totalRequests,
        },
        fulfillmentCounts: {
          active: needsFetch,
          failed: mediaRequests.filter((mediaRequest) => mediaRequest.requestState === 'failed').length,
          satisfied: alreadyExists,
          underReview: needsReview,
        },
        notificationFeed: {
          checkedAt: new Date().toISOString(),
          counts: {
            byCategory: {
              delegated_request: 0,
              failure: 0,
              fulfillment: 0,
              review: 0,
            },
            total: 0,
          },
          notifications: [],
        },
        recentRequests: mediaRequests.slice(0, 5),
        summary: {
          message: totalRequests === 1
            ? '1 request is being tracked.'
            : `${totalRequests} requests are being tracked.`,
          status: totalRequests > 0 ? 'active' : 'empty',
        },
      };
    }

    async function recordMediaRequest(payload) {
      const requestKey = buildMediaRequestFixtureKey(payload);
      const requestedReleaseKeys = new Set(Array.isArray(state.requestedReleaseKeys)
        ? state.requestedReleaseKeys
        : []);
      const linked = requestedReleaseKeys.has(requestKey);
      requestedReleaseKeys.add(requestKey);
      const requestedByUser = await resolveCurrentSessionUser();
      const requestedForUser = payload.requestedForUserId
        ? resolveFixtureUser(payload.requestedForUserId)
        : requestedByUser;
      const timestamp = new Date().toISOString();

      const mediaRequest = {
        artistName: payload.artistName,
        createdAt: timestamp,
        evidence: {
          fixtureRequestKey: requestKey,
        },
        expectedReleaseDate: payload.expectedReleaseDate ?? null,
        id: `fixture-media-request-${state.mediaRequests.length + 1}`,
        linked,
        musicbrainzReleaseId: payload.musicbrainzReleaseId ?? null,
        releaseGroupId: payload.releaseGroupId ?? null,
        releaseTitle: payload.releaseTitle,
        requestKey,
        requestKind: payload.requestKind ?? 'release',
        requestState: linked ? 'already_exists' : 'needs_fetch',
        requestedByUser: normalizeRequestUser(requestedByUser),
        requestedForUser: normalizeRequestUser(requestedForUser, requestedByUser),
        requestedForUserId: payload.requestedForUserId ?? null,
        trackTitle: payload.trackTitle ?? null,
        updatedAt: timestamp,
      };

      state.mediaRequests = [...state.mediaRequests, mediaRequest];
      state.requestedReleaseKeys = [...requestedReleaseKeys];
      persistFixtureState();

      return mediaRequest;
    }

    function cancelRecordedMediaRequest(mediaRequestId, reason = null) {
      const currentState = loadFixtureState();
      const mediaRequests = Array.isArray(currentState.mediaRequests)
        ? currentState.mediaRequests
        : [];
      const requestIndex = mediaRequests.findIndex((request) => request.id === mediaRequestId);
      if (requestIndex < 0) {
        return {
          body: { error: { message: 'Not found' }, ok: false },
          status: 404,
        };
      }

      const existingRequest = mediaRequests[requestIndex];
      if (!['needs_fetch', 'needs_review'].includes(existingRequest.requestState)) {
        return {
          body: {
            error: {
              code: 'request_not_cancellable',
              message: 'This request can no longer be cancelled.',
            },
            ok: false,
          },
          status: 409,
        };
      }

      const timestamp = new Date().toISOString();
      const cancelledRequest = {
        ...existingRequest,
        cancelReason: reason ?? null,
        cancelledChildCount: 0,
        requestState: 'cancelled',
        updatedAt: timestamp,
      };

      state.mediaRequests = [
        ...mediaRequests.slice(0, requestIndex),
        cancelledRequest,
        ...mediaRequests.slice(requestIndex + 1),
      ];
      persistFixtureState();

      return {
        body: {
          mediaRequest: buildMediaRequestReadModel(cancelledRequest),
          ok: true,
        },
        status: 200,
      };
    }

    function getMediaRequestEventPage(mediaRequestId, cursor = null) {
      const currentState = loadFixtureState();
      const eventsById = currentState.mediaRequestEventsById && typeof currentState.mediaRequestEventsById === 'object'
        ? currentState.mediaRequestEventsById
        : {};
      const eventConfig = eventsById[mediaRequestId] ?? {};
      const pageConfig = cursor
        ? eventConfig.pages?.[cursor] ?? {}
        : eventConfig;
      const nextCursor = pageConfig.nextCursor ?? null;

      return {
        events: Array.isArray(pageConfig.events) ? pageConfig.events : [],
        hasMore: Boolean(pageConfig.hasMore ?? nextCursor),
        nextCursor,
      };
    }

    function getMediaRequestPipeline(mediaRequestId) {
      const currentState = loadFixtureState();
      const pipelineById = currentState.mediaRequestPipelineById && typeof currentState.mediaRequestPipelineById === 'object'
        ? currentState.mediaRequestPipelineById
        : {};
      const pipeline = pipelineById[mediaRequestId] ?? {};

      return {
        candidates: Array.isArray(pipeline.candidates) ? pipeline.candidates : [],
      };
    }

    function buildRequesterCandidateSourceLabel(index = 0) {
      return `Source ${index + 1}`;
    }

    function projectRequesterPipelineRunItem(runItem) {
      if (!runItem) return null;

      return {
        finishedAt: runItem.finishedAt ?? null,
        itemStatus: runItem.itemStatus ?? null,
        runStatus: runItem.runStatus ?? null,
        startedAt: runItem.startedAt ?? null,
      };
    }

    function projectOperatorPipelineRunItem(runItem) {
      if (!runItem) return null;

      return {
        finishedAt: runItem.finishedAt ?? null,
        importCandidateId: runItem.importCandidateId ?? null,
        itemStatus: runItem.itemStatus ?? null,
        operationRunId: runItem.operationRunId ?? null,
        runErrorMessage: runItem.runErrorMessage ?? null,
        runStatus: runItem.runStatus ?? null,
        startedAt: runItem.startedAt ?? null,
        statusMessage: runItem.statusMessage ?? null,
      };
    }

    function projectMediaRequestPipelineForSession({ candidates, sessionUser }) {
      const canViewOperatorDiagnostics = sessionUser?.role === 'admin' || sessionUser?.role === 'operator';
      return candidates.map((candidate, index) => {
        const sourceLabel = candidate.sourceLabel ?? buildRequesterCandidateSourceLabel(index);
        if (canViewOperatorDiagnostics) {
          return {
            ...candidate,
            apply: projectOperatorPipelineRunItem(candidate.apply),
            execution: projectOperatorPipelineRunItem(candidate.execution),
            sourceKey: candidate.sourceKey ?? candidate.id ?? `source-${index + 1}`,
            sourceLabel,
          };
        }

        return {
          apply: projectRequesterPipelineRunItem(candidate.apply),
          execution: projectRequesterPipelineRunItem(candidate.execution),
          fileCount: candidate.fileCount ?? 0,
          sourceKey: `source-${index + 1}`,
          sourceLabel,
          status: candidate.status,
          totalSizeBytes: candidate.totalSizeBytes ?? 0,
          transferProgress: candidate.transferProgress ?? null,
        };
      });
    }

    function getImportReviewWorkspaceState() {
      const currentState = loadFixtureState();
      return {
        applyPreviewById: currentState.importReviewApplyPreviewById
          && typeof currentState.importReviewApplyPreviewById === 'object'
          ? currentState.importReviewApplyPreviewById
          : {},
        applySummary: currentState.importReviewApplySummary,
        candidates: Array.isArray(currentState.importReviewCandidates)
          ? currentState.importReviewCandidates
          : [],
        executionSummary: currentState.importReviewExecutionSummary,
        mediaInspectionSummary: currentState.importReviewMediaInspectionSummary,
        previewById: currentState.importReviewPreviewById
          && typeof currentState.importReviewPreviewById === 'object'
          ? currentState.importReviewPreviewById
          : {},
        runActions: Array.isArray(currentState.importReviewRunActions)
          ? currentState.importReviewRunActions
          : [],
      };
    }

    function filterImportReviewCandidates(searchParams) {
      const workspace = getImportReviewWorkspaceState();
      const status = searchParams.get('status') ?? '';
      const username = normalizeSearchKey(searchParams.get('username'));
      const folderPath = normalizeSearchKey(searchParams.get('folderPath'));
      const sourceSearchId = normalizeSearchKey(searchParams.get('sourceSearchId'));
      const offset = Number.parseInt(searchParams.get('offset') ?? '0', 10) || 0;
      const limit = Number.parseInt(searchParams.get('limit') ?? '25', 10) || 25;
      const filtered = workspace.candidates.filter((candidate) => {
        if (status && candidate.status !== status) return false;
        if (username && !normalizeSearchKey(candidate.username).includes(username)) return false;
        if (folderPath && !normalizeSearchKey(candidate.folderPath).includes(folderPath)) return false;
        if (sourceSearchId && normalizeSearchKey(candidate.sourceSearchId) !== sourceSearchId) return false;
        return true;
      });

      return {
        candidates: filtered.slice(offset, offset + limit).map((candidate) => clone(candidate)),
        filters: {
          folderPath: searchParams.get('folderPath') || null,
          sourceSearchId: searchParams.get('sourceSearchId') || null,
          status: status || null,
          username: searchParams.get('username') || null,
        },
        pagination: {
          limit,
          offset,
          total: filtered.length,
        },
      };
    }

    function findImportReviewCandidate(importCandidateId) {
      return getImportReviewWorkspaceState().candidates
        .find((candidate) => candidate.id === importCandidateId) ?? null;
    }

    function buildEmptyImportCandidateExecutionSummary() {
      return {
        currentRun: null,
        recentRuns: [],
        summary: {
          message: 'No download run activity is recorded in this fixture.',
        },
      };
    }

    function buildEmptyImportCandidateApplySummary() {
      return {
        currentRun: null,
        recentRuns: [],
        summary: {
          message: 'No import apply activity is recorded in this fixture.',
        },
      };
    }

    function buildEmptyImportCandidateMediaInspectionSummary() {
      return {
        currentRun: null,
        recentRuns: [],
        summary: {
          message: 'No media inspection activity is recorded in this fixture.',
        },
      };
    }

    function countImportReviewCandidatesByStatus(status) {
      return getImportReviewWorkspaceState().candidates
        .filter((candidate) => candidate.status === status)
        .length;
    }

    function buildImportCandidateRunSummary({ currentRun, kind, message }) {
      const recentRuns = [
        currentRun,
        ...((state[`importReview${kind.summaryStateName}`]?.recentRuns) ?? []),
      ].filter(Boolean);

      return {
        activeRun: currentRun,
        checkedAt: currentRun.startedAt,
        currentRun,
        latestRun: currentRun,
        recentRuns,
        summary: {
          message,
          status: 'running',
          ...(kind.heartbeat ? { heartbeat: kind.heartbeat } : {}),
          ...(kind.missingTransferPolicy ? { missingTransferPolicy: kind.missingTransferPolicy } : {}),
        },
      };
    }

    function recordImportReviewRunAction(action) {
      state.importReviewRunActions = [
        ...(Array.isArray(state.importReviewRunActions) ? state.importReviewRunActions : []),
        action,
      ];
      persistFixtureState();
    }

    function buildImportReviewRunConfig(action) {
      const nowIso = new Date().toISOString();
      const configs = {
        apply: {
          action: 'apply-start',
          candidateCount: countImportReviewCandidatesByStatus('import_pending'),
          currentStep: 'Add-to-library run queued from Match diagnostics.',
          idPrefix: 'apply-run',
          responseKey: 'importCandidateApply',
          startedMessage: 'Add-to-library run {id} queued for {count} download{plural}.',
          stateKey: 'importReviewApplySummary',
          summaryStateName: 'ApplySummary',
        },
        execution: {
          action: 'execution-start',
          candidateCount: countImportReviewCandidatesByStatus('selected'),
          currentStep: 'Download run queued from Match diagnostics.',
          heartbeat: {
            intervalLabel: 'Manual fixture',
            source: 'browser fixture',
            state: {
              lastOutcome: null,
              lastSkipReason: null,
              lastTickAt: null,
              lastTransitionCount: 0,
            },
          },
          idPrefix: 'execution-run',
          missingTransferPolicy: {
            gracePeriodLabel: 'Manual fixture',
          },
          responseKey: 'importCandidateExecution',
          startedMessage: 'Download run {id} queued for {count} selected match{plural}.',
          stateKey: 'importReviewExecutionSummary',
          summaryStateName: 'ExecutionSummary',
        },
        mediaInspection: {
          action: 'media-inspection-start',
          candidateCount: countImportReviewCandidatesByStatus('selected'),
          currentStep: 'Media check run queued from Match diagnostics.',
          idPrefix: 'media-inspection-run',
          responseKey: 'importCandidateMediaInspection',
          startedMessage: 'Media check run {id} queued for {count} selected match{plural}.',
          stateKey: 'importReviewMediaInspectionSummary',
          summaryStateName: 'MediaInspectionSummary',
        },
      };

      const config = configs[action];
      if (!config) return null;
      const nextRunNumber = (Array.isArray(state.importReviewRunActions)
        ? state.importReviewRunActions.filter((item) => item.action === config.action).length
        : 0) + 1;
      return {
        ...config,
        id: `${config.idPrefix}-${nextRunNumber}`,
        nowIso,
      };
    }

    function buildImportReviewRun(config) {
      const baseRun = {
        currentStep: config.currentStep,
        errorMessage: null,
        finishedAt: null,
        id: config.id,
        items: [],
        requestedCandidateCount: config.candidateCount,
        startedAt: config.nowIso,
        status: 'pending',
      };

      if (config.action === 'media-inspection-start') {
        return {
          ...baseRun,
          blockedCandidateCount: 0,
          inspectedCandidateCount: 0,
          inspectedFileCount: 0,
          inspectionUnavailableCount: 0,
          warningCount: 0,
        };
      }

      if (config.action === 'execution-start') {
        return {
          ...baseRun,
          blockedCount: 0,
          queuedCount: 0,
          queuedWithWarningsCount: 0,
          queueFailedCount: 0,
          readyCount: config.candidateCount,
          readyWithWarningsCount: 0,
          transferSnapshotUnavailable: false,
        };
      }

      return {
        ...baseRun,
        appliedCount: 0,
        appliedWithWarningsCount: 0,
        applyFailedCount: 0,
        blockedCount: 0,
        processedCandidateCount: 0,
      };
    }

    function createImportReviewRun(action) {
      Object.assign(state, loadFixtureState());
      const config = buildImportReviewRunConfig(action);
      if (!config) {
        return buildJsonResponse({ error: { message: 'Unsupported import run action.' }, ok: false }, 404);
      }

      const queuedFailure = consumeImportReviewRunFailure(config.action);
      if (queuedFailure) {
        if (queuedFailure.kind === 'network') {
          throw new TypeError(queuedFailure.message ?? 'Network request failed.');
        }

        return buildJsonResponse({
          error: {
            code: queuedFailure.code ?? 'import_candidate_run_start_failed',
            message: queuedFailure.message ?? 'Import candidate run start failed.',
          },
          ok: false,
        }, queuedFailure.status ?? 503);
      }

      const run = buildImportReviewRun(config);
      const plural = config.candidateCount === 1 ? '' : 's';
      state[config.stateKey] = buildImportCandidateRunSummary({
        currentRun: run,
        kind: config,
        message: config.startedMessage
          .replace('{id}', run.id)
          .replace('{count}', String(config.candidateCount))
          .replace('{plural}', plural),
      });
      recordImportReviewRunAction({
        action: config.action,
        candidateCount: config.candidateCount,
        runId: run.id,
        timestamp: config.nowIso,
      });

      return buildJsonResponse({
        accepted: true,
        ok: true,
        run: clone(run),
      }, 202);
    }

    function getImportReviewRunDetail(action, runId) {
      const config = buildImportReviewRunConfig(action);
      if (!config) {
        return null;
      }
      const summary = state[config.stateKey] ?? loadFixtureState()[config.stateKey] ?? null;
      const matchingRun = summary?.currentRun?.id === runId
        ? summary.currentRun
        : (summary?.recentRuns ?? []).find((run) => run.id === runId) ?? null;
      if (!matchingRun) {
        return null;
      }
      return {
        checkedAt: summary.checkedAt ?? null,
        run: clone(matchingRun),
      };
    }

    function reconcileImportReviewExecutionState() {
      Object.assign(state, loadFixtureState());
      const queuedFailure = consumeImportReviewRunFailure('execution-reconcile');
      if (queuedFailure) {
        if (queuedFailure.kind === 'network') {
          throw new TypeError(queuedFailure.message ?? 'Network request failed.');
        }

        return buildJsonResponse({
          error: {
            code: queuedFailure.code ?? 'import_candidate_execution_reconcile_failed',
            message: queuedFailure.message ?? 'Import candidate execution reconciliation failed.',
          },
          ok: false,
        }, queuedFailure.status ?? 503);
      }

      const nowIso = new Date().toISOString();
      const executionSummary = state.importReviewExecutionSummary ?? buildEmptyImportCandidateExecutionSummary();
      const queuedReconciliation = consumeImportReviewExecutionReconciliation();
      const currentRun = executionSummary.currentRun ?? null;
      const reconciledRun = queuedReconciliation?.currentRun
        ? {
          ...currentRun,
          ...queuedReconciliation.currentRun,
        }
        : currentRun;
      const latestRun = reconciledRun ?? executionSummary.latestRun ?? null;
      const recentRuns = updateImportReviewRecentRuns(executionSummary.recentRuns, reconciledRun);

      applyImportReviewExecutionCandidateStatuses(queuedReconciliation?.candidateStatuses);

      state.importReviewExecutionSummary = {
        ...executionSummary,
        activeRun: reconciledRun && (reconciledRun.status === 'pending' || reconciledRun.status === 'running')
          ? reconciledRun
          : null,
        checkedAt: nowIso,
        currentRun: reconciledRun,
        latestRun,
        recentRuns,
        summary: {
          ...(executionSummary.summary ?? {}),
          heartbeat: {
            intervalLabel: 'Manual fixture',
            source: 'operator manual sync',
            state: {
              lastOutcome: 'started',
              lastSkipReason: null,
              lastTickAt: nowIso,
              lastTransitionCount: queuedReconciliation?.transitionCount ?? 0,
            },
          },
          message: queuedReconciliation?.summary?.message ?? 'Download transfer state synced manually.',
          missingTransferPolicy: executionSummary.summary?.missingTransferPolicy ?? {
            gracePeriodLabel: 'Manual fixture',
          },
          status: queuedReconciliation?.summary?.status ?? 'ready',
          ...(queuedReconciliation?.summary ?? {}),
        },
      };
      recordImportReviewRunAction({
        action: 'execution-reconcile',
        currentRunId: executionSummary.currentRun?.id ?? null,
        timestamp: nowIso,
      });

      return buildJsonResponse({
        ok: true,
        reconciliation: {
          currentRunId: executionSummary.currentRun?.id ?? null,
          summary: {
            transitioned: queuedReconciliation?.transitionCount ?? 0,
          },
          transitions: [],
        },
      });
    }

    function buildSelectedImportCandidateSummary() {
      const candidates = getImportReviewWorkspaceState().candidates
        .filter((candidate) => candidate.status === 'selected');
      return {
        counts: {
          blocked: 0,
          ready: candidates.length,
          readyWithWarnings: 0,
          totalSelected: candidates.length,
        },
        selectedCandidates: candidates.map((candidate) => clone({
          ...candidate,
          executionStatus: candidate.executionStatus ?? {
            code: 'ready',
            message: 'Match is ready for download.',
          },
          planning: candidate.planning ?? {},
          selectedAt: candidate.selectedAt ?? candidate.updatedAt ?? candidate.discoveredAt ?? null,
        })),
        summary: {
          message: candidates.length
            ? `${candidates.length} selected match${candidates.length === 1 ? '' : 'es'} ready for download.`
            : 'No matches selected yet.',
        },
      };
    }

    function buildImportPendingCandidateSummary() {
      const candidates = getImportReviewWorkspaceState().candidates
        .filter((candidate) => candidate.status === 'import_pending');
      const counts = candidates.reduce((summary, candidate) => {
        const code = candidate.importStatus?.code;
        summary.totalImportPending += 1;
        if (code === 'blocked') {
          summary.blocked += 1;
        } else if (code === 'ready_with_warnings') {
          summary.readyWithWarnings += 1;
        } else {
          summary.ready += 1;
        }
        return summary;
      }, {
        blocked: 0,
        ready: 0,
        readyWithWarnings: 0,
        totalImportPending: 0,
      });
      return {
        counts,
        importPendingCandidates: candidates.map((candidate) => clone({
          ...candidate,
          importPendingAt: candidate.importPendingAt ?? candidate.updatedAt ?? candidate.discoveredAt ?? null,
          importStatus: candidate.importStatus ?? {
            code: 'ready',
            message: 'Download is ready to add.',
          },
          planning: candidate.planning ?? {},
        })),
        summary: {
          message: counts.blocked > 0
            ? `${counts.blocked} completed download${counts.blocked === 1 ? ' is' : 's are'} blocked and ${counts.blocked === 1 ? 'needs' : 'need'} operator attention before library addition can proceed.`
            : candidates.length
              ? `${candidates.length} download${candidates.length === 1 ? ' is' : 's are'} waiting to add.`
              : 'No downloads ready to add.',
        },
      };
    }

    function resolveFixtureTracklist(releaseGroupId, searchParams = new URLSearchParams()) {
      const baseTracklist = fixture.tracklistsByReleaseGroupId[releaseGroupId] ?? null;
      if (!baseTracklist) return null;

      const { editionsByReleaseId, ...basePayload } = baseTracklist;
      const preferReleaseId = searchParams.get('preferReleaseId');
      if (preferReleaseId && editionsByReleaseId?.[preferReleaseId]) {
        return {
          ...basePayload,
          ...editionsByReleaseId[preferReleaseId],
        };
      }

      return basePayload;
    }

    function normalizePrimaryType(primaryType) {
      return String(primaryType ?? 'other').trim().toLowerCase();
    }

    function getAddedArtistIds(sourceState = state) {
      const addedArtistIds = new Set(Array.isArray(sourceState.addedArtistIds)
        ? sourceState.addedArtistIds
        : []);
      if (sourceState.boardsIsAdded) {
        addedArtistIds.add('mb-artist-boards');
      }
      if (sourceState.autechreIsAdded) {
        addedArtistIds.add('mb-artist-autechre');
      }
      return [...addedArtistIds];
    }

    function markArtistAsAdded(musicBrainzArtistId) {
      state.addedArtistIds = [
        ...new Set([...getAddedArtistIds(), musicBrainzArtistId]),
      ];
      if (musicBrainzArtistId === 'mb-artist-boards') {
        state.boardsIsAdded = true;
        state.boardsOperatorProjection = state.operatorProjectionsByMusicBrainzId[musicBrainzArtistId];
      }
      if (musicBrainzArtistId === 'mb-artist-autechre') {
        state.autechreIsAdded = true;
      }
      persistFixtureState();
    }

    function buildReleaseGroups({
      monitoring,
      releaseGroups = [],
      releaseGroupSelections = [],
      trackOverrides = [],
    } = {}) {
      const explicitSelections = new Map(
        releaseGroupSelections.map((selection) => [selection.metadataReleaseGroupId, selection]),
      );

      return releaseGroups.map((releaseGroup) => {
        const explicitSelection = explicitSelections.get(releaseGroup.id) ?? null;
        const selectedByPolicy = (monitoring.monitoredReleaseGroupTypes ?? [])
          .includes(normalizePrimaryType(releaseGroup.primaryType));
        const releaseGroupTrackOverrides = trackOverrides
          .filter((override) => override.metadataReleaseGroupId === releaseGroup.id);

        return {
          ...releaseGroup,
          operatorState: {
            isExplicitSelection: Boolean(explicitSelection),
            resolvedMetadataReleaseId: explicitSelection?.resolvedMetadataReleaseId ?? null,
            resolvedRelease: null,
            selectionOrigin: explicitSelection?.selectionOrigin ?? null,
            selectionSource: explicitSelection?.selectionSource ?? 'policy',
            selectionState: explicitSelection?.selectionState ?? (selectedByPolicy ? 'selected' : 'unselected'),
            trackOverrideSummary: {
              desiredCount: releaseGroupTrackOverrides
                .filter((override) => override.isDesired === true)
                .length,
              orphanedCount: releaseGroupTrackOverrides
                .filter((override) => override.remapStatus === 'orphaned')
                .length,
              reviewNeededCount: releaseGroupTrackOverrides
                .filter((override) => override.remapStatus === 'review_needed')
                .length,
              suppressedCount: releaseGroupTrackOverrides
                .filter((override) => override.isDesired === false)
                .length,
              totalCount: releaseGroupTrackOverrides.length,
            },
          },
        };
      });
    }

    function buildCoverage(releaseGroups) {
      const desiredReleaseCount = releaseGroups
        .filter((releaseGroup) => ['selected', 'partial'].includes(releaseGroup.operatorState.selectionState))
        .length;
      const partialReleaseCount = releaseGroups
        .filter((releaseGroup) => releaseGroup.operatorState.selectionState === 'partial')
        .length;

      return {
        acquiredReleaseCount: 0,
        desiredReleaseCount,
        missingReleaseCount: desiredReleaseCount,
        partialReleaseCount,
        unresolvedReleaseCount: 0,
      };
    }

    function buildOverview({ releaseGroups, releaseGroupSelections = [], trackOverrides = [] } = {}) {
      const selectedReleaseGroupCount = releaseGroups
        .filter((releaseGroup) => releaseGroup.operatorState.selectionState === 'selected')
        .length;
      const partialReleaseGroupCount = releaseGroups
        .filter((releaseGroup) => releaseGroup.operatorState.selectionState === 'partial')
        .length;
      const unselectedReleaseGroupCount = releaseGroups
        .filter((releaseGroup) => releaseGroup.operatorState.selectionState === 'unselected')
        .length;

      return {
        desiredReleaseGroupCount: selectedReleaseGroupCount + partialReleaseGroupCount,
        desiredTrackOverrideCount: trackOverrides.filter((override) => override.isDesired === true).length,
        hasManualOverrides: releaseGroupSelections.length > 0 || trackOverrides.length > 0,
        manualSelectionCount: releaseGroupSelections.length,
        orphanedReleaseGroupSelectionCount: 0,
        orphanedTrackOverrideCount: trackOverrides
          .filter((override) => override.remapStatus === 'orphaned')
          .length,
        partialReleaseGroupCount,
        policySelectionCount: releaseGroups.length - releaseGroupSelections.length,
        releaseGroupCount: releaseGroups.length,
        reviewNeededTrackOverrideCount: trackOverrides
          .filter((override) => override.remapStatus === 'review_needed')
          .length,
        selectedReleaseGroupCount,
        suppressedTrackOverrideCount: trackOverrides.filter((override) => override.isDesired === false).length,
        trackOverrideCount: trackOverrides.length,
        unselectedReleaseGroupCount,
      };
    }

    function buildOperatorProjection({
      artistFixture,
      monitoring,
      reconciliationStatus,
      releaseGroupSelections = [],
      trackOverrides = [],
    }) {
      const releaseGroups = buildReleaseGroups({
        monitoring,
        releaseGroups: artistFixture.releaseGroups,
        releaseGroupSelections,
        trackOverrides,
      });

      return {
        aliases: clone(artistFixture.localPayload.aliases ?? []),
        artist: clone(artistFixture.localPayload.artist),
        detectionEvents: clone(artistFixture.localPayload.detectionEvents ?? []),
        detectionEventsPageInfo: clone(artistFixture.localPayload.detectionEventsPageInfo ?? {
          hasMore: false,
          nextCursor: null,
        }),
        operator: {
          coverage: buildCoverage(releaseGroups),
          monitoring,
          overview: buildOverview({
            releaseGroups,
            releaseGroupSelections,
            trackOverrides,
          }),
          reconciliation: {
            latestRun: null,
            latestSnapshot: null,
            pendingRun: reconciliationStatus === 'queued'
              ? { id: 'operator-reconciliation-run-1', status: 'pending' }
              : null,
            runningRun: null,
            status: reconciliationStatus,
          },
          releaseGroupSelections,
          trackOverrides,
        },
        releaseGroups,
        releases: clone(artistFixture.localPayload.releases ?? []),
      };
    }

    function buildTrackOverrideActivityCounts(previousTrackOverrides = [], nextTrackOverrides = []) {
      const nextByRecordingMbid = new Map(
        nextTrackOverrides
          .filter((override) => override.recordingMbid)
          .map((override) => [override.recordingMbid, override]),
      );
      let resolvedReviewCount = 0;
      let clearedReviewCount = 0;

      for (const previousOverride of previousTrackOverrides) {
        if (previousOverride.remapStatus !== 'review_needed') {
          continue;
        }

        const nextOverride = previousOverride.recordingMbid
          ? nextByRecordingMbid.get(previousOverride.recordingMbid)
          : null;
        if (!nextOverride) {
          clearedReviewCount += 1;
        } else if (nextOverride.remapStatus === 'resolved') {
          resolvedReviewCount += 1;
        }
      }

      return {
        added: Math.max(0, nextTrackOverrides.length - previousTrackOverrides.length),
        changed: resolvedReviewCount,
        clearedReviewCount,
        removed: Math.max(0, previousTrackOverrides.length - nextTrackOverrides.length),
        resolvedReviewCount,
      };
    }

    function recordArtistPolicyActivityEvent({
      artistFixture,
      nextProjection,
      previousProjection,
    }) {
      const previousTrackOverrides = previousProjection?.operator?.trackOverrides ?? [];
      const nextTrackOverrides = nextProjection?.operator?.trackOverrides ?? [];
      const eventIndex = state.operatorSaveCount ?? 1;
      const pendingRun = nextProjection?.operator?.reconciliation?.pendingRun ?? null;
      const event = {
        actorUserId: 'fixture-admin-user',
        entityArtist: null,
        entityId: artistFixture.localPayload.artist.id,
        entityTitle: artistFixture.localPayload.artist.name,
        entityType: 'metadata_artist',
        eventType: 'artist_policy_saved',
        extraPayload: {
          artistId: artistFixture.localPayload.artist.id,
          artistMusicBrainzId: artistFixture.musicBrainzArtistId,
          changes: {
            monitoring: { changedFieldCount: 0 },
            releaseGroups: { added: 0, changed: 0, removed: 0 },
            trackOverrides: buildTrackOverrideActivityCounts(previousTrackOverrides, nextTrackOverrides),
          },
          reconciliation: pendingRun
            ? {
              queuedBehindRun: false,
              runId: pendingRun.id,
            }
            : null,
          schemaVersion: 1,
          snapshot: {
            snapshotRevision: state.operatorSaveCount ?? 0,
          },
        },
        id: `fixture-artist-policy-event-${eventIndex}`,
        occurredAt: `2026-06-27T12:${String(eventIndex).padStart(2, '0')}:00.000Z`,
      };

      state.activityEvents = [
        event,
        ...(Array.isArray(state.activityEvents) ? state.activityEvents : []),
      ];
    }

    function updateOperatorProjectionFromDraft(localArtistId, draft) {
      const artistFixture = getArtistFixtureByLocalId(localArtistId);
      if (!artistFixture) {
        return null;
      }

      state.operatorSaveCount += 1;
      const previousProjection = state.operatorProjectionsByMusicBrainzId[artistFixture.musicBrainzArtistId];
      const nextProjection = buildOperatorProjection({
        artistFixture,
        monitoring: {
          ...previousProjection.operator.monitoring,
          ...(draft.monitoring ?? {}),
        },
        reconciliationStatus: state.operatorSaveCount > 1 ? 'queued' : 'idle',
        releaseGroupSelections: Array.isArray(draft.releaseGroupSelections)
          ? draft.releaseGroupSelections
          : [],
        trackOverrides: Array.isArray(draft.trackOverrides)
          ? draft.trackOverrides
          : [],
      });
      state.operatorProjectionsByMusicBrainzId = {
        ...state.operatorProjectionsByMusicBrainzId,
        [artistFixture.musicBrainzArtistId]: nextProjection,
      };
      markArtistAsAdded(artistFixture.musicBrainzArtistId);
      if (artistFixture.musicBrainzArtistId === 'mb-artist-boards') {
        state.boardsOperatorProjection = nextProjection;
        state.boardsTrackOverrideReviewNeeded = (nextProjection.operator?.overview?.reviewNeededTrackOverrideCount ?? 0) > 0;
      }
      recordArtistPolicyActivityEvent({
        artistFixture,
        nextProjection,
        previousProjection,
      });
      persistFixtureState();
      return nextProjection;
    }

    globalThis.fetch = async (input, init) => {
      const requestUrl = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      const url = new URL(requestUrl, globalThis.location.origin);
      const method = String(
        init?.method
          ?? (typeof input === 'object' && input !== null && 'method' in input ? input.method : 'GET')
          ?? 'GET',
      ).toUpperCase();
      const path = url.pathname;

      if (method === 'GET' && path === '/api/v1/activity/feed') {
        Object.assign(state, loadFixtureState());
        const eventType = url.searchParams.get('eventType');
        const requestedLimit = Number.parseInt(url.searchParams.get('limit') ?? '50', 10);
        const limit = Number.isInteger(requestedLimit)
          ? Math.max(1, Math.min(requestedLimit, 200))
          : 50;
        const events = (Array.isArray(state.activityEvents) ? state.activityEvents : [])
          .filter((event) => !eventType || event.eventType === eventType)
          .slice(0, limit);

        return buildJsonResponse({
          checkedAt: '2026-06-27T12:30:00.000Z',
          events: clone(events),
          ok: true,
          total: events.length,
        });
      }

      if (method === 'GET' && path === '/api/v1/users') {
        Object.assign(state, loadFixtureState());
        state.userListFetchCount = (state.userListFetchCount ?? 0) + 1;
        persistFixtureState();
        return buildJsonResponse({
          limit: 50,
          offset: 0,
          ok: true,
          total: fixture.users.length,
          users: clone(fixture.users),
        });
      }

      if (method === 'POST' && path === '/api/v1/library/media-requests') {
        Object.assign(state, loadFixtureState());
        const payload = parseJsonBody(input, init);
        if (!payload.artistName || !payload.releaseTitle) {
          return buildJsonResponse({
            error: {
              code: 'validation_failed',
              message: 'artistName and releaseTitle are required.',
            },
            ok: false,
          }, 400);
        }

        const queuedFailure = consumeMediaRequestFailure(payload);
        if (queuedFailure) {
          if (queuedFailure.kind === 'network') {
            throw new TypeError(queuedFailure.message ?? 'Network request failed.');
          }

          return buildJsonResponse({
            error: {
              code: queuedFailure.code ?? 'request_failed',
              message: queuedFailure.message ?? 'Request failed. Please try again.',
            },
            ok: false,
          }, queuedFailure.status ?? 503);
        }

        const mediaRequest = await recordMediaRequest(payload);
        return buildJsonResponse({
          linked: mediaRequest.linked,
          mediaRequest,
          ok: true,
        }, 201);
      }

      if (method === 'GET' && path === '/api/v1/library/media-request-summary') {
        const mediaRequests = listRecordedMediaRequestReadModels();
        return buildJsonResponse({
          ok: true,
          scope: url.searchParams.get('scope') ?? 'mine',
          ...buildMediaRequestSummaryPayload(mediaRequests),
        });
      }

      if (method === 'GET' && path === '/api/v1/library/media-requests') {
        const mediaRequests = listRecordedMediaRequestReadModels();
        return buildJsonResponse({
          mediaRequests,
          ok: true,
          scope: url.searchParams.get('scope') ?? 'mine',
          totalCount: mediaRequests.length,
        });
      }

      const mediaRequestCancelMatch = path.match(/^\/api\/v1\/library\/media-requests\/([^/]+)\/cancel$/u);
      if (method === 'POST' && mediaRequestCancelMatch) {
        const mediaRequestId = decodeURIComponent(mediaRequestCancelMatch[1]);
        const payload = parseJsonBody(input, init);
        Object.assign(state, loadFixtureState());
        const queuedFailure = consumeMediaRequestCancellationFailure(mediaRequestId);
        if (queuedFailure) {
          if (queuedFailure.kind === 'network') {
            throw new TypeError(queuedFailure.message ?? 'Network request failed.');
          }

          return buildJsonResponse({
            error: {
              code: queuedFailure.code ?? 'request_cancellation_failed',
              message: queuedFailure.message ?? 'Failed to cancel request. Please try again.',
            },
            ok: false,
          }, queuedFailure.status ?? 503);
        }

        const result = cancelRecordedMediaRequest(mediaRequestId, payload.reason ?? null);
        return buildJsonResponse(result.body, result.status);
      }

      const mediaRequestDetailMatch = path.match(/^\/api\/v1\/library\/media-requests\/([^/]+)$/u);
      if (method === 'GET' && mediaRequestDetailMatch) {
        const mediaRequestId = decodeURIComponent(mediaRequestDetailMatch[1]);
        const mediaRequest = listRecordedMediaRequestReadModels()
          .find((request) => request.id === mediaRequestId) ?? null;
        if (!mediaRequest) {
          return buildJsonResponse({ error: { message: 'Not found' }, ok: false }, 404);
        }
        const eventPage = getMediaRequestEventPage(mediaRequestId);
        return buildJsonResponse({
          events: eventPage.events,
          hasMoreEvents: eventPage.hasMore,
          mediaRequest,
          nextCursor: eventPage.nextCursor,
          ok: true,
        });
      }

      const mediaRequestPipelineMatch = path.match(/^\/api\/v1\/library\/media-requests\/([^/]+)\/pipeline$/u);
      if (method === 'GET' && mediaRequestPipelineMatch) {
        const mediaRequestId = decodeURIComponent(mediaRequestPipelineMatch[1]);
        const pipeline = getMediaRequestPipeline(mediaRequestId);
        const sessionUser = await resolveCurrentSessionUser();
        return buildJsonResponse({
          candidates: projectMediaRequestPipelineForSession({
            candidates: pipeline.candidates,
            sessionUser,
          }),
          ok: true,
        });
      }

      const mediaRequestEventsMatch = path.match(/^\/api\/v1\/library\/media-requests\/([^/]+)\/events$/u);
      if (method === 'GET' && mediaRequestEventsMatch) {
        const mediaRequestId = decodeURIComponent(mediaRequestEventsMatch[1]);
        const eventPage = getMediaRequestEventPage(mediaRequestId, url.searchParams.get('cursor'));
        return buildJsonResponse({
          events: eventPage.events,
          hasMore: eventPage.hasMore,
          nextCursor: eventPage.nextCursor,
          ok: true,
        });
      }

      if (method === 'GET' && path === '/api/v1/import-candidates') {
        return buildJsonResponse({
          importCandidates: filterImportReviewCandidates(url.searchParams),
          ok: true,
        });
      }

      if (method === 'GET' && path === '/api/v1/import-candidates/selected-summary') {
        return buildJsonResponse({
          ok: true,
          selectedImportCandidates: buildSelectedImportCandidateSummary(),
        });
      }

      if (method === 'GET' && path === '/api/v1/import-candidates/import-pending-summary') {
        return buildJsonResponse({
          importPendingCandidates: buildImportPendingCandidateSummary(),
          ok: true,
        });
      }

      if (method === 'GET' && path === '/api/v1/import-candidates/execution-summary') {
        const summary = getImportReviewWorkspaceState().executionSummary;
        return buildJsonResponse({
          importCandidateExecution: summary ?? buildEmptyImportCandidateExecutionSummary(),
          ok: true,
        });
      }

      if (method === 'GET' && path === '/api/v1/import-candidates/apply-summary') {
        const summary = getImportReviewWorkspaceState().applySummary;
        return buildJsonResponse({
          importCandidateApply: summary ?? buildEmptyImportCandidateApplySummary(),
          ok: true,
        });
      }

      if (method === 'GET' && path === '/api/v1/import-candidates/media-inspection-summary') {
        const summary = getImportReviewWorkspaceState().mediaInspectionSummary;
        return buildJsonResponse({
          importCandidateMediaInspection: summary ?? buildEmptyImportCandidateMediaInspectionSummary(),
          ok: true,
        });
      }

      if (method === 'POST' && path === '/api/v1/import-candidates/media-inspection-runs') {
        return createImportReviewRun('mediaInspection');
      }

      if (method === 'POST' && path === '/api/v1/import-candidates/execution-runs') {
        return createImportReviewRun('execution');
      }

      if (method === 'POST' && path === '/api/v1/import-candidates/apply-runs') {
        return createImportReviewRun('apply');
      }

      if (method === 'POST' && path === '/api/v1/import-candidates/execution-reconcile') {
        return reconcileImportReviewExecutionState();
      }

      const importCandidateMediaInspectionRunMatch = path.match(/^\/api\/v1\/import-candidates\/media-inspection-runs\/([^/]+)$/u);
      if (method === 'GET' && importCandidateMediaInspectionRunMatch) {
        Object.assign(state, loadFixtureState());
        const runId = decodeURIComponent(importCandidateMediaInspectionRunMatch[1]);
        const runDetail = getImportReviewRunDetail('mediaInspection', runId);
        return buildJsonResponse({
          importCandidateMediaInspectionRun: runDetail,
          ok: Boolean(runDetail),
        }, runDetail ? 200 : 404);
      }

      const importCandidateExecutionRunMatch = path.match(/^\/api\/v1\/import-candidates\/execution-runs\/([^/]+)$/u);
      if (method === 'GET' && importCandidateExecutionRunMatch) {
        Object.assign(state, loadFixtureState());
        const runId = decodeURIComponent(importCandidateExecutionRunMatch[1]);
        const runDetail = getImportReviewRunDetail('execution', runId);
        return buildJsonResponse({
          importCandidateExecutionRun: runDetail,
          ok: Boolean(runDetail),
        }, runDetail ? 200 : 404);
      }

      const importCandidateApplyRunMatch = path.match(/^\/api\/v1\/import-candidates\/apply-runs\/([^/]+)$/u);
      if (method === 'GET' && importCandidateApplyRunMatch) {
        Object.assign(state, loadFixtureState());
        const runId = decodeURIComponent(importCandidateApplyRunMatch[1]);
        const runDetail = getImportReviewRunDetail('apply', runId);
        return buildJsonResponse({
          importCandidateApplyRun: runDetail,
          ok: Boolean(runDetail),
        }, runDetail ? 200 : 404);
      }

      const importCandidatePreviewMatch = path.match(/^\/api\/v1\/import-candidates\/([^/]+)\/preview$/u);
      if (method === 'GET' && importCandidatePreviewMatch) {
        const importCandidateId = decodeURIComponent(importCandidatePreviewMatch[1]);
        const preview = getImportReviewWorkspaceState().previewById[importCandidateId] ?? null;
        return buildJsonResponse({
          importCandidatePreview: preview ? clone(preview) : null,
          ok: true,
        });
      }

      const importCandidateApplyPreviewMatch = path.match(/^\/api\/v1\/import-candidates\/([^/]+)\/apply-preview$/u);
      if (method === 'GET' && importCandidateApplyPreviewMatch) {
        const importCandidateId = decodeURIComponent(importCandidateApplyPreviewMatch[1]);
        const preview = getImportReviewWorkspaceState().applyPreviewById[importCandidateId] ?? null;
        return buildJsonResponse({
          importCandidateApplyPreview: preview ? clone(preview) : null,
          ok: true,
        });
      }

      const importCandidateTransitionMatch = path.match(/^\/api\/v1\/import-candidates\/([^/]+)\/(select|hold|reject|reopen)$/u);
      if (method === 'POST' && importCandidateTransitionMatch) {
        const importCandidateId = decodeURIComponent(importCandidateTransitionMatch[1]);
        const action = importCandidateTransitionMatch[2];
        const nextStatusByAction = {
          hold: 'held',
          reject: 'rejected',
          reopen: 'pending',
          select: 'selected',
        };
        Object.assign(state, loadFixtureState());
        const queuedFailure = consumeImportReviewTransitionFailure(importCandidateId, action);
        if (queuedFailure) {
          if (queuedFailure.kind === 'network') {
            throw new TypeError(queuedFailure.message ?? 'Network request failed.');
          }

          return buildJsonResponse({
            error: {
              code: queuedFailure.code ?? 'import_candidate_transition_failed',
              message: queuedFailure.message ?? 'Import candidate transition failed.',
            },
            ok: false,
          }, queuedFailure.status ?? 503);
        }

        const candidates = Array.isArray(state.importReviewCandidates)
          ? state.importReviewCandidates
          : [];
        const existingCandidate = candidates.find((candidate) => candidate.id === importCandidateId) ?? null;
        if (!existingCandidate) {
          return buildJsonResponse({
            error: {
              message: 'Import candidate not found.',
            },
            ok: false,
          }, 404);
        }

        const transitionedCandidate = {
          ...existingCandidate,
          status: nextStatusByAction[action] ?? existingCandidate.status,
          updatedAt: new Date().toISOString(),
        };
        state.importReviewCandidates = candidates.map((candidate) =>
          candidate.id === importCandidateId ? transitionedCandidate : candidate,
        );
        persistFixtureState();
        return buildJsonResponse({
          ok: true,
          review: {
            action,
            candidate: clone(transitionedCandidate),
          },
        });
      }

      const importCandidateDetailMatch = path.match(/^\/api\/v1\/import-candidates\/([^/]+)$/u);
      if (method === 'GET' && importCandidateDetailMatch) {
        const importCandidateId = decodeURIComponent(importCandidateDetailMatch[1]);
        const candidate = findImportReviewCandidate(importCandidateId);
        if (!candidate) {
          return buildJsonResponse({
            error: {
              message: 'Import candidate not found.',
            },
            ok: false,
          }, 404);
        }

        return buildJsonResponse({
          importCandidate: clone(candidate),
          ok: true,
        });
      }

      if (method === 'GET' && path === '/api/v1/metadata/musicbrainz/artists/search') {
        const normalized = normalizeSearchKey(url.searchParams.get('q'));
        const results = includeCacheSamples && normalized === fixture.artistDetailCacheSampleSearchQuery
          ? fixture.artistDetailCacheSampleCatalog.map((sample) => sample.searchResult)
          : fixture.artistSearchResults[normalized] ?? [];
        return buildJsonResponse({
          ok: true,
          provider: 'musicbrainz',
          search: {
            limit: 20,
            offset: 0,
            results,
            total: results.length,
          },
        });
      }

      if (method === 'GET' && path === '/api/v1/metadata/musicbrainz/releases/search') {
        const normalized = normalizeSearchKey(
          url.searchParams.get('artist') ?? url.searchParams.get('release'),
        );
        const results = fixture.releaseSearchResults[normalized] ?? [];
        return buildJsonResponse({
          ok: true,
          provider: 'musicbrainz',
          search: {
            limit: 20,
            offset: 0,
            results,
            total: results.length,
          },
        });
      }

      if (
        method === 'POST'
        && path.startsWith('/api/v1/metadata/musicbrainz/artists/')
        && path.endsWith('/import')
      ) {
        const musicBrainzArtistId = decodeURIComponent(
          path.slice('/api/v1/metadata/musicbrainz/artists/'.length, -'/import'.length),
        );
        const artistFixture = getArtistFixtureByMusicBrainzId(musicBrainzArtistId);
        if (!artistFixture) {
          return buildJsonResponse({ error: { message: 'Not found' }, ok: false }, 404);
        }

        markArtistAsAdded(musicBrainzArtistId);
        return buildJsonResponse({
          imported: {
            artistId: artistFixture.localPayload.artist.id,
            source: 'musicbrainz',
          },
          ok: true,
        }, 201);
      }

      if (method === 'GET' && path === '/api/v1/metadata/artists/monitored') {
        return buildJsonResponse({
          error: {
            code: 'endpoint_retired',
            message: 'The shared monitored artist list endpoint has been retired. Use the operator-scoped monitored artist projection endpoint instead.',
            replacementPath: '/api/v1/metadata/artists/monitored/operator',
          },
          ok: false,
        }, 410);
      }

      if (method === 'GET' && path === '/api/v1/metadata/artists/monitored/operator') {
        const currentState = loadFixtureState();
        const results = getAddedArtistIds(currentState)
          .map((artistId) => currentState.operatorProjectionsByMusicBrainzId[artistId])
          .filter((projection) => projection)
          .map((projection) => clone(projection));
        return buildJsonResponse({
          limit: 50,
          offset: 0,
          ok: true,
          results,
          total: results.length,
        });
      }

      if (method === 'GET' && path.startsWith('/api/v1/metadata/artists/') && path.endsWith('/operator')) {
        const localArtistId = decodeURIComponent(
          path.slice('/api/v1/metadata/artists/'.length, -'/operator'.length),
        );
        const artistFixture = getArtistFixtureByLocalId(localArtistId);
        if (!artistFixture) {
          return buildJsonResponse({ error: { message: 'Not found' }, ok: false }, 404);
        }

        const currentState = loadFixtureState();
        if (!getAddedArtistIds(currentState).includes(artistFixture.musicBrainzArtistId)) {
          return buildJsonResponse({ error: { message: 'Not found' }, ok: false }, 404);
        }

        return buildJsonResponse({
          ok: true,
          ...clone(currentState.operatorProjectionsByMusicBrainzId[artistFixture.musicBrainzArtistId]),
        });
      }

      if (method === 'PUT' && path.startsWith('/api/v1/metadata/artists/') && path.endsWith('/operator')) {
        Object.assign(state, loadFixtureState());
        const localArtistId = decodeURIComponent(
          path.slice('/api/v1/metadata/artists/'.length, -'/operator'.length),
        );
        const draft = parseJsonBody(input, init);
        const projection = updateOperatorProjectionFromDraft(localArtistId, draft);
        if (!projection) {
          return buildJsonResponse({ error: { message: 'Not found' }, ok: false }, 404);
        }

        return buildJsonResponse({
          ok: true,
          ...clone(projection),
          artistId: localArtistId,
          reconciliation: projection.operator.reconciliation,
          snapshot: {
            id: 'operator-snapshot-1',
            snapshotRevision: state.operatorSaveCount,
          },
        });
      }

      const manualEditionSelectionMatch = path.match(/^\/api\/v1\/metadata\/artists\/([^/]+)\/operator\/release-groups\/([^/]+)\/manual-edition-selection$/u);
      if (method === 'POST' && manualEditionSelectionMatch) {
        Object.assign(state, loadFixtureState());
        const localArtistId = decodeURIComponent(manualEditionSelectionMatch[1]);
        const metadataReleaseGroupId = decodeURIComponent(manualEditionSelectionMatch[2]);
        const payload = parseJsonBody(input, init);
        const artistFixture = getArtistFixtureByLocalId(localArtistId);
        const previousProjection = artistFixture
          ? state.operatorProjectionsByMusicBrainzId[artistFixture.musicBrainzArtistId]
          : null;
        if (!artistFixture || !previousProjection || typeof payload.metadataReleaseId !== 'string') {
          return buildJsonResponse({ error: { message: 'Not found' }, ok: false }, 404);
        }

        const selection = {
          metadataReleaseGroupId,
          resolvedMetadataReleaseId: payload.metadataReleaseId,
          selectionOrigin: 'manual_edition',
          selectionSource: 'manual',
          selectionState: 'selected',
        };
        const projection = updateOperatorProjectionFromDraft(localArtistId, {
          monitoring: previousProjection.operator.monitoring,
          releaseGroupSelections: [
            ...(previousProjection.operator.releaseGroupSelections ?? [])
              .filter((entry) => entry.metadataReleaseGroupId !== metadataReleaseGroupId),
            selection,
          ],
          trackOverrides: previousProjection.operator.trackOverrides ?? [],
        });

        return buildJsonResponse({
          alreadySelected: false,
          manualEditionSelection: {
            ...selection,
            metadataArtistId: localArtistId,
            metadataReleaseId: payload.metadataReleaseId,
          },
          ok: true,
          projection: clone(projection),
          reconciliation: projection.operator.reconciliation,
          snapshot: {
            id: `operator-snapshot-${state.operatorSaveCount}`,
            snapshotRevision: state.operatorSaveCount,
          },
        }, 202);
      }

      if (method === 'PUT' && path.startsWith('/api/v1/metadata/artists/') && path.endsWith('/monitoring')) {
        const localArtistId = decodeURIComponent(
          path.slice('/api/v1/metadata/artists/'.length, -'/monitoring'.length),
        );
        const artistFixture = getArtistFixtureByLocalId(localArtistId);
        if (!artistFixture) {
          return buildJsonResponse({ error: { message: 'Not found' }, ok: false }, 404);
        }

        markArtistAsAdded(artistFixture.musicBrainzArtistId);
        return buildJsonResponse({
          artistId: localArtistId,
          monitoring: {
            monitored: true,
          },
          ok: true,
        });
      }

      if (method === 'GET' && path.startsWith('/api/v1/metadata/artists/') && path.endsWith('/similar')) {
        await delaySimilarArtistsResponse(input, init);
        const artistId = path.slice('/api/v1/metadata/artists/'.length, -'/similar'.length);
        const artistFixture = getArtistFixtureByMusicBrainzId(artistId);
        return buildJsonResponse({
          ok: true,
          ...(artistFixture?.relatedArtists
            ? { similar: artistFixture.relatedArtists }
            : fixture.relatedArtistsById[artistId] ?? { similar: [] }),
        });
      }

      if (method === 'GET' && path.startsWith('/api/v1/metadata/musicbrainz/artists/') && path.endsWith('/local')) {
        await delayArtistDetailLocalResponse(input, init);
        const musicBrainzArtistId = decodeURIComponent(
          path.slice('/api/v1/metadata/musicbrainz/artists/'.length, -'/local'.length),
        );
        const artistFixture = getArtistFixtureByMusicBrainzId(musicBrainzArtistId);
        if (!artistFixture) {
          return buildJsonResponse({ error: { message: 'Not found' }, ok: false }, 404);
        }

        return buildJsonResponse({
          ok: true,
          ...artistFixture.localPayload,
        });
      }

      if (
        method === 'GET'
        && path.startsWith('/api/v1/metadata/musicbrainz/artists/')
        && path.endsWith('/release-groups')
      ) {
        const musicBrainzArtistId = decodeURIComponent(
          path.slice('/api/v1/metadata/musicbrainz/artists/'.length, -'/release-groups'.length),
        );
        const artistFixture = getArtistFixtureByMusicBrainzId(musicBrainzArtistId);
        if (!artistFixture) {
          return buildJsonResponse({ error: { message: 'Not found' }, ok: false }, 404);
        }

        return buildJsonResponse({
          limit: 100,
          offset: 0,
          ok: true,
          results: artistFixture.releaseGroups,
          total: artistFixture.releaseGroups.length,
        });
      }

      if (
        method === 'GET'
        && path.startsWith('/api/v1/metadata/musicbrainz/release-groups/')
        && path.endsWith('/tracklist')
      ) {
        const releaseGroupId = decodeURIComponent(
          path.slice('/api/v1/metadata/musicbrainz/release-groups/'.length, -'/tracklist'.length),
        );
        const tracklist = resolveFixtureTracklist(releaseGroupId, url.searchParams);
        if (tracklist) {
          return buildJsonResponse(clone(tracklist));
        }
      }

      if (method === 'POST' && path === '/api/v1/artwork/resolve-batch') {
        const payload = parseJsonBody(input, init);
        const requests = Array.isArray(payload.requests) ? payload.requests : [];
        const resolved = {};

        for (const request of requests) {
          const key = buildFixtureArtworkKey(
            request.ownerType ?? request.owner_type,
            request.ownerId ?? request.owner_id,
            request.artworkRole ?? request.artwork_role ?? 'cover_front',
          );
          if (fixture.artworkResponses[key]) {
            resolved[key] = fixture.artworkResponses[key];
          }
        }

        return buildJsonResponse({
          ok: true,
          resolved,
        });
      }

      if (method === 'GET' && path === '/api/v1/artwork/resolve') {
        const key = buildFixtureArtworkKey(
          url.searchParams.get('owner_type'),
          url.searchParams.get('owner_id'),
          url.searchParams.get('artwork_role') ?? 'cover_front',
        );
        const artwork = fixture.artworkResponses[key] ?? null;

        return buildJsonResponse({
          assetId: artwork?.assetId ?? null,
          cached: true,
          ok: true,
          sourceProvider: artwork ? 'fixture' : null,
          url: artwork?.url ?? null,
        });
      }

      return originalFetch(input, init);
    };
  }, {
    artistDetailLocalDelayMs,
    fixture: metadataFixture,
    includeArtistDetailCacheSamples,
    similarArtistsDelayMs,
  });

  await browserContext.route(/^https:\/\/coverartarchive\.org\//, async (route) => {
    await route.abort();
  });

  await browserContext.route(/\/api\/v1\/metadata\/musicbrainz\/release-groups\/([^/]+)\/tracklist(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const match = url.pathname.match(/\/api\/v1\/metadata\/musicbrainz\/release-groups\/([^/]+)\/tracklist$/);
    const releaseGroupId = match ? decodeURIComponent(match[1]) : null;
    const tracklist = releaseGroupId
      ? resolveTracklistPayload(metadataFixture.tracklistsByReleaseGroupId, releaseGroupId, url.searchParams)
      : null;

    if (!tracklist) {
      await route.continue();
      return;
    }

    await route.fulfill({
      body: JSON.stringify(tracklist),
      contentType: 'application/json',
      status: 200,
    });
  });
}
