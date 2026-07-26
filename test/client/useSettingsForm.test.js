import assert from 'node:assert/strict';
import test from 'node:test';
import { useSettingsForm } from '../../src/client/composables/useSettingsForm.js';

function createSettingsPayload(overrides = {}) {
  return {
    settings: {
      artwork: {
        captureEmbedded: true,
        captureFolderArtwork: true,
        dailyQuotaLimit: 500,
        derivativeCacheSizeMb: 512,
        derivativeFormat: 'jpeg',
        derivativeRetentionDays: 14,
        derivativeSizes: [128, 256],
        fetchEnabled: false,
        maxOriginalDimensionPixels: 2000,
        maxOriginalFileSizeBytes: 10485760,
        providerOrder: ['coverArtArchive', 'fanartTv'],
        refetchMissingAutomatically: true,
        refreshAfterImport: false,
        refreshAfterLibraryScan: true,
        refreshAfterMetadataRefresh: false,
        unassignedRetentionDays: 30,
      },
      security: {
        csrfProtectionMode: 'required',
        enforceHttps: true,
        secureCookies: true,
        strictTransportSecurity: true,
      },
      system: {
        baseUrl: 'https://example.com',
        logLevel: 'debug',
      },
      library: {
        autoStartDownloadsAfterSelection: false,
        discoveryBatchSize: 10,
        discoveryCooldownHours: 12,
        discoveryFallbackCooldownHours: 4,
        maxSearchAttempts: 5,
      },
      paths: {
        downloadMappings: [],
        downloads: '/downloads',
        music: '/music',
        staging: '/staging',
        transcodeTemp: '/tmp',
        userMusicRoots: [],
      },
      slskd: {
        baseUrl: 'http://slskd:5030',
        requestTimeoutMs: 5000,
      },
      providers: {
        appleMusicEnabled: true,
        appleMusicKeyId: 'key-1',
        appleMusicStorefront: 'gb',
        appleMusicTeamId: 'team-1',
        fanartTvEnabled: true,
        playlistExpansionPolicy: 'artist_discovery',
        requestTimeoutMs: 20000,
        spotifyClientId: 'spotify-id',
        spotifyEnabled: true,
        youtubeClientId: 'yt-id',
        youtubeEnabled: true,
      },
    },
    ...overrides,
  };
}

test('useSettingsForm loadSettings fetches and applies settings', async () => {
  const payload = createSettingsPayload();
  const { form, isLoading, loadSettings } = useSettingsForm({
    fetchSettingsFn: async () => payload,
  });

  assert.equal(isLoading.value, true);

  await loadSettings();

  assert.equal(isLoading.value, false);
  assert.equal(form.system.baseUrl, 'https://example.com');
  assert.equal(form.system.logLevel, 'debug');
  assert.equal(form.security.csrfProtectionMode, 'required');
  assert.equal(form.security.enforceHttps, true);
  assert.equal(form.artwork.fetchEnabled, false);
  assert.equal(form.artwork.derivativeSizesText, '128, 256');
  assert.equal(form.artwork.providerOrderText, 'coverArtArchive, fanartTv');
  assert.equal(form.library.autoStartDownloadsAfterSelection, false);
  assert.equal(form.library.discoveryBatchSize, 10);
  assert.equal(form.slskd.baseUrl, 'http://slskd:5030');
  assert.equal(form.slskd.apiKey, '');
  assert.equal(form.providers.spotifyEnabled, true);
});

test('useSettingsForm loadSettings sets error on failure', async () => {
  const { errorMessage, isLoading, loadSettings } = useSettingsForm({
    fetchSettingsFn: async () => { throw new Error('Network error'); },
  });

  await loadSettings();

  assert.equal(errorMessage.value, 'Network error');
  assert.equal(isLoading.value, false);
});

test('useSettingsForm loadSettings uses fallback error message for non-Error', async () => {
  const { errorMessage, loadSettings } = useSettingsForm({
    fetchSettingsFn: async () => { throw 'string error'; },
  });

  await loadSettings();

  assert.equal(errorMessage.value, 'Settings load failed');
});

test('useSettingsForm saveSettings updates and applies response', async () => {
  const updatedPayload = createSettingsPayload();
  updatedPayload.settings.system.baseUrl = 'https://updated.com';
  let savedPayload = null;

  const { form, successMessage, isSaving, loadSettings, saveSettings } = useSettingsForm({
    fetchSettingsFn: async () => createSettingsPayload(),
    updateSettingsFn: async (payload) => {
      savedPayload = payload;
      return updatedPayload;
    },
  });

  await loadSettings();
  assert.equal(form.system.baseUrl, 'https://example.com');

  form.system.baseUrl = 'https://modified.com';
  await saveSettings();

  assert.equal(isSaving.value, false);
  assert.equal(successMessage.value, 'Settings saved.');
  assert.equal(form.system.baseUrl, 'https://updated.com');
  assert.ok(savedPayload);
});

