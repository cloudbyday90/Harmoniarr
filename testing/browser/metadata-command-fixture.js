/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { createApp } from '../../src/server/app.js';
import { createMetadataModule } from '../../src/server/metadata/metadata-module.js';

export const metadataCommandIds = Object.freeze({
  artist: '11111111-1111-4111-8111-111111111111',
  artistMbid: '22222222-2222-4222-8222-222222222222',
  groupMbid: '33333333-3333-4333-8333-333333333333',
  group: '44444444-4444-4444-8444-444444444444',
  providerGroupMbid: '55555555-5555-4555-8555-555555555555',
  releaseMbid: '66666666-6666-4666-8666-666666666666',
  release: '77777777-7777-4777-8777-777777777777',
  providerReleaseMbid: '88888888-8888-4888-8888-888888888888',
  providerGroup: '99999999-9999-4999-8999-999999999999',
  providerRelease: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
});

// Real HTTP/session/CSRF routes with controlled catalog and command owners.
// This fixture deliberately does not persist provider imports or queue work.
export function createMetadataCommandFixture({ history = null, monitoring = { isMonitored: false } } = {}) {
  const id = metadataCommandIds;
  let calls = []; let groupImported = false; let releaseImported = false;
  const artist = { id: id.artist, name: 'Fixture artist', source: { musicbrainzArtistId: id.artistMbid } };
  const group = { id: id.group, artistId: id.artist, title: 'Saved group', primaryType: 'Album', source: { musicbrainzReleaseGroupId: id.groupMbid } };
  const providerGroup = { id: id.providerGroup, artistId: id.artist, title: 'Provider group', primaryType: 'Album', source: { musicbrainzReleaseGroupId: id.providerGroupMbid } };
  const release = { id: id.release, releaseGroupId: id.group, title: 'Saved edition', source: { musicbrainzReleaseId: id.releaseMbid } };
  const providerRelease = { id: id.providerRelease, releaseGroupId: id.providerGroup, title: 'Provider edition', source: { musicbrainzReleaseId: id.providerReleaseMbid } };
  const localArtist = () => ({ artist, aliases: [], detectionEvents: history?.entries ?? [], detectionEventsPageInfo: history?.pageInfo ?? { hasMore: false, nextCursor: null }, monitoring, releaseGroups: groupImported ? [group, providerGroup] : [group], releases: releaseImported ? [release, providerRelease] : [release] });
  const localGroup = selected => ({ artist, releaseGroup: selected, releases: selected.id === id.group ? [release] : releaseImported ? [providerRelease] : [] });
  const localRelease = selected => ({ artist, release: selected, releaseGroup: selected.id === id.release ? group : providerGroup, media: [] });
  function record(command, args) { calls.push({ command, args }); }

  return {
    get calls() { return calls; },
    createAppFn(options) {
      calls = []; groupImported = false; releaseImported = false;
      return createApp({ ...options, createMetadataModule: dependencies => {
        const module = createMetadataModule(dependencies);
        return { ...module, routeDependencies: {
          ...module.routeDependencies,
          ...(history ? { getMetadataArtistDetectionEvents: history.readPage } : {}),
          getMetadataArtist: async () => localArtist(),
          getMetadataArtistByMusicBrainzId: async () => localArtist(),
          getMetadataReleaseGroup: async ({ releaseGroupId }) => localGroup(releaseGroupId === id.group ? group : providerGroup),
          getMetadataReleaseGroupByMusicBrainzId: async ({ musicBrainzReleaseGroupId }) => localGroup(musicBrainzReleaseGroupId === id.groupMbid ? group : providerGroup),
          getMetadataRelease: async ({ releaseId }) => localRelease(releaseId === id.release ? release : providerRelease),
          getMetadataReleaseByMusicBrainzId: async ({ musicBrainzReleaseId }) => localRelease(musicBrainzReleaseId === id.releaseMbid ? release : providerRelease),
          searchMusicBrainzArtists: async () => ({ results: [{ id: id.artistMbid, name: artist.name }], total: 1 }),
          browseMusicBrainzArtistReleaseGroups: async () => ({ results: [{ id: id.groupMbid, title: group.title }, { id: id.providerGroupMbid, title: providerGroup.title }] }),
          getMusicBrainzReleaseGroupReleases: async () => ({ results: [{ id: id.providerReleaseMbid, title: providerRelease.title }] }),
          startMetadataArtistRefresh: async args => { record('refresh', args); return { run: { id: 'fixture-refresh-run' } }; },
          importMusicBrainzArtist: async args => { record('artist', args); return { artist, source: 'fixture' }; },
          importMusicBrainzReleaseGroup: async args => { record('group', args); groupImported = true; return { artist, releaseGroup: providerGroup, source: 'fixture' }; },
          importMusicBrainzRelease: async args => { record('release', args); releaseImported = true; return { artist, releaseGroup: providerGroup, release: providerRelease, source: 'fixture' }; },
        } };
      } });
    },
  };
}
