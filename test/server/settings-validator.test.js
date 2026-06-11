import assert from 'node:assert/strict';
import test from 'node:test';
import { getDefaultSettings, normalizeSettingsPatch } from '../../src/server/validators/settings-validator.js';

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
      && error?.message === 'artwork.providerOrder entries must be one of appleMusic, coverArtArchive, deezer, discogs, fanartTv, spotify, theAudioDb, tidal',
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

test('normalizeSettingsPatch accepts fidelity threshold settings', () => {
  const updates = normalizeSettingsPatch({
    fidelity: {
      spectralAuthenticMinCutoffHz: 21000,
      spectralSuspiciousMinCutoffHz: 19500,
      spectralTranscodeMidCutoffHz: 16000,
      spectralMinSampleRateHz: 48000,
      trustWatchFailureCount: 4,
      trustWatchMaxSuccessRate: 0.45,
      trustWatchEvidenceCount: 3,
      trustHealthyEvidenceCount: 6,
      trustHealthyMinSuccessRate: 0.82,
    },
  });

  assert.deepEqual(updates, [
    { namespace: 'fidelity', settingKey: 'spectralAuthenticMinCutoffHz', value: 21000 },
    { namespace: 'fidelity', settingKey: 'spectralSuspiciousMinCutoffHz', value: 19500 },
    { namespace: 'fidelity', settingKey: 'spectralTranscodeMidCutoffHz', value: 16000 },
    { namespace: 'fidelity', settingKey: 'spectralMinSampleRateHz', value: 48000 },
    { namespace: 'fidelity', settingKey: 'trustWatchFailureCount', value: 4 },
    { namespace: 'fidelity', settingKey: 'trustWatchMaxSuccessRate', value: 0.45 },
    { namespace: 'fidelity', settingKey: 'trustWatchEvidenceCount', value: 3 },
    { namespace: 'fidelity', settingKey: 'trustHealthyEvidenceCount', value: 6 },
    { namespace: 'fidelity', settingKey: 'trustHealthyMinSuccessRate', value: 0.82 },
  ]);
});

