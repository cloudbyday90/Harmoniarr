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

import { createApiError } from '../auth.js';
import { createEncryptedSecretService } from '../encrypted-secret-service.js';
import {
  buildSlskdRuntimeConfig,
  resolveSlskdEnvironmentApiKey,
} from '../integrations/slskd/slskd-config.js';
import { resolveSlskdProviderMode } from '../integrations/slskd/slskd-provider-mode.js';
import { loadSettings } from '../settings.js';

const slskdApiKeySecretType = 'integration_credential';
const slskdApiKeySecretName = 'slskd.apiKey';

function createNoopSecretMutation(patch) {
  return {
    apply: async () => {},
    assertAllowed: () => {},
    sanitizedPatch: patch,
    updatedKeys: [],
  };
}

export function createSlskdConfigService({
  env = process.env,
  encryptedSecretService = createEncryptedSecretService({ env }),
  loadSettingsFn = loadSettings,
} = {}) {
  async function buildSecretStatus(queryable) {
    const settings = await loadSettingsFn(queryable);
    const providerMode = resolveSlskdProviderMode({
      env,
      providerMode: settings?.slskd?.providerMode,
    });
    const storedSecret = await encryptedSecretService.getSecretMetadata({
      name: slskdApiKeySecretName,
      queryable,
      secretType: slskdApiKeySecretType,
    });
    let environmentSecret = null;
    try {
      environmentSecret = resolveSlskdEnvironmentApiKey(env);
    } catch {
      // Connection health exposes the malformed deployment setting safely.
    }

    return {
      apiKeyConfigured: storedSecret.configured || environmentSecret !== null,
      apiKeySource: environmentSecret?.source === 'managed_file'
        ? 'managed_file'
        : storedSecret.configured
          ? 'stored'
          : environmentSecret?.source ?? 'unset',
      apiKeyUpdatedAt: storedSecret.updatedAt ?? null,
      managedDeploymentDetected: providerMode.managedDeploymentDetected,
      providerMode: providerMode.mode,
      providerModeLocked: providerMode.modeLocked,
      providerModeState: providerMode.state,
    };
  }

  function buildSecretMutation(patch, { currentSettings = null } = {}) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
      return createNoopSecretMutation(patch);
    }

    const slskdPatch = patch.slskd;
    if (!slskdPatch || typeof slskdPatch !== 'object' || Array.isArray(slskdPatch)) {
      return createNoopSecretMutation(patch);
    }

    const sanitizedPatch = structuredClone(patch);
    const sanitizedSlskdPatch = sanitizedPatch.slskd ?? {};
    let nextApiKey = null;
    let clearApiKey = false;

    if ('apiKey' in slskdPatch) {
      if (typeof slskdPatch.apiKey !== 'string') {
        throw createApiError(400, 'validation_error', 'slskd.apiKey must be a string');
      }

      const trimmedApiKey = slskdPatch.apiKey.trim();
      if (trimmedApiKey.length > 0) {
        nextApiKey = trimmedApiKey;
      }
    }

    if ('clearApiKey' in slskdPatch) {
      if (typeof slskdPatch.clearApiKey !== 'boolean') {
        throw createApiError(400, 'validation_error', 'slskd.clearApiKey must be a boolean');
      }

      clearApiKey = slskdPatch.clearApiKey;
    }

    if (nextApiKey && clearApiKey) {
      throw createApiError(400, 'validation_error', 'slskd.apiKey cannot be set and cleared in the same request');
    }

    function assertAllowed(settings = currentSettings) {
      if (!nextApiKey && !clearApiKey) return;

      const providerMode = resolveSlskdProviderMode({
        env,
        providerMode: slskdPatch.providerMode ?? settings?.slskd?.providerMode,
      });
      if (providerMode.mode !== 'external') {
        throw createApiError(
          400,
          'validation_error',
          'slskd.apiKey can only be changed while the External provider mode is selected',
        );
      }
    }

    delete sanitizedSlskdPatch.apiKey;
    delete sanitizedSlskdPatch.clearApiKey;

    if (Object.keys(sanitizedSlskdPatch).length === 0) {
      delete sanitizedPatch.slskd;
    }

    return {
      assertAllowed,
      sanitizedPatch,
      updatedKeys: clearApiKey || nextApiKey ? ['slskd.apiKey'] : [],
      apply: async (queryable) => {
        if (clearApiKey) {
          await encryptedSecretService.clearSecretValue({
            name: slskdApiKeySecretName,
            queryable,
            secretType: slskdApiKeySecretType,
          });
          return;
        }

        if (nextApiKey) {
          await encryptedSecretService.setSecretValue({
            metadata: { consumer: 'slskd', field: 'apiKey' },
            name: slskdApiKeySecretName,
            plaintextValue: nextApiKey,
            queryable,
            secretType: slskdApiKeySecretType,
          });
        }
      },
    };
  }

  async function buildRuntimeConfig(queryable) {
    const settings = await loadSettingsFn(queryable);
    const providerMode = resolveSlskdProviderMode({
      env,
      providerMode: settings?.slskd?.providerMode,
    });

    if (providerMode.state !== 'ready') {
      return buildSlskdRuntimeConfig({ env, settings });
    }

    const storedApiKey = await encryptedSecretService.getSecretValue({
      name: slskdApiKeySecretName,
      queryable,
      secretType: slskdApiKeySecretType,
    });

    const environmentApiKey = resolveSlskdEnvironmentApiKey(env);

    return buildSlskdRuntimeConfig({
      apiKey: environmentApiKey?.source === 'managed_file'
        ? environmentApiKey.value
        : storedApiKey,
      env,
      settings,
    });
  }

  return {
    buildRuntimeConfig,
    buildSecretMutation,
    buildSecretStatus,
  };
}
