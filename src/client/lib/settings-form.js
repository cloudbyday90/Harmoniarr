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

export function createEmptyDownloadMapping() {
  return {
    harmoniarrPrefix: '',
    slskdPrefix: '',
  };
}

export function createEmptyUserMusicRoot() {
  return {
    relativeRoot: '',
    userId: '',
  };
}

function parseCommaSeparatedStrings(value, fieldName) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a comma-separated string`);
  }

  const normalized = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (normalized.length === 0) {
    throw new Error(`${fieldName} must contain at least one value`);
  }

  return normalized;
}

function parseCommaSeparatedIntegers(value, fieldName) {
  return parseCommaSeparatedStrings(value, fieldName).map((entry) => {
    const parsed = Number.parseInt(entry, 10);
    if (!Number.isInteger(parsed)) {
      throw new Error(`${fieldName} entries must be integers`);
    }

    return parsed;
  });
}

export function normalizeDownloadMappings(value) {
  return Array.isArray(value)
    ? value.map((entry) => ({
      harmoniarrPrefix: typeof entry?.harmoniarrPrefix === 'string' ? entry.harmoniarrPrefix : '',
      slskdPrefix: typeof entry?.slskdPrefix === 'string' ? entry.slskdPrefix : '',
    }))
    : [];
}

export function normalizeUserMusicRoots(value) {
  return Array.isArray(value)
    ? value.map((entry) => ({
      relativeRoot: typeof entry?.relativeRoot === 'string' ? entry.relativeRoot : '',
      userId: typeof entry?.userId === 'string' ? entry.userId : '',
    }))
    : [];
}

export function buildSettingsUpdatePayload(form) {
  const payload = {
    artwork: {
      captureEmbedded: form.artwork.captureEmbedded,
      captureFolderArtwork: form.artwork.captureFolderArtwork,
      dailyQuotaLimit: form.artwork.dailyQuotaLimit,
      derivativeCacheSizeMb: form.artwork.derivativeCacheSizeMb,
      derivativeFormat: form.artwork.derivativeFormat,
      derivativeRetentionDays: form.artwork.derivativeRetentionDays,
      derivativeSizes: parseCommaSeparatedIntegers(form.artwork.derivativeSizesText, 'Artwork derivative sizes'),
      fetchEnabled: form.artwork.fetchEnabled,
      maxOriginalDimensionPixels: form.artwork.maxOriginalDimensionPixels,
      maxOriginalFileSizeBytes: form.artwork.maxOriginalFileSizeBytes,
      providerOrder: parseCommaSeparatedStrings(form.artwork.providerOrderText, 'Artwork provider order'),
      refetchMissingAutomatically: form.artwork.refetchMissingAutomatically,
      refreshAfterImport: form.artwork.refreshAfterImport,
      refreshAfterLibraryScan: form.artwork.refreshAfterLibraryScan,
      refreshAfterMetadataRefresh: form.artwork.refreshAfterMetadataRefresh,
      unassignedRetentionDays: form.artwork.unassignedRetentionDays,
    },
    security: { ...form.security },
    system: { ...form.system },
    paths: {
      ...form.paths,
      downloadMappings: normalizeDownloadMappings(form.paths.downloadMappings),
      userMusicRoots: normalizeUserMusicRoots(form.paths.userMusicRoots),
    },
    library: { ...form.library },
    scoring: { ...form.scoring },
    acquisition: { ...form.acquisition },
    slskd: {
      baseUrl: form.slskd.baseUrl,
      requestTimeoutMs: form.slskd.requestTimeoutMs,
    },
  };

  if (form.providers) {
    payload.providers = {
      appleMusicEnabled: form.providers.appleMusicEnabled,
      appleMusicKeyId: form.providers.appleMusicKeyId,
      appleMusicStorefront: form.providers.appleMusicStorefront,
      appleMusicTeamId: form.providers.appleMusicTeamId,
      fanartTvEnabled: form.providers.fanartTvEnabled,
      playlistExpansionPolicy: form.providers.playlistExpansionPolicy,
      requestTimeoutMs: form.providers.requestTimeoutMs,
      spotifyClientId: form.providers.spotifyClientId,
      spotifyEnabled: form.providers.spotifyEnabled,
      youtubeClientId: form.providers.youtubeClientId,
      youtubeEnabled: form.providers.youtubeEnabled,
    };

    const spotifyClientSecret = typeof form.providers.spotifyClientSecret === 'string'
      ? form.providers.spotifyClientSecret.trim()
      : '';
    const youtubeApiKey = typeof form.providers.youtubeApiKey === 'string'
      ? form.providers.youtubeApiKey.trim()
      : '';
    const youtubeClientSecret = typeof form.providers.youtubeClientSecret === 'string'
      ? form.providers.youtubeClientSecret.trim()
      : '';
    const appleMusicPrivateKey = typeof form.providers.appleMusicPrivateKey === 'string'
      ? form.providers.appleMusicPrivateKey.trim()
      : '';

    if (form.providers.clearSpotifyClientSecret) {
      payload.providers.clearSpotifyClientSecret = true;
    } else if (spotifyClientSecret) {
      payload.providers.spotifyClientSecret = spotifyClientSecret;
    }

    if (form.providers.clearYoutubeApiKey) {
      payload.providers.clearYoutubeApiKey = true;
    } else if (youtubeApiKey) {
      payload.providers.youtubeApiKey = youtubeApiKey;
    }

    if (form.providers.clearYoutubeClientSecret) {
      payload.providers.clearYoutubeClientSecret = true;
    } else if (youtubeClientSecret) {
      payload.providers.youtubeClientSecret = youtubeClientSecret;
    }

    if (form.providers.clearAppleMusicPrivateKey) {
      payload.providers.clearAppleMusicPrivateKey = true;
    } else if (appleMusicPrivateKey) {
      payload.providers.appleMusicPrivateKey = appleMusicPrivateKey;
    }

    const fanartTvApiKey = typeof form.providers.fanartTvApiKey === 'string'
      ? form.providers.fanartTvApiKey.trim()
      : '';
    const fanartTvClientKey = typeof form.providers.fanartTvClientKey === 'string'
      ? form.providers.fanartTvClientKey.trim()
      : '';

    if (form.providers.clearFanartTvApiKey) {
      payload.providers.clearFanartTvApiKey = true;
    } else if (fanartTvApiKey) {
      payload.providers.fanartTvApiKey = fanartTvApiKey;
    }

    if (form.providers.clearFanartTvClientKey) {
      payload.providers.clearFanartTvClientKey = true;
    } else if (fanartTvClientKey) {
      payload.providers.fanartTvClientKey = fanartTvClientKey;
    }
  }

  const apiKey = typeof form.slskd.apiKey === 'string' ? form.slskd.apiKey.trim() : '';
  if (form.slskd.clearApiKey) {
    payload.slskd.clearApiKey = true;
  } else if (apiKey) {
    payload.slskd.apiKey = apiKey;
  }

  return payload;
}
