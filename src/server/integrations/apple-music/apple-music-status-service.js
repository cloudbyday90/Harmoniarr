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

export function createAppleMusicStatusService({
  getPoolFn = getPool,
  loadSettingsFn = loadSettings,
  providerCredentialsService = createProviderCredentialsService(),
} = {}) {
  async function buildStatus(queryable = getPoolFn()) {
    const settings = await loadSettingsFn();
    const providerSettings = settings.providers ?? {};
    const privateKey = await providerCredentialsService.resolveAppleMusicPrivateKey(queryable);
    const configured = Boolean(
      providerSettings.appleMusicTeamId
      && providerSettings.appleMusicKeyId
      && privateKey,
    );

    return {
      configured,
      provider: 'apple_music',
      storefront: providerSettings.appleMusicStorefront ?? 'us',
      teamIdConfigured: Boolean(providerSettings.appleMusicTeamId),
      keyIdConfigured: Boolean(providerSettings.appleMusicKeyId),
      privateKeyConfigured: Boolean(privateKey),
    };
  }

  return { buildStatus };
}
