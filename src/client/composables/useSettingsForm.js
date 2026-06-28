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

import { reactive, ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import { fetchSettings as defaultFetchSettings, updateSettings as defaultUpdateSettings } from '../lib/settings-api.js';
import { buildSettingsUpdatePayload, normalizeDownloadMappings, normalizeUserMusicRoots } from '../lib/settings-form.js';
import { formatCommaSeparatedList } from '../lib/settings-media-storage-presentation.js';

export function useSettingsForm({
  fetchSettingsFn = defaultFetchSettings,
  updateSettingsFn = defaultUpdateSettings,
  extraApply,
  onSaveSuccess,
} = {}) {
  const isLoading = ref(true);
  const isSaving = ref(false);
  const errorMessage = ref('');
  const successMessage = ref('');

  const form = reactive({
    artwork: {
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
    },
    security: {
      csrfProtectionMode: 'disabled',
      enforceHttps: false,
      secureCookies: false,
      strictTransportSecurity: false,
    },
    system: {
      baseUrl: '',
      logLevel: 'info',
    },
    library: {
      autoStartDownloadsAfterSelection: true,
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
    paths: {
      downloadMappings: [],
      downloads: '',
      music: '',
      staging: '',
      transcodeTemp: '',
      userMusicRoots: [],
    },
    slskd: {
      apiKey: '',
      baseUrl: 'http://slskd:5030',
      clearApiKey: false,
      requestTimeoutMs: 10000,
    },
    providers: {
      appleMusicEnabled: false,
      appleMusicKeyId: '',
      appleMusicPrivateKey: '',
      appleMusicStorefront: 'us',
      appleMusicTeamId: '',
      clearAppleMusicPrivateKey: false,
      clearFanartTvApiKey: false,
      clearFanartTvClientKey: false,
      clearSpotifyClientSecret: false,
      clearYoutubeApiKey: false,
      clearYoutubeClientSecret: false,
      fanartTvApiKey: '',
      fanartTvClientKey: '',
      fanartTvEnabled: false,
      playlistExpansionPolicy: 'bounded',
      requestTimeoutMs: 15000,
      spotifyClientId: '',
      spotifyClientSecret: '',
      spotifyEnabled: false,
      youtubeApiKey: '',
      youtubeClientId: '',
      youtubeClientSecret: '',
      youtubeEnabled: false,
    },
  });

  function applySettings(payload) {
    Object.assign(form.artwork, {
      ...payload.settings.artwork,
      derivativeSizesText: formatCommaSeparatedList(payload.settings.artwork?.derivativeSizes),
      providerOrderText: formatCommaSeparatedList(payload.settings.artwork?.providerOrder),
    });
    Object.assign(form.security, payload.settings.security);
    Object.assign(form.system, payload.settings.system);
    Object.assign(form.library, payload.settings.library);
    Object.assign(form.scoring, payload.settings.scoring);
    Object.assign(form.acquisition, payload.settings.acquisition);
    Object.assign(form.retention, payload.settings.retention);
    Object.assign(form.fidelity, payload.settings.fidelity);
    Object.assign(form.naming, payload.settings.naming);
    Object.assign(form.paths, {
      ...payload.settings.paths,
      downloadMappings: form.paths.downloadMappings,
      userMusicRoots: form.paths.userMusicRoots,
    });
    Object.assign(form.slskd, {
      ...form.slskd,
      ...payload.settings.slskd,
      apiKey: '',
      clearApiKey: false,
    });
    Object.assign(form.providers, {
      ...form.providers,
      ...payload.settings.providers,
      appleMusicPrivateKey: '',
      clearAppleMusicPrivateKey: false,
      clearFanartTvApiKey: false,
      clearFanartTvClientKey: false,
      clearSpotifyClientSecret: false,
      clearYoutubeApiKey: false,
      clearYoutubeClientSecret: false,
      fanartTvApiKey: '',
      fanartTvClientKey: '',
      spotifyClientSecret: '',
      youtubeApiKey: '',
      youtubeClientSecret: '',
    });
    form.paths.downloadMappings.splice(
      0,
      form.paths.downloadMappings.length,
      ...normalizeDownloadMappings(payload.settings.paths?.downloadMappings),
    );
    form.paths.userMusicRoots.splice(
      0,
      form.paths.userMusicRoots.length,
      ...normalizeUserMusicRoots(payload.settings.paths?.userMusicRoots),
    );
    if (extraApply) extraApply(payload);
  }

  async function loadSettings() {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      applySettings(await fetchSettingsFn());
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Settings load failed');
    } finally {
      isLoading.value = false;
    }
  }

  async function saveSettings() {
    isSaving.value = true;
    errorMessage.value = '';
    successMessage.value = '';
    try {
      const payload = await updateSettingsFn(buildSettingsUpdatePayload(form));
      applySettings(payload);
      successMessage.value = 'Settings saved.';
      if (onSaveSuccess) onSaveSuccess(payload);
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Settings save failed');
    } finally {
      isSaving.value = false;
    }
  }

  return {
    applySettings,
    errorMessage,
    form,
    isLoading,
    isSaving,
    loadSettings,
    saveSettings,
    successMessage,
  };
}
