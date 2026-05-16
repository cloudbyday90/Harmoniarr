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
    [buildArtworkKey('musicbrainz_release_group', musicHasTheRightToChildren.releaseGroup.id, 'cover_front')]: {
      assetId: 'asset-mhtrtc-rg',
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
      musicbrainzArtistId: boardsOfCanadaArtist.id,
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
  boardsReleaseGroups: [
    {
      artistCredit: 'Boards of Canada',
      firstReleaseDate: '1998-04-20',
      id: 'mb-rg-mhtrtc',
      musicbrainzReleaseGroupId: 'mb-rg-mhtrtc',
      primaryType: 'Album',
      title: 'Music Has the Right to Children',
    },
    {
      artistCredit: 'Boards of Canada',
      firstReleaseDate: '2002-11-18',
      id: 'mb-rg-geogaddi',
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
      ],
    },
    [autechreArtist.id]: { similar: [] },
    [tychoArtist.id]: { similar: [] },
  },
  releaseSearchResults: {
    'boards of canada': [musicHasTheRightToChildren],
    'music has the right to children': [musicHasTheRightToChildren],
  },
};

export async function installMetadataBrowserFixtures(browserContext) {
  await browserContext.addInitScript(({ fixture }) => {
    const originalFetch = globalThis.fetch.bind(globalThis);

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

      if (method === 'POST' && path === '/api/v1/metadata/musicbrainz/artists/mb-artist-boards/import') {
        return buildJsonResponse({
          imported: {
            artistId: fixture.boardsLocalArtistPayload.artist.id,
            source: 'musicbrainz',
          },
          ok: true,
        }, 201);
      }

      if (method === 'PUT' && path === `/api/v1/metadata/artists/${fixture.boardsLocalArtistPayload.artist.id}/monitoring`) {
        return buildJsonResponse({
          artistId: fixture.boardsLocalArtistPayload.artist.id,
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

      if (method === 'GET' && path === '/api/v1/metadata/musicbrainz/artists/mb-artist-boards/local') {
        return buildJsonResponse({
          ok: true,
          ...fixture.boardsLocalArtistPayload,
        });
      }

      if (method === 'GET' && path === '/api/v1/metadata/musicbrainz/artists/mb-artist-boards/release-groups') {
        return buildJsonResponse({
          limit: 100,
          offset: 0,
          ok: true,
          results: fixture.boardsReleaseGroups,
          total: fixture.boardsReleaseGroups.length,
        });
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
}
