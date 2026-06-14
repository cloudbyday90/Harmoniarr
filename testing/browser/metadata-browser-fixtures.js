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

const metadataFixture = {
  artistSearchResults: {
    'boards of canada': [boardsOfCanadaArtist],
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
    'music has the right to children': [musicHasTheRightToChildren],
  },
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
      allReleases: [musicHasTheRightToChildrenRelease],
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
    'metadata-rg-mhtrtc': {
      allReleases: [musicHasTheRightToChildrenRelease],
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

export async function installMetadataBrowserFixtures(browserContext) {
  await browserContext.addInitScript(({ fixture }) => {
    const originalFetch = globalThis.fetch.bind(globalThis);
    const fixtureStateStorageKey = 'harmoniarr:metadata-browser-fixture-state:v1';
    const state = loadFixtureState();

    function getArtistFixtureEntries() {
      return [
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
        autechreIsAdded: false,
        boardsIsAdded: false,
        boardsOperatorProjection: operatorProjectionsByMusicBrainzId['mb-artist-boards'],
        operatorSaveCount: 0,
        operatorProjectionsByMusicBrainzId,
      };
    }

    function loadFixtureState() {
      try {
        const rawState = globalThis.sessionStorage.getItem(fixtureStateStorageKey);
        if (rawState) {
          return {
            ...createInitialFixtureState(),
            ...JSON.parse(rawState),
          };
        }
      } catch {
        // Fall through to a clean state when storage is unavailable or stale.
      }

      return createInitialFixtureState();
    }

    function persistFixtureState() {
      globalThis.sessionStorage.setItem(fixtureStateStorageKey, JSON.stringify({
        addedArtistIds: getAddedArtistIds(),
        autechreIsAdded: state.autechreIsAdded,
        boardsIsAdded: state.boardsIsAdded,
        boardsOperatorProjection: state.boardsOperatorProjection,
        operatorSaveCount: state.operatorSaveCount,
        operatorProjectionsByMusicBrainzId: state.operatorProjectionsByMusicBrainzId,
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
            selectionSource: explicitSelection?.selectionSource ?? 'policy',
            selectionState: explicitSelection?.selectionState ?? (selectedByPolicy ? 'selected' : 'unselected'),
            trackOverrideSummary: {
              desiredCount: releaseGroupTrackOverrides
                .filter((override) => override.isDesired === true)
                .length,
              orphanedCount: 0,
              reviewNeededCount: 0,
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
        orphanedTrackOverrideCount: 0,
        partialReleaseGroupCount,
        policySelectionCount: releaseGroups.length - releaseGroupSelections.length,
        releaseGroupCount: releaseGroups.length,
        reviewNeededTrackOverrideCount: 0,
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
      }
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

      if (method === 'GET' && path === '/api/v1/metadata/musicbrainz/artists/search') {
        const normalized = normalizeSearchKey(url.searchParams.get('q'));
        const results = fixture.artistSearchResults[normalized] ?? [];
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
        const localArtistId = decodeURIComponent(
          path.slice('/api/v1/metadata/artists/'.length, -'/operator'.length),
        );
        const rawBody = init?.body
          ?? (typeof input === 'object' && input !== null && 'body' in input ? input.body : '{}');
        const draft = JSON.parse(typeof rawBody === 'string' ? rawBody : '{}');
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
        const artistId = path.slice('/api/v1/metadata/artists/'.length, -'/similar'.length);
        return buildJsonResponse({
          ok: true,
          ...(fixture.relatedArtistsById[artistId] ?? { similar: [] }),
        });
      }

      if (method === 'GET' && path.startsWith('/api/v1/metadata/musicbrainz/artists/') && path.endsWith('/local')) {
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
        const tracklist = fixture.tracklistsByReleaseGroupId[releaseGroupId] ?? null;
        if (tracklist) {
          return buildJsonResponse(clone(tracklist));
        }
      }

      if (method === 'POST' && path === '/api/v1/artwork/resolve-batch') {
        const rawBody = init?.body
          ?? (typeof input === 'object' && input !== null && 'body' in input ? input.body : '{}');
        const payload = JSON.parse(typeof rawBody === 'string' ? rawBody : '{}');
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
    fixture: metadataFixture,
  });

  await browserContext.route(/^https:\/\/coverartarchive\.org\//, async (route) => {
    await route.abort();
  });

  await browserContext.route(/\/api\/v1\/metadata\/musicbrainz\/release-groups\/([^/]+)\/tracklist(?:\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const match = url.pathname.match(/\/api\/v1\/metadata\/musicbrainz\/release-groups\/([^/]+)\/tracklist$/);
    const releaseGroupId = match ? decodeURIComponent(match[1]) : null;
    const tracklist = releaseGroupId ? metadataFixture.tracklistsByReleaseGroupId[releaseGroupId] : null;

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
