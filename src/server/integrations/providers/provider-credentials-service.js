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

import { createApiError } from '../../auth.js';
import { createEncryptedSecretService } from '../../encrypted-secret-service.js';

const secretType = 'integration_credential';

const spotifyClientSecretName = 'providers.spotify.clientSecret';
const youtubeApiKeySecretName = 'providers.youtube.apiKey';
const youtubeClientSecretName = 'providers.youtube.clientSecret';
const appleMusicPrivateKeySecretName = 'providers.appleMusic.privateKey';

function createNoopSecretMutation(patch) {
  return {
    apply: async () => {},
    sanitizedPatch: patch,
    updatedKeys: [],
  };
}

function buildSingleSecretMutation({ encryptedSecretService, envFallback, fieldPath, patchNamespace, patchKey, clearPatchKey, secretName }) {
  return function extractMutation(patch) {
    const namespacePatch = patch?.[patchNamespace];
    if (!namespacePatch || typeof namespacePatch !== 'object' || Array.isArray(namespacePatch)) {
      return { nextValue: null, clearValue: false, updatedKeys: [] };
    }

    let nextValue = null;
    let clearValue = false;

    if (patchKey in namespacePatch) {
      if (typeof namespacePatch[patchKey] !== 'string') {
        throw createApiError(400, 'validation_error', `${fieldPath} must be a string`);
      }

      const trimmed = namespacePatch[patchKey].trim();
      if (trimmed.length > 0) {
        nextValue = trimmed;
      }
    }

    if (clearPatchKey in namespacePatch) {
      if (typeof namespacePatch[clearPatchKey] !== 'boolean') {
        throw createApiError(400, 'validation_error', `${clearPatchKey} must be a boolean`);
      }

      clearValue = namespacePatch[clearPatchKey];
    }

    if (nextValue && clearValue) {
      throw createApiError(400, 'validation_error', `${fieldPath} cannot be set and cleared in the same request`);
    }

    return {
      clearValue,
      nextValue,
      updatedKeys: clearValue || nextValue ? [fieldPath] : [],
      apply: async (queryable) => {
        if (clearValue) {
          await encryptedSecretService.clearSecretValue({ name: secretName, queryable, secretType });
          return;
        }

        if (nextValue) {
          await encryptedSecretService.setSecretValue({
            metadata: { consumer: patchNamespace, field: patchKey },
            name: secretName,
            plaintextValue: nextValue,
            queryable,
            secretType,
          });
        }
      },
    };
  };
}

