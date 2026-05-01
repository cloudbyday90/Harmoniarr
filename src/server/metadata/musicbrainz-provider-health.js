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

const provider = 'musicbrainz';

function isMusicBrainzError(error) {
  return typeof error?.code === 'string' && error.code.startsWith('musicbrainz_');
}

export async function observeMusicBrainzProviderCall(providerHealthRecorder, operation) {
  try {
    const result = await operation();
    providerHealthRecorder?.recordSuccess?.(provider);
    return result;
  } catch (error) {
    if (isMusicBrainzError(error)) {
      providerHealthRecorder?.recordError?.(provider, error);
    }

    throw error;
  }
}
