import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSettingsUpdatePayload,
  normalizeDownloadMappings,
  normalizeUserMusicRoots,
} from '../../src/client/lib/settings-form.js';

function createArtworkForm() {
  return {
    captureEmbedded: true,
    captureFolderArtwork: true,
    dailyQuotaLimit: 1000,
    derivativeCacheSizeMb: 1024,
    derivativeFormat: 'webp',
    derivativeRetentionDays: 30,
    derivativeSizesText: '256, 512',
    fetchEnabled: true,
    maxOriginalDimensionPixels: 4000,
    maxOriginalFileSizeBytes: 20971520,
    providerOrderText: 'coverArtArchive',
    refetchMissingAutomatically: false,
    refreshAfterImport: true,
    refreshAfterLibraryScan: false,
    refreshAfterMetadataRefresh: true,
    unassignedRetentionDays: 90,
  };
}

function createLibraryForm() {
  return {
    discoveryCooldownHours: 6,
    discoveryFallbackCooldownHours: 2,
    discoveryBatchSize: 5,
    maxSearchAttempts: 3,
  };
}

function createScoringForm() {
  return {
    weightFormatTier: 0.25,
    weightCandidateTrackMatch: 0.20,
    weightAudioDepth: 0.12,
    weightDuration: 0.12,
    weightFormatConsistency: 0.10,
    weightTrackCount: 0.08,
    weightPeerDelivery: 0.08,
    weightUploaderReputation: 0.05,
  };
}

function createAcquisitionForm() {
  return {
    autoIgnoreEnabled: false,
    autoIgnoreCooldownHours: 24,
  };
}

function createRetentionForm() {
  return {
    operationRunMaxAgeDays: 90,
    operationRunRetainCountPerType: 50,
    outcomeEventMaxAgeDays: 180,
  };
}

function createFidelityForm() {
  return {
    spectralAuthenticMinCutoffHz: 20000,
    spectralSuspiciousMinCutoffHz: 19000,
    spectralTranscodeMidCutoffHz: 16000,
    spectralMinSampleRateHz: 44100,
    trustWatchFailureCount: 3,
    trustWatchMaxSuccessRate: 0.5,
    trustWatchEvidenceCount: 3,
    trustHealthyEvidenceCount: 5,
    trustHealthyMinSuccessRate: 0.8,
  };
}

function createNamingForm() {
  return {
    artistFolderFormat: '{ArtistName}',
    albumFolderFormat: '{AlbumTitle} ({ReleaseYear})',
    trackFilenameFormat: '{TrackNumber} - {SongTitle}',
    multiDiscTrackFilenameFormat: '{DiscNumber}-{TrackNumber} - {SongTitle}',
  };
}

test('buildSettingsUpdatePayload preserves the existing slskd api key when the field is left blank', () => {
  const payload = buildSettingsUpdatePayload({
    artwork: createArtworkForm(),
    library: createLibraryForm(),
    scoring: createScoringForm(),
    acquisition: createAcquisitionForm(),
    retention: createRetentionForm(),
    fidelity: createFidelityForm(),
    naming: createNamingForm(),
    security: {
      csrfProtectionMode: 'disabled',
      enforceHttps: false,
      secureCookies: false,
      strictTransportSecurity: false,
    },
    system: { baseUrl: '', logLevel: 'info' },
    paths: {
      downloadMappings: [{ slskdPrefix: '/downloads/completed', harmoniarrPrefix: '/data/downloads/completed' }],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
      userMusicRoots: [{ userId: 'user-1', relativeRoot: 'family/alice' }],
    },
    slskd: {
      apiKey: '   ',
      baseUrl: 'http://slskd.internal:5030',
      clearApiKey: false,
      requestTimeoutMs: 15000,
    },
  });

  assert.deepEqual(payload, {
    artwork: {
      captureEmbedded: true,
      captureFolderArtwork: true,
      dailyQuotaLimit: 1000,
      derivativeCacheSizeMb: 1024,
      derivativeFormat: 'webp',
      derivativeRetentionDays: 30,
      derivativeSizes: [256, 512],
      fetchEnabled: true,
      maxOriginalDimensionPixels: 4000,
      maxOriginalFileSizeBytes: 20971520,
      providerOrder: ['coverArtArchive'],
      refetchMissingAutomatically: false,
      refreshAfterImport: true,
      refreshAfterLibraryScan: false,
      refreshAfterMetadataRefresh: true,
      unassignedRetentionDays: 90,
    },
    security: {
      csrfProtectionMode: 'disabled',
      enforceHttps: false,
      secureCookies: false,
      strictTransportSecurity: false,
    },
    system: { baseUrl: '', logLevel: 'info' },
    paths: {
      downloadMappings: [{ slskdPrefix: '/downloads/completed', harmoniarrPrefix: '/data/downloads/completed' }],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
      userMusicRoots: [{ userId: 'user-1', relativeRoot: 'family/alice' }],
    },
    library: {
      discoveryCooldownHours: 6,
      discoveryFallbackCooldownHours: 2,
      discoveryBatchSize: 5,
      maxSearchAttempts: 3,
    },
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
    acquisition: {
      autoIgnoreEnabled: false,
      autoIgnoreCooldownHours: 24,
    },
    retention: {
      operationRunMaxAgeDays: 90,
      operationRunRetainCountPerType: 50,
      outcomeEventMaxAgeDays: 180,
    },
    fidelity: {
      spectralAuthenticMinCutoffHz: 20000,
      spectralSuspiciousMinCutoffHz: 19000,
      spectralTranscodeMidCutoffHz: 16000,
      spectralMinSampleRateHz: 44100,
      trustWatchFailureCount: 3,
      trustWatchMaxSuccessRate: 0.5,
      trustWatchEvidenceCount: 3,
      trustHealthyEvidenceCount: 5,
      trustHealthyMinSuccessRate: 0.8,
    },
    naming: {
      artistFolderFormat: '{ArtistName}',
      albumFolderFormat: '{AlbumTitle} ({ReleaseYear})',
      trackFilenameFormat: '{TrackNumber} - {SongTitle}',
      multiDiscTrackFilenameFormat: '{DiscNumber}-{TrackNumber} - {SongTitle}',
    },
    slskd: {
      baseUrl: 'http://slskd.internal:5030',
      requestTimeoutMs: 15000,
    },
  });
});

