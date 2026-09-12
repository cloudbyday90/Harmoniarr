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

import { getReleaseRequestKey } from './release-normalization.js';

/** Client duplicate suppression only; the server authorizes every recipient. */
export function getReleaseRequestIdentity(releaseOrKey, {
  requestedForUserId = null, currentUserId = null,
} = {}) {
  const releaseKey = typeof releaseOrKey === 'string' ? releaseOrKey : getReleaseRequestKey(releaseOrKey);
  if (!releaseKey || (requestedForUserId !== null
    && (typeof requestedForUserId !== 'string' || !requestedForUserId.trim()))) return null;
  const actorUserId = currentUserId ?? null;
  const recipientUserId = requestedForUserId === null ? actorUserId : requestedForUserId.trim();
  return { key: JSON.stringify([actorUserId, recipientUserId, releaseKey]),
    releaseKey, actorUserId, recipientUserId };
}

export function getSelfRequestedReleaseKeys(entries, currentUserId) {
  return new Set([...entries.values()]
    .filter((entry) => entry.actorUserId === (currentUserId ?? null)
      && entry.recipientUserId === (currentUserId ?? null))
    .map((entry) => entry.releaseKey));
}