test('normalizeSettingsPatch rejects an out-of-range fidelity cutoff', () => {
  assert.throws(
    () => normalizeSettingsPatch({ fidelity: { spectralAuthenticMinCutoffHz: 99999 } }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );
});

test('normalizeSettingsPatch rejects an out-of-range fidelity success rate', () => {
  assert.throws(
    () => normalizeSettingsPatch({ fidelity: { trustWatchMaxSuccessRate: 1.5 } }),
    (error) => error?.status === 400 && error?.code === 'validation_error',
  );
});

test('normalizeSettingsPatch accepts library discovery scheduling settings', () => {
  const updates = normalizeSettingsPatch({
    library: {
      discoveryCooldownHours: 12,
      discoveryFallbackCooldownHours: 4,
      discoveryBatchSize: 10,
      maxSearchAttempts: 5,
    },
  });

  assert.deepEqual(updates, [
    { namespace: 'library', settingKey: 'discoveryCooldownHours', value: 12 },
    { namespace: 'library', settingKey: 'discoveryFallbackCooldownHours', value: 4 },
    { namespace: 'library', settingKey: 'discoveryBatchSize', value: 10 },
    { namespace: 'library', settingKey: 'maxSearchAttempts', value: 5 },
  ]);
});

test('normalizeSettingsPatch rejects library discoveryCooldownHours below minimum', () => {
  assert.throws(
    () => normalizeSettingsPatch({ library: { discoveryCooldownHours: 0 } }),
    (error) => error?.status === 400
      && error?.code === 'validation_error'
      && error?.message === 'library.discoveryCooldownHours must be greater than or equal to 1',
  );
});

test('normalizeSettingsPatch rejects library discoveryCooldownHours above maximum', () => {
  assert.throws(
    () => normalizeSettingsPatch({ library: { discoveryCooldownHours: 200 } }),
    (error) => error?.status === 400
      && error?.code === 'validation_error'
      && error?.message === 'library.discoveryCooldownHours must be less than or equal to 168',
  );
});

test('normalizeSettingsPatch rejects non-integer library discoveryBatchSize', () => {
  assert.throws(
    () => normalizeSettingsPatch({ library: { discoveryBatchSize: 'five' } }),
    (error) => error?.status === 400
      && error?.code === 'validation_error'
      && error?.message === 'library.discoveryBatchSize must be an integer',
  );
});

test('normalizeSettingsPatch rejects float library maxSearchAttempts', () => {
  assert.throws(
    () => normalizeSettingsPatch({ library: { maxSearchAttempts: 2.5 } }),
    (error) => error?.status === 400
      && error?.code === 'validation_error'
      && error?.message === 'library.maxSearchAttempts must be an integer',
  );
});

test('getDefaultSettings includes library namespace with all four defaults', () => {
  const defaults = getDefaultSettings();

  assert.ok(defaults.library);
  assert.equal(defaults.library.discoveryCooldownHours, 6);
  assert.equal(defaults.library.discoveryFallbackCooldownHours, 2);
  assert.equal(defaults.library.discoveryBatchSize, 5);
  assert.equal(defaults.library.maxSearchAttempts, 3);
});

test('normalizeSettingsPatch accepts library settings at exact range boundaries', () => {
  const updates = normalizeSettingsPatch({
    library: {
      discoveryCooldownHours: 168,
      discoveryFallbackCooldownHours: 168,
      discoveryBatchSize: 50,
      maxSearchAttempts: 10,
    },
  });

  assert.deepEqual(updates, [
    { namespace: 'library', settingKey: 'discoveryCooldownHours', value: 168 },
    { namespace: 'library', settingKey: 'discoveryFallbackCooldownHours', value: 168 },
    { namespace: 'library', settingKey: 'discoveryBatchSize', value: 50 },
    { namespace: 'library', settingKey: 'maxSearchAttempts', value: 10 },
  ]);
});

test('normalizeSettingsPatch accepts scoring weight settings', () => {
  const updates = normalizeSettingsPatch({
    scoring: {
      weightFormatTier: 0.30,
      weightCandidateTrackMatch: 0.15,
      weightAudioDepth: 0.10,
      weightDuration: 0.10,
      weightFormatConsistency: 0.12,
      weightTrackCount: 0.08,
      weightPeerDelivery: 0.10,
      weightUploaderReputation: 0.05,
    },
  });

  assert.equal(updates.length, 8);
  assert.equal(updates[0].namespace, 'scoring');
  assert.equal(updates[0].settingKey, 'weightFormatTier');
  assert.equal(updates[0].value, 0.30);
});

test('normalizeSettingsPatch rejects scoring weight below minimum', () => {
  assert.throws(
    () => normalizeSettingsPatch({ scoring: { weightFormatTier: 0.005 } }),
    (error) => error?.status === 400
      && error?.code === 'validation_error'
      && error?.message === 'scoring.weightFormatTier must be between 0.01 and 1',
  );
});

test('normalizeSettingsPatch rejects scoring weight above maximum', () => {
  assert.throws(
    () => normalizeSettingsPatch({ scoring: { weightFormatTier: 1.5 } }),
    (error) => error?.status === 400
      && error?.code === 'validation_error'
      && error?.message === 'scoring.weightFormatTier must be between 0.01 and 1',
  );
});

test('normalizeSettingsPatch rejects non-number scoring weight', () => {
  assert.throws(
    () => normalizeSettingsPatch({ scoring: { weightFormatTier: 'high' } }),
    (error) => error?.status === 400
      && error?.code === 'validation_error'
      && error?.message === 'scoring.weightFormatTier must be a number',
  );
});

test('normalizeSettingsPatch accepts scoring weights at exact boundaries', () => {
  const updates = normalizeSettingsPatch({
    scoring: {
      weightFormatTier: 0.01,
      weightCandidateTrackMatch: 0.01,
      weightAudioDepth: 0.01,
      weightDuration: 0.01,
      weightFormatConsistency: 0.01,
      weightTrackCount: 0.01,
      weightPeerDelivery: 0.01,
      weightUploaderReputation: 0.93,
    },
  });

  assert.equal(updates.length, 8);
  assert.equal(updates[0].value, 0.01);
  assert.equal(updates[7].value, 0.93);
});

test('normalizeSettingsPatch rejects scoring weights that do not sum to 1.0', () => {
  assert.throws(
    () => normalizeSettingsPatch({
      scoring: {
        weightFormatTier: 0.40,
        weightCandidateTrackMatch: 0.20,
        weightAudioDepth: 0.15,
        weightDuration: 0.15,
        weightFormatConsistency: 0.10,
        weightTrackCount: 0.05,
        weightPeerDelivery: 0.03,
        weightUploaderReputation: 0.02,
      },
    }),
    (error) => error?.status === 400
      && error?.code === 'validation_error'
      && error?.message === 'scoring weights must sum to 1.0',
  );
});

test('normalizeSettingsPatch accepts scoring weights that sum to 1.0', () => {
  const updates = normalizeSettingsPatch({
    scoring: {
      weightFormatTier: 0.25,
      weightCandidateTrackMatch: 0.20,
      weightAudioDepth: 0.12,
      weightDuration: 0.12,
      weightFormatConsistency: 0.10,
      weightTrackCount: 0.08,
      weightPeerDelivery: 0.08,
      weightUploaderReputation: 0.05,
    },
  });

  assert.equal(updates.length, 8);
  const sum = updates.reduce((s, u) => s + u.value, 0);
  assert.ok(Math.abs(sum - 1.0) < 0.0001);
});

test('normalizeSettingsPatch accepts partial scoring patch without sum check', () => {
  const updates = normalizeSettingsPatch({
    scoring: {
      weightFormatTier: 0.30,
      weightDuration: 0.10,
    },
  });

  assert.equal(updates.length, 2);
  assert.equal(updates[0].settingKey, 'weightFormatTier');
  assert.equal(updates[0].value, 0.30);
});

test('getDefaultSettings includes scoring namespace with all eight defaults', () => {
  const defaults = getDefaultSettings();
  assert.ok(defaults.scoring);
  assert.equal(defaults.scoring.weightFormatTier, 0.25);
  assert.equal(defaults.scoring.weightCandidateTrackMatch, 0.20);
  assert.equal(defaults.scoring.weightAudioDepth, 0.12);
  assert.equal(defaults.scoring.weightDuration, 0.12);
  assert.equal(defaults.scoring.weightFormatConsistency, 0.10);
  assert.equal(defaults.scoring.weightTrackCount, 0.08);
  assert.equal(defaults.scoring.weightPeerDelivery, 0.08);
  assert.equal(defaults.scoring.weightUploaderReputation, 0.05);
});