test('buildSettingsUpdatePayload includes slskd api key updates and explicit clear requests', () => {
  const withSecret = buildSettingsUpdatePayload({
    artwork: createArtworkForm(),
    library: createLibraryForm(),
    security: {
      csrfProtectionMode: 'required',
      enforceHttps: true,
      secureCookies: true,
      strictTransportSecurity: true,
    },
    system: { baseUrl: '', logLevel: 'info' },
    paths: {
      downloadMappings: [],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
      userMusicRoots: [],
    },
    slskd: {
      apiKey: ' next-api-key ',
      baseUrl: 'http://slskd.internal:5030',
      clearApiKey: false,
      requestTimeoutMs: 15000,
    },
  });
  const cleared = buildSettingsUpdatePayload({
    artwork: createArtworkForm(),
    library: createLibraryForm(),
    security: {
      csrfProtectionMode: 'required',
      enforceHttps: true,
      secureCookies: true,
      strictTransportSecurity: true,
    },
    system: { baseUrl: '', logLevel: 'info' },
    paths: {
      downloadMappings: [],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
      userMusicRoots: [],
    },
    slskd: {
      apiKey: '',
      baseUrl: 'http://slskd.internal:5030',
      clearApiKey: true,
      requestTimeoutMs: 15000,
    },
  });

  assert.equal(withSecret.slskd.apiKey, 'next-api-key');
  assert.equal(cleared.slskd.clearApiKey, true);
  assert.equal(withSecret.security.csrfProtectionMode, 'required');
  assert.equal(withSecret.security.enforceHttps, true);
});

test('normalizeDownloadMappings keeps only string mapping values', () => {
  assert.deepEqual(normalizeDownloadMappings([{ slskdPrefix: '/downloads', harmoniarrPrefix: 42 }]), [{
    slskdPrefix: '/downloads',
    harmoniarrPrefix: '',
  }]);
});

test('normalizeUserMusicRoots keeps only string mapping values', () => {
  assert.deepEqual(normalizeUserMusicRoots([{ userId: 'user-1', relativeRoot: 42 }]), [{
    relativeRoot: '',
    userId: 'user-1',
  }]);
});

