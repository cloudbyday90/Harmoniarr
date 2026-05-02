import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSettingsPatch } from '../../src/server/validators/settings-validator.js';

test('normalizeSettingsPatch accepts artwork worker configuration settings', () => {
  const updates = normalizeSettingsPatch({
    artwork: {
      derivativeCacheSizeMb: 2048,
      derivativeFormat: 'jpeg',
      derivativeSizes: [320, 640, 1280],
      maxOriginalDimensionPixels: 4096,
      maxOriginalFileSizeBytes: 33554432,
      providerOrder: ['coverArtArchive', 'discogs'],
      refetchMissingAutomatically: true,
      refreshAfterImport: false,
      refreshAfterLibraryScan: true,
      refreshAfterMetadataRefresh: true,
    },
  });

  assert.deepEqual(updates, [{
    namespace: 'artwork',
    settingKey: 'derivativeCacheSizeMb',
    value: 2048,
  }, {
    namespace: 'artwork',
    settingKey: 'derivativeFormat',
    value: 'jpeg',
  }, {
    namespace: 'artwork',
    settingKey: 'derivativeSizes',
    value: [320, 640, 1280],
  }, {
    namespace: 'artwork',
    settingKey: 'maxOriginalDimensionPixels',
    value: 4096,
  }, {
    namespace: 'artwork',
    settingKey: 'maxOriginalFileSizeBytes',
    value: 33554432,
  }, {
    namespace: 'artwork',
    settingKey: 'providerOrder',
    value: ['coverArtArchive', 'discogs'],
  }, {
    namespace: 'artwork',
    settingKey: 'refetchMissingAutomatically',
    value: true,
  }, {
    namespace: 'artwork',
    settingKey: 'refreshAfterImport',
    value: false,
  }, {
    namespace: 'artwork',
    settingKey: 'refreshAfterLibraryScan',
    value: true,
  }, {
    namespace: 'artwork',
    settingKey: 'refreshAfterMetadataRefresh',
    value: true,
  }]);
});

test('normalizeSettingsPatch rejects unknown artwork providers', () => {
  assert.throws(
    () => normalizeSettingsPatch({
      artwork: {
        providerOrder: ['coverArtArchive', 'unknownProvider'],
      },
    }),
    (error) => error?.status === 400
      && error?.code === 'validation_error'
      && error?.message === 'artwork.providerOrder entries must be one of appleMusic, coverArtArchive, deezer, discogs, spotify, theAudioDb, tidal',
  );
});

test('normalizeSettingsPatch accepts explicit download path mappings', () => {
  const updates = normalizeSettingsPatch({
    paths: {
      downloadMappings: [{
        slskdPrefix: '/downloads/completed',
        harmoniarrPrefix: '/data/downloads/completed',
      }],
    },
  });

  assert.deepEqual(updates, [{
    namespace: 'paths',
    settingKey: 'downloadMappings',
    value: [{
      slskdPrefix: '/downloads/completed',
      slskdPrefixStyle: 'posix',
      harmoniarrPrefix: '/data/downloads/completed',
      harmoniarrPrefixStyle: 'posix',
    }],
  }]);
});

test('normalizeSettingsPatch accepts provider intake configuration settings', () => {
  const updates = normalizeSettingsPatch({
    providers: {
      appleMusicEnabled: true,
      appleMusicKeyId: ' apple-key ',
      appleMusicStorefront: 'GB',
      appleMusicTeamId: ' apple-team ',
      playlistExpansionPolicy: 'artist_discovery',
      requestTimeoutMs: 12000,
      spotifyClientId: ' spotify-client ',
      spotifyEnabled: true,
      youtubeClientId: ' youtube-client ',
      youtubeEnabled: true,
    },
  });

  assert.deepEqual(updates, [{
    namespace: 'providers',
    settingKey: 'appleMusicEnabled',
    value: true,
  }, {
    namespace: 'providers',
    settingKey: 'appleMusicKeyId',
    value: 'apple-key',
  }, {
    namespace: 'providers',
    settingKey: 'appleMusicStorefront',
    value: 'gb',
  }, {
    namespace: 'providers',
    settingKey: 'appleMusicTeamId',
    value: 'apple-team',
  }, {
    namespace: 'providers',
    settingKey: 'playlistExpansionPolicy',
    value: 'artist_discovery',
  }, {
    namespace: 'providers',
    settingKey: 'requestTimeoutMs',
    value: 12000,
  }, {
    namespace: 'providers',
    settingKey: 'spotifyClientId',
    value: 'spotify-client',
  }, {
    namespace: 'providers',
    settingKey: 'spotifyEnabled',
    value: true,
  }, {
    namespace: 'providers',
    settingKey: 'youtubeClientId',
    value: 'youtube-client',
  }, {
    namespace: 'providers',
    settingKey: 'youtubeEnabled',
    value: true,
  }]);
});

test('normalizeSettingsPatch rejects unknown provider playlist expansion policy', () => {
  assert.throws(
    () => normalizeSettingsPatch({
      providers: {
        playlistExpansionPolicy: 'everything',
      },
    }),
    (error) => error?.status === 400
      && error?.code === 'validation_error'
      && error?.message === 'providers.playlistExpansionPolicy must be one of bounded, artist_discovery',
  );
});

test('normalizeSettingsPatch rejects overlapping download path mappings', () => {
  assert.throws(
    () => normalizeSettingsPatch({
      paths: {
        downloadMappings: [{
          slskdPrefix: '/downloads',
          harmoniarrPrefix: '/data/downloads',
        }, {
          slskdPrefix: '/downloads/completed',
          harmoniarrPrefix: '/data/downloads/completed',
        }],
      },
    }),
    (error) => error?.status === 400
      && error?.code === 'validation_error'
      && error?.message === 'paths.downloadMappings contains overlapping slskdPrefix values: /downloads and /downloads/completed',
  );
});

test('normalizeSettingsPatch accepts per-user music root mappings', () => {
  const updates = normalizeSettingsPatch({
    paths: {
      userMusicRoots: [{
        relativeRoot: 'family/alice',
        userId: 'user-1',
      }],
    },
  });

  assert.deepEqual(updates, [{
    namespace: 'paths',
    settingKey: 'userMusicRoots',
    value: [{
      relativeRoot: 'family/alice',
      userId: 'user-1',
    }],
  }]);
});

test('normalizeSettingsPatch rejects per-user music roots with traversal segments', () => {
  assert.throws(
    () => normalizeSettingsPatch({
      paths: {
        userMusicRoots: [{
          relativeRoot: '../escape',
          userId: 'user-1',
        }],
      },
    }),
    (error) => error?.status === 400
      && error?.code === 'validation_error'
      && error?.message === 'paths.userMusicRoots[0].relativeRoot must not contain dot traversal segments',
  );
});
