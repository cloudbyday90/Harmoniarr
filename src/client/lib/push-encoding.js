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

/**
 * Decodes a base64url-encoded string into a `Uint8Array`.
 *
 * Used to convert a VAPID public key (received from the server as a
 * base64url string) into the `applicationServerKey` buffer expected by
 * `PushManager.subscribe()`.
 *
 * Handles both padded and unpadded base64url input by stripping existing
 * padding before recomputing the correct padding length. URL-safe characters
 * (`-` and `_`) are converted to standard base64 characters (`+` and `/`)
 * before decoding with `atob`.
 *
 * @param {string} base64String - A base64url-encoded string (padded or unpadded).
 * @returns {Uint8Array}
 */
export function urlBase64ToUint8Array(base64String) {
  // Strip any existing padding before computing the correct padding length.
  const stripped = base64String.replace(/=/g, '');
  const padding = '='.repeat((4 - (stripped.length % 4)) % 4);
  const base64 = (stripped + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