test('buildSettingsUpdatePayload includes provider intake settings and secret mutations when present', () => {
  const payload = buildSettingsUpdatePayload({
    artwork: createArtworkForm(),
    library: createLibraryForm(),
    security: {
      csrfProtectionMode: 'required',
      enforceHttps: true,
      secureCookies: true,
      strictTransportSecurity: true,
    },
    system: { baseUrl: '', logLevel: 'info' },
    paths: {
      downloadMappings: [],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
      userMusicRoots: [],
    },
    providers: {
      appleMusicEnabled: true,
      appleMusicKeyId: 'apple-key',
      appleMusicPrivateKey: ' apple-private-key ',
      appleMusicStorefront: 'us',
      appleMusicTeamId: 'apple-team',
      clearAppleMusicPrivateKey: false,
      clearSpotifyClientSecret: false,
      clearYoutubeApiKey: true,
      clearYoutubeClientSecret: false,
      fanartTvEnabled: false,
      playlistExpansionPolicy: 'artist_discovery',
      requestTimeoutMs: 12000,
      spotifyClientId: 'spotify-client',
      spotifyClientSecret: ' spotify-secret ',
      spotifyEnabled: true,
      youtubeApiKey: '',
      youtubeClientId: 'youtube-client',
      youtubeClientSecret: ' youtube-secret ',
      youtubeEnabled: true,
    },
    slskd: {
      apiKey: '',
      baseUrl: 'http://slskd.internal:5030',
      clearApiKey: false,
      requestTimeoutMs: 15000,
    },
  });

  assert.deepEqual(payload.providers, {
    appleMusicEnabled: true,
    appleMusicKeyId: 'apple-key',
    appleMusicPrivateKey: 'apple-private-key',
    appleMusicStorefront: 'us',
    appleMusicTeamId: 'apple-team',
    clearYoutubeApiKey: true,
    fanartTvEnabled: false,
    playlistExpansionPolicy: 'artist_discovery',
    requestTimeoutMs: 12000,
    spotifyClientId: 'spotify-client',
    spotifyClientSecret: 'spotify-secret',
    spotifyEnabled: true,
    youtubeClientId: 'youtube-client',
    youtubeClientSecret: 'youtube-secret',
    youtubeEnabled: true,
  });
});

test('buildSettingsUpdatePayload includes library discovery scheduling fields', () => {
  const payload = buildSettingsUpdatePayload({
    artwork: createArtworkForm(),
    library: {
      discoveryCooldownHours: 12,
      discoveryFallbackCooldownHours: 4,
      discoveryBatchSize: 10,
      maxSearchAttempts: 5,
    },
    security: {
      csrfProtectionMode: 'disabled',
      enforceHttps: false,
      secureCookies: false,
      strictTransportSecurity: false,
    },
    system: { baseUrl: '', logLevel: 'info' },
    paths: {
      downloadMappings: [],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
      userMusicRoots: [],
    },
    slskd: {
      apiKey: '',
      baseUrl: 'http://slskd.internal:5030',
      clearApiKey: false,
      requestTimeoutMs: 15000,
    },
  });

  assert.deepEqual(payload.library, {
    discoveryCooldownHours: 12,
    discoveryFallbackCooldownHours: 4,
    discoveryBatchSize: 10,
    maxSearchAttempts: 5,
  });
});

test('buildSettingsUpdatePayload includes scoring weight fields', () => {
  const payload = buildSettingsUpdatePayload({
    artwork: createArtworkForm(),
    library: createLibraryForm(),
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
    security: {
      csrfProtectionMode: 'disabled',
      enforceHttps: false,
      secureCookies: false,
      strictTransportSecurity: false,
    },
    system: { baseUrl: '', logLevel: 'info' },
    paths: {
      downloadMappings: [],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
      userMusicRoots: [],
    },
    slskd: {
      apiKey: '',
      baseUrl: 'http://slskd.internal:5030',
      clearApiKey: false,
      requestTimeoutMs: 15000,
    },
  });

  assert.deepEqual(payload.scoring, {
    weightFormatTier: 0.30,
    weightCandidateTrackMatch: 0.15,
    weightAudioDepth: 0.10,
    weightDuration: 0.10,
    weightFormatConsistency: 0.12,
    weightTrackCount: 0.08,
    weightPeerDelivery: 0.10,
    weightUploaderReputation: 0.05,
  });
});

test('buildSettingsUpdatePayload includes acquisition policy fields', () => {
  const payload = buildSettingsUpdatePayload({
    artwork: createArtworkForm(),
    library: createLibraryForm(),
    scoring: createScoringForm(),
    acquisition: {
      autoIgnoreEnabled: true,
      autoIgnoreCooldownHours: 48,
    },
    security: {
      csrfProtectionMode: 'disabled',
      enforceHttps: false,
      secureCookies: false,
      strictTransportSecurity: false,
    },
    system: { baseUrl: '', logLevel: 'info' },
    paths: {
      downloadMappings: [],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
      userMusicRoots: [],
    },
    slskd: {
      apiKey: '',
      baseUrl: 'http://slskd.internal:5030',
      clearApiKey: false,
      requestTimeoutMs: 15000,
    },
  });

  assert.deepEqual(payload.acquisition, {
    autoIgnoreEnabled: true,
    autoIgnoreCooldownHours: 48,
  });
});