export function createProviderCredentialsService({
  env = process.env,
  encryptedSecretService = createEncryptedSecretService({ env }),
} = {}) {
  async function buildSecretStatus(queryable) {
    const [spotifyMeta, youtubeMeta, youtubeClientSecretMeta, appleMusicMeta] = await Promise.all([
      encryptedSecretService.getSecretMetadata({ name: spotifyClientSecretName, queryable, secretType }),
      encryptedSecretService.getSecretMetadata({ name: youtubeApiKeySecretName, queryable, secretType }),
      encryptedSecretService.getSecretMetadata({ name: youtubeClientSecretName, queryable, secretType }),
      encryptedSecretService.getSecretMetadata({ name: appleMusicPrivateKeySecretName, queryable, secretType }),
    ]);

    const hasSpotifyEnvSecret = Boolean(env.SPOTIFY_CLIENT_SECRET?.trim());
    const hasYoutubeEnvSecret = Boolean(env.YOUTUBE_API_KEY?.trim());
    const hasYoutubeClientSecretEnvSecret = Boolean(env.YOUTUBE_CLIENT_SECRET?.trim());
    const hasAppleMusicEnvSecret = Boolean(env.APPLE_MUSIC_PRIVATE_KEY?.trim());

    return {
      spotify: {
        clientSecretConfigured: spotifyMeta.configured || hasSpotifyEnvSecret,
        clientSecretSource: spotifyMeta.configured ? 'stored' : hasSpotifyEnvSecret ? 'environment' : 'unset',
        clientSecretUpdatedAt: spotifyMeta.updatedAt ?? null,
      },
      youtube: {
        apiKeyConfigured: youtubeMeta.configured || hasYoutubeEnvSecret,
        apiKeySource: youtubeMeta.configured ? 'stored' : hasYoutubeEnvSecret ? 'environment' : 'unset',
        apiKeyUpdatedAt: youtubeMeta.updatedAt ?? null,
        clientSecretConfigured: youtubeClientSecretMeta.configured || hasYoutubeClientSecretEnvSecret,
        clientSecretSource: youtubeClientSecretMeta.configured ? 'stored' : hasYoutubeClientSecretEnvSecret ? 'environment' : 'unset',
        clientSecretUpdatedAt: youtubeClientSecretMeta.updatedAt ?? null,
      },
      appleMusic: {
        privateKeyConfigured: appleMusicMeta.configured || hasAppleMusicEnvSecret,
        privateKeySource: appleMusicMeta.configured ? 'stored' : hasAppleMusicEnvSecret ? 'environment' : 'unset',
        privateKeyUpdatedAt: appleMusicMeta.updatedAt ?? null,
      },
    };
  }

  function buildSecretMutation(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return createNoopSecretMutation(patch);
    }

    const sanitizedPatch = structuredClone(patch);
    const allUpdatedKeys = [];
    const applyFunctions = [];

    // Spotify client secret
    if (sanitizedPatch.providers && typeof sanitizedPatch.providers === 'object') {
      const spotifyExtract = buildSingleSecretMutation({
        clearPatchKey: 'clearSpotifyClientSecret',
        encryptedSecretService,
        envFallback: env.SPOTIFY_CLIENT_SECRET,
        fieldPath: 'providers.spotifyClientSecret',
        patchKey: 'spotifyClientSecret',
        patchNamespace: 'providers',
        secretName: spotifyClientSecretName,
      })(patch);

      if (spotifyExtract.updatedKeys?.length > 0) {
        allUpdatedKeys.push(...spotifyExtract.updatedKeys);
        applyFunctions.push(spotifyExtract.apply);
      }

      delete sanitizedPatch.providers.spotifyClientSecret;
      delete sanitizedPatch.providers.clearSpotifyClientSecret;

      // YouTube API key
      const youtubeExtract = buildSingleSecretMutation({
        clearPatchKey: 'clearYoutubeApiKey',
        encryptedSecretService,
        envFallback: env.YOUTUBE_API_KEY,
        fieldPath: 'providers.youtubeApiKey',
        patchKey: 'youtubeApiKey',
        patchNamespace: 'providers',
        secretName: youtubeApiKeySecretName,
      })(patch);

      if (youtubeExtract.updatedKeys?.length > 0) {
        allUpdatedKeys.push(...youtubeExtract.updatedKeys);
        applyFunctions.push(youtubeExtract.apply);
      }

      delete sanitizedPatch.providers.youtubeApiKey;
      delete sanitizedPatch.providers.clearYoutubeApiKey;

      // YouTube OAuth client secret
      const youtubeClientSecretExtract = buildSingleSecretMutation({
        clearPatchKey: 'clearYoutubeClientSecret',
        encryptedSecretService,
        envFallback: env.YOUTUBE_CLIENT_SECRET,
        fieldPath: 'providers.youtubeClientSecret',
        patchKey: 'youtubeClientSecret',
        patchNamespace: 'providers',
        secretName: youtubeClientSecretName,
      })(patch);

      if (youtubeClientSecretExtract.updatedKeys?.length > 0) {
        allUpdatedKeys.push(...youtubeClientSecretExtract.updatedKeys);
        applyFunctions.push(youtubeClientSecretExtract.apply);
      }

      delete sanitizedPatch.providers.youtubeClientSecret;
      delete sanitizedPatch.providers.clearYoutubeClientSecret;

      // Apple Music private key
      const appleMusicExtract = buildSingleSecretMutation({
        clearPatchKey: 'clearAppleMusicPrivateKey',
        encryptedSecretService,
        envFallback: env.APPLE_MUSIC_PRIVATE_KEY,
        fieldPath: 'providers.appleMusicPrivateKey',
        patchKey: 'appleMusicPrivateKey',
        patchNamespace: 'providers',
        secretName: appleMusicPrivateKeySecretName,
      })(patch);

      if (appleMusicExtract.updatedKeys?.length > 0) {
        allUpdatedKeys.push(...appleMusicExtract.updatedKeys);
        applyFunctions.push(appleMusicExtract.apply);
      }

      delete sanitizedPatch.providers.appleMusicPrivateKey;
      delete sanitizedPatch.providers.clearAppleMusicPrivateKey;

      if (Object.keys(sanitizedPatch.providers).length === 0) {
        delete sanitizedPatch.providers;
      }
    }

    return {
      sanitizedPatch,
      updatedKeys: allUpdatedKeys,
      apply: async (queryable) => {
        for (const applyFn of applyFunctions) {
          await applyFn(queryable);
        }
      },
    };
  }

  async function resolveSpotifyClientSecret(queryable) {
    const stored = await encryptedSecretService.getSecretValue({ name: spotifyClientSecretName, queryable, secretType });
    return stored ?? env.SPOTIFY_CLIENT_SECRET?.trim() ?? null;
  }

  async function resolveYoutubeApiKey(queryable) {
    const stored = await encryptedSecretService.getSecretValue({ name: youtubeApiKeySecretName, queryable, secretType });
    return stored ?? env.YOUTUBE_API_KEY?.trim() ?? null;
  }

  async function resolveYoutubeClientSecret(queryable) {
    const stored = await encryptedSecretService.getSecretValue({ name: youtubeClientSecretName, queryable, secretType });
    return stored ?? env.YOUTUBE_CLIENT_SECRET?.trim() ?? null;
  }

  async function resolveAppleMusicPrivateKey(queryable) {
    const stored = await encryptedSecretService.getSecretValue({ name: appleMusicPrivateKeySecretName, queryable, secretType });
    return stored ?? env.APPLE_MUSIC_PRIVATE_KEY?.trim() ?? null;
  }

  return {
    buildSecretMutation,
    buildSecretStatus,
    resolveAppleMusicPrivateKey,
    resolveSpotifyClientSecret,
    resolveYoutubeApiKey,
    resolveYoutubeClientSecret,
  };
}
