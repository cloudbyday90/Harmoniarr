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

import { createProviderCredentialsService } from '../providers/provider-credentials-service.js';
import { loadSettings } from '../../settings.js';
import { getPool } from '../../database.js';
import { createApiError } from '../../auth.js';
import { normalizeDatabaseConnectionError } from '../../database-error-mapper.js';
import { buildAppleMusicSigningStatus } from './apple-music-signing-status-policy.js';

export function createAppleMusicStatusService({
  getPoolFn = getPool,
  loadSettingsFn = loadSettings,
  providerCredentialsService = createProviderCredentialsService(),
} = {}) {
  async function buildStatus(queryable = getPoolFn()) {
    let teamId, keyId, storefront, privateKey;
    try {
      const settings = await loadSettingsFn(queryable);
      ({ appleMusicTeamId: teamId, appleMusicKeyId: keyId, appleMusicStorefront: storefront } = settings.providers ?? {});
      privateKey = await providerCredentialsService.resolveAppleMusicPrivateKey(queryable);
    } catch (error) {
      const mapped = normalizeDatabaseConnectionError(error);
      if (mapped !== error) throw createApiError(mapped.status, mapped.code, mapped.message);
      throw createApiError(500, 'apple_music_status_unavailable', 'Apple Music signing status is unavailable');
    }
    const configured = Boolean(
      teamId
      && keyId
      && privateKey,
    );

    return {
      configured,
      provider: 'apple_music',
      storefront: storefront ?? 'us',
      teamIdConfigured: Boolean(teamId),
      keyIdConfigured: Boolean(keyId),
      privateKeyConfigured: Boolean(privateKey),
      localSigning: buildAppleMusicSigningStatus({ teamId, keyId, privateKey }),
    };
  }

  return { buildStatus };
}
