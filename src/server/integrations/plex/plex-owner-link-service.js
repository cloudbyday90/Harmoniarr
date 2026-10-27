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

import { randomUUID } from 'node:crypto';
import { createApiError } from '../../api-error.js';
import { createEncryptedSecretService } from '../../encrypted-secret-service.js';
import { startAuthLookup } from '../../auth-lookup-service.js';
import { loadSettings } from '../../settings.js';
import { createPlexHttpClient } from './plex-http-client.js';
import { createPlexOwnerLinkCommandService } from './plex-owner-link-command-service.js';
import { createPlexOwnerLinkStateService } from './plex-owner-link-state-service.js';
import { readPlexSecretRecord } from './plex-callback-state-store.js';
import { readOwnerLinkStatus } from './plex-owner-link-store.js';
import { ownerLinkTokenName, ownerLinkSessionAuthority, ownerLinkBindingHash, normalizeOwnerLinkProfile } from './plex-owner-link-policy.js';

export function createPlexOwnerLinkService({ encryptedSecretService = createEncryptedSecretService(), startReadFn = startAuthLookup,
  commandService = createPlexOwnerLinkCommandService({ encryptedSecretService }),
  stateService = createPlexOwnerLinkStateService({ encryptedSecretService, startReadFn }),
  loadSettingsFn = loadSettings, plexHttpClient = createPlexHttpClient() } = {}) {
  const buildStatus = queryable => queryable ? readOwnerLinkStatus(queryable) : startReadFn(readOwnerLinkStatus).result;
  return {
    buildStatus,
    async startLink({ session, browserBinding, requestMetadata = {} } = {}) {
      const authority = ownerLinkSessionAuthority(session); ownerLinkBindingHash(browserBinding);
      const settings = await loadSettingsFn(), base = settings.system?.baseUrl ?? requestMetadata.origin ?? '';
      if (typeof base !== 'string' || !base.trim()) throw createApiError(400, 'plex_link_base_url_required', 'Configure system.baseUrl before starting Plex account linking');
      const state = randomUUID(), forward = new URL('/api/v1/providers/plex/link/callback', base);
      forward.searchParams.set('state', state);
      const context = await commandService.prepare(authority);
      const pin = await plexHttpClient.createPin({ clientIdentifier: context.clientIdentifier });
      const pinId = pin?.id != null ? String(pin.id) : '', pinCode = typeof pin?.code === 'string' ? pin.code.trim() : '';
      if (!pinId || !pinCode || pinId.length > 256 || pinCode.length > 256) throw createApiError(502, 'plex_pin_create_failed', 'Plex PIN creation did not return a usable id and code');
      const { expiresAt } = await commandService.createPending({ authority, state, browserBinding, ...context, pinId, requestMetadata });
      const params = new URLSearchParams({ clientID: context.clientIdentifier, code: pinCode, forwardUrl: forward.href, 'context[device][product]': 'Harmoniarr' });
      return { authorizationUrl: 'https://app.plex.tv/auth#?' + params.toString(), expiresAt, provider: 'plex' };
    },
    async completeLink({ browserBinding, requestMetadata = {}, state } = {}) {
      const pending = await stateService.read({ state, browserBinding });
      const pin = await plexHttpClient.readPin({ clientIdentifier: pending.clientIdentifier, pinId: pending.pinId });
      const accessToken = typeof pin?.authToken === 'string' ? pin.authToken.trim() : '';
      if (!accessToken) throw createApiError(400, 'plex_link_not_claimed', 'Plex account link has not been claimed yet');
      if (accessToken.length > 4096) throw createApiError(502, 'plex_link_profile_invalid', 'Plex returned an unusable owner credential');
      const profile = normalizeOwnerLinkProfile(await plexHttpClient.fetchCurrentUser({ accessToken, clientIdentifier: pending.clientIdentifier }));
      return commandService.complete({ pending, accessToken, profile, requestMetadata });
    },
    clearLink: ({ session, requestMetadata = {} } = {}) => commandService.clear({ authority: ownerLinkSessionAuthority(session), requestMetadata }),
    async resolveLinkedAccessToken(queryable) {
      const row = queryable ? await readPlexSecretRecord(queryable, ownerLinkTokenName) : await startReadFn(client => readPlexSecretRecord(client, ownerLinkTokenName)).result;
      if (!row) return null;
      let payload;
      try { payload = JSON.parse(encryptedSecretService.decryptSecretRecord(row)); } catch { return null; }
      if (typeof payload?.accessToken !== 'string' || !payload.accessToken || payload.accessToken.length > 4096
        || typeof payload?.clientIdentifier !== 'string' || !payload.clientIdentifier || payload.clientIdentifier.length > 256) return null;
      return { accessToken: payload.accessToken, clientIdentifier: payload.clientIdentifier, linkedUser: payload.user ?? null };
    },
  };
}