test('useSettingsForm saveSettings surfaces bounded Music Queue folder recovery', async () => {
  const updatedPayload = createSettingsPayload({
    musicQueueRecovery: {
      dispatchAlreadyActive: false,
      dispatchDeferred: false,
      releasedCount: 2,
      runStarted: true,
    },
  });

  const { loadSettings, saveSettings, successMessage } = useSettingsForm({
    fetchSettingsFn: async () => createSettingsPayload(),
    updateSettingsFn: async () => updatedPayload,
  });

  await loadSettings();
  await saveSettings();

  assert.equal(
    successMessage.value,
    'Settings saved. Music Queue is searching for 2 releases automatically.',
  );
});

test('useSettingsForm saveSettings sets error on failure', async () => {
  const { errorMessage, loadSettings, saveSettings } = useSettingsForm({
    fetchSettingsFn: async () => createSettingsPayload(),
    updateSettingsFn: async () => { throw new Error('Save failed'); },
  });

  await loadSettings();
  await saveSettings();

  assert.equal(errorMessage.value, 'Save failed');
});

test('useSettingsForm applySettings clears sensitive fields', async () => {
  const payload = createSettingsPayload();
  const { form, loadSettings } = useSettingsForm({
    fetchSettingsFn: async () => payload,
  });

  form.slskd.apiKey = 'old-key';
  form.providers.spotifyClientSecret = 'old-secret';

  await loadSettings();

  assert.equal(form.slskd.apiKey, '');
  assert.equal(form.slskd.clearApiKey, false);
  assert.equal(form.providers.spotifyClientSecret, '');
  assert.equal(form.providers.clearSpotifyClientSecret, false);
});

test('useSettingsForm applySettings normalizes download mappings', async () => {
  const payload = createSettingsPayload();
  payload.settings.paths.downloadMappings = [
    { slskdPrefix: '/a', harmoniarrPrefix: '/b' },
  ];
  payload.settings.paths.userMusicRoots = [
    { userId: 'alice', relativeRoot: 'family/alice' },
  ];

  const { form, loadSettings } = useSettingsForm({
    fetchSettingsFn: async () => payload,
  });

  await loadSettings();

  assert.equal(form.paths.downloadMappings.length, 1);
  assert.equal(form.paths.downloadMappings[0].slskdPrefix, '/a');
  assert.equal(form.paths.userMusicRoots.length, 1);
  assert.equal(form.paths.userMusicRoots[0].userId, 'alice');
});

test('useSettingsForm extraApply callback is called', async () => {
  let capturedPayload = null;
  const payload = createSettingsPayload({ extraField: 'test-value' });

  const { loadSettings } = useSettingsForm({
    fetchSettingsFn: async () => payload,
    extraApply: (p) => { capturedPayload = p; },
  });

  await loadSettings();

  assert.ok(capturedPayload);
  assert.equal(capturedPayload.extraField, 'test-value');
});

test('useSettingsForm initial state has correct defaults', () => {
  const { form, isLoading, isSaving, errorMessage, successMessage } = useSettingsForm();

  assert.equal(isLoading.value, true);
  assert.equal(isSaving.value, false);
  assert.equal(errorMessage.value, '');
  assert.equal(successMessage.value, '');
  assert.equal(form.security.csrfProtectionMode, 'disabled');
  assert.equal(form.system.logLevel, 'info');
  assert.equal(form.library.autoStartDownloadsAfterSelection, true);
  assert.equal(form.slskd.baseUrl, 'http://slskd:5030');
  assert.equal(form.slskd.providerMode, 'external');
  assert.equal(form.artwork.derivativeFormat, 'webp');
  assert.equal(form.providers.playlistExpansionPolicy, 'bounded');
});

test('useSettingsForm onSaveSuccess is called after successful save', async () => {
  const payload = createSettingsPayload();
  let savedPayload = null;
  let callCount = 0;

  const { loadSettings, saveSettings } = useSettingsForm({
    fetchSettingsFn: async () => createSettingsPayload(),
    updateSettingsFn: async () => payload,
    onSaveSuccess: (p) => {
      callCount += 1;
      savedPayload = p;
    },
  });

  await loadSettings();
  await saveSettings();

  assert.equal(callCount, 1);
  assert.equal(savedPayload, payload);
});

test('useSettingsForm onSaveSuccess is not called on save failure', async () => {
  let callCount = 0;

  const { loadSettings, saveSettings } = useSettingsForm({
    fetchSettingsFn: async () => createSettingsPayload(),
    updateSettingsFn: async () => { throw new Error('fail'); },
    onSaveSuccess: () => { callCount += 1; },
  });

  await loadSettings();
  await saveSettings();

  assert.equal(callCount, 0);
});