test('buildSettingsUpdatePayload includes acquisition defaults from createAcquisitionForm', () => {
  const payload = buildSettingsUpdatePayload({
    artwork: createArtworkForm(),
    library: createLibraryForm(),
    scoring: createScoringForm(),
    acquisition: createAcquisitionForm(),
    security: {
      csrfProtectionMode: 'disabled',
      enforceHttps: false,
      secureCookies: false,
      strictTransportSecurity: false,
    },
    system: { baseUrl: '', logLevel: 'info' },
    paths: {
      downloadMappings: [],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
      userMusicRoots: [],
    },
    slskd: {
      apiKey: '',
      baseUrl: 'http://slskd.internal:5030',
      clearApiKey: false,
      requestTimeoutMs: 15000,
    },
  });

  assert.deepEqual(payload.acquisition, {
    autoIgnoreEnabled: false,
    autoIgnoreCooldownHours: 24,
  });
});

test('buildSettingsUpdatePayload includes retention fields', () => {
  const payload = buildSettingsUpdatePayload({
    artwork: createArtworkForm(),
    library: createLibraryForm(),
    scoring: createScoringForm(),
    acquisition: createAcquisitionForm(),
    retention: {
      operationRunMaxAgeDays: 180,
      operationRunRetainCountPerType: 100,
      outcomeEventMaxAgeDays: 365,
    },
    security: {
      csrfProtectionMode: 'disabled',
      enforceHttps: false,
      secureCookies: false,
      strictTransportSecurity: false,
    },
    system: { baseUrl: '', logLevel: 'info' },
    paths: {
      downloadMappings: [],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
      userMusicRoots: [],
    },
    slskd: {
      apiKey: '',
      baseUrl: 'http://slskd.internal:5030',
      clearApiKey: false,
      requestTimeoutMs: 15000,
    },
  });

  assert.deepEqual(payload.retention, {
    operationRunMaxAgeDays: 180,
    operationRunRetainCountPerType: 100,
    outcomeEventMaxAgeDays: 365,
  });
});

test('buildSettingsUpdatePayload includes retention defaults from createRetentionForm', () => {
  const payload = buildSettingsUpdatePayload({
    artwork: createArtworkForm(),
    library: createLibraryForm(),
    scoring: createScoringForm(),
    acquisition: createAcquisitionForm(),
    retention: createRetentionForm(),
    security: {
      csrfProtectionMode: 'disabled',
      enforceHttps: false,
      secureCookies: false,
      strictTransportSecurity: false,
    },
    system: { baseUrl: '', logLevel: 'info' },
    paths: {
      downloadMappings: [],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
      userMusicRoots: [],
    },
    slskd: {
      apiKey: '',
      baseUrl: 'http://slskd.internal:5030',
      clearApiKey: false,
      requestTimeoutMs: 15000,
    },
  });

  assert.deepEqual(payload.retention, {
    operationRunMaxAgeDays: 90,
    operationRunRetainCountPerType: 50,
    outcomeEventMaxAgeDays: 180,
  });
});

test('buildSettingsUpdatePayload includes fidelity fields', () => {
  const payload = buildSettingsUpdatePayload({
    artwork: createArtworkForm(),
    library: createLibraryForm(),
    scoring: createScoringForm(),
    acquisition: createAcquisitionForm(),
    retention: createRetentionForm(),
    fidelity: {
      spectralAuthenticMinCutoffHz: 22000,
      spectralSuspiciousMinCutoffHz: 20000,
      spectralTranscodeMidCutoffHz: 18000,
      spectralMinSampleRateHz: 96000,
      trustWatchFailureCount: 5,
      trustWatchMaxSuccessRate: 0.3,
      trustWatchEvidenceCount: 10,
      trustHealthyEvidenceCount: 20,
      trustHealthyMinSuccessRate: 0.9,
    },
    security: {
      csrfProtectionMode: 'disabled',
      enforceHttps: false,
      secureCookies: false,
      strictTransportSecurity: false,
    },
    system: { baseUrl: '', logLevel: 'info' },
    paths: {
      downloadMappings: [],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
      userMusicRoots: [],
    },
    slskd: {
      apiKey: '',
      baseUrl: 'http://slskd.internal:5030',
      clearApiKey: false,
      requestTimeoutMs: 15000,
    },
  });

  assert.deepEqual(payload.fidelity, {
    spectralAuthenticMinCutoffHz: 22000,
    spectralSuspiciousMinCutoffHz: 20000,
    spectralTranscodeMidCutoffHz: 18000,
    spectralMinSampleRateHz: 96000,
    trustWatchFailureCount: 5,
    trustWatchMaxSuccessRate: 0.3,
    trustWatchEvidenceCount: 10,
    trustHealthyEvidenceCount: 20,
    trustHealthyMinSuccessRate: 0.9,
  });
});

