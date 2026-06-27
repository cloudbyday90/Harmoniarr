/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const fixture = Object.freeze({
  checkedAt: '2026-06-25T16:00:00.000Z',
  recent: Object.freeze([
    Object.freeze({
      artistName: 'Aphex Twin',
      firstReleaseDate: '2026-06-14',
      metadataArtistId: 'metadata-artist-aphex',
      metadataReleaseGroupId: 'metadata-rg-aphex-selected',
      musicbrainzArtistId: 'mb-artist-aphex',
      musicbrainzReleaseGroupId: 'mb-rg-aphex-selected',
      releaseGroupTitle: 'Selected Ambient Works III',
      releaseGroupType: 'Album',
    }),
    Object.freeze({
      artistName: 'Floating Points',
      firstReleaseDate: '2026-06-20',
      metadataArtistId: 'metadata-artist-floating-points',
      metadataReleaseGroupId: 'metadata-rg-cascade-live',
      musicbrainzArtistId: 'mb-artist-floating-points',
      musicbrainzReleaseGroupId: 'mb-rg-cascade-live',
      releaseGroupTitle: 'Cascade Live',
      releaseGroupType: 'EP',
    }),
  ]),
  upcoming: Object.freeze([
    Object.freeze({
      artistName: 'Nils Frahm',
      firstReleaseDate: '2026-07-10',
      metadataArtistId: 'metadata-artist-nils-frahm',
      metadataReleaseGroupId: 'metadata-rg-day-live',
      musicbrainzArtistId: 'mb-artist-nils-frahm',
      musicbrainzReleaseGroupId: 'mb-rg-day-live',
      releaseGroupTitle: 'Day Live Sessions',
      releaseGroupType: 'Album',
    }),
    Object.freeze({
      artistName: 'Kelly Lee Owens',
      firstReleaseDate: '2026-08-21',
      metadataArtistId: 'metadata-artist-kelly-lee-owens',
      metadataReleaseGroupId: 'metadata-rg-dreamstate-remixes',
      musicbrainzArtistId: 'mb-artist-kelly-lee-owens',
      musicbrainzReleaseGroupId: 'mb-rg-dreamstate-remixes',
      releaseGroupTitle: 'Dreamstate Remixes',
      releaseGroupType: 'Single',
    }),
  ]),
  windows: Object.freeze({
    recentDays: 30,
    upcomingDays: 90,
  }),
});

export async function installReleaseRadarBrowserFixtures(browserContext) {
  await browserContext.addInitScript(({ fixturePayload }) => {
    const originalFetch = globalThis.fetch.bind(globalThis);

    function buildJsonResponse(body, status = 200) {
      return new Response(JSON.stringify(body), {
        headers: {
          'Content-Type': 'application/json',
        },
        status,
      });
    }

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
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

      if (method === 'GET' && url.pathname === '/api/v1/library/release-radar') {
        return buildJsonResponse({
          ok: true,
          ...clone(fixturePayload),
        });
      }

      return originalFetch(input, init);
    };
  }, { fixturePayload: fixture });
}