test('buildSettingsUpdatePayload includes fidelity defaults from createFidelityForm', () => {
  const payload = buildSettingsUpdatePayload({
    artwork: createArtworkForm(),
    library: createLibraryForm(),
    scoring: createScoringForm(),
    acquisition: createAcquisitionForm(),
    retention: createRetentionForm(),
    fidelity: createFidelityForm(),
    security: {
      csrfProtectionMode: 'disabled',
      enforceHttps: false,
      secureCookies: false,
      strictTransportSecurity: false,
    },
    system: { baseUrl: '', logLevel: 'info' },
    paths: {
      downloadMappings: [],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
      userMusicRoots: [],
    },
    slskd: {
      apiKey: '',
      baseUrl: 'http://slskd.internal:5030',
      clearApiKey: false,
      requestTimeoutMs: 15000,
    },
  });

  assert.deepEqual(payload.fidelity, {
    spectralAuthenticMinCutoffHz: 20000,
    spectralSuspiciousMinCutoffHz: 19000,
    spectralTranscodeMidCutoffHz: 16000,
    spectralMinSampleRateHz: 44100,
    trustWatchFailureCount: 3,
    trustWatchMaxSuccessRate: 0.5,
    trustWatchEvidenceCount: 3,
    trustHealthyEvidenceCount: 5,
    trustHealthyMinSuccessRate: 0.8,
  });
});

test('buildSettingsUpdatePayload includes naming template fields', () => {
  const payload = buildSettingsUpdatePayload({
    artwork: createArtworkForm(),
    library: createLibraryForm(),
    scoring: createScoringForm(),
    acquisition: createAcquisitionForm(),
    retention: createRetentionForm(),
    fidelity: createFidelityForm(),
    naming: {
      artistFolderFormat: '{ArtistName} ({ReleaseYear})',
      albumFolderFormat: '{AlbumTitle}',
      trackFilenameFormat: '{TrackNumber} - {SongTitle}',
      multiDiscTrackFilenameFormat: 'D{DiscNumber}T{TrackNumber} - {SongTitle}',
    },
    security: {
      csrfProtectionMode: 'disabled',
      enforceHttps: false,
      secureCookies: false,
      strictTransportSecurity: false,
    },
    system: { baseUrl: '', logLevel: 'info' },
    paths: {
      downloadMappings: [],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
      userMusicRoots: [],
    },
    slskd: {
      apiKey: '',
      baseUrl: 'http://slskd.internal:5030',
      clearApiKey: false,
      requestTimeoutMs: 15000,
    },
  });

  assert.deepEqual(payload.naming, {
    artistFolderFormat: '{ArtistName} ({ReleaseYear})',
    albumFolderFormat: '{AlbumTitle}',
    trackFilenameFormat: '{TrackNumber} - {SongTitle}',
    multiDiscTrackFilenameFormat: 'D{DiscNumber}T{TrackNumber} - {SongTitle}',
  });
});

test('buildSettingsUpdatePayload includes naming defaults from createNamingForm', () => {
  const payload = buildSettingsUpdatePayload({
    artwork: createArtworkForm(),
    library: createLibraryForm(),
    scoring: createScoringForm(),
    acquisition: createAcquisitionForm(),
    retention: createRetentionForm(),
    fidelity: createFidelityForm(),
    naming: createNamingForm(),
    security: {
      csrfProtectionMode: 'disabled',
      enforceHttps: false,
      secureCookies: false,
      strictTransportSecurity: false,
    },
    system: { baseUrl: '', logLevel: 'info' },
    paths: {
      downloadMappings: [],
      downloads: '/data/downloads',
      music: '/data/music',
      staging: '/data/staging',
      transcodeTemp: '/data/transcode-temp',
      userMusicRoots: [],
    },
    slskd: {
      apiKey: '',
      baseUrl: 'http://slskd.internal:5030',
      clearApiKey: false,
      requestTimeoutMs: 15000,
    },
  });

  assert.deepEqual(payload.naming, {
    artistFolderFormat: '{ArtistName}',
    albumFolderFormat: '{AlbumTitle} ({ReleaseYear})',
    trackFilenameFormat: '{TrackNumber} - {SongTitle}',
    multiDiscTrackFilenameFormat: '{DiscNumber}-{TrackNumber} - {SongTitle}',
  });
});
