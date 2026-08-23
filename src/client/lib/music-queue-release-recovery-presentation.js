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

export const MUSIC_QUEUE_RELEASE_RECOVERY_KIND = Object.freeze({
  NOT_FOUND: 'not-found',
  RETRY: 'retry',
});

/**
 * Maps release-detail read failures to calm, user-safe recovery content. Raw
 * service errors remain internal so a failed direct URL cannot disclose
 * transport, provider, authorization, or implementation details.
 */
export function buildMusicQueueReleaseRecoveryPresentation({
  errorMessage = '',
  isNotFound = false,
} = {}) {
  if (isNotFound) {
    return {
      announcement: 'Release not available.',
      canRetry: false,
      heading: 'Release not available',
      kind: MUSIC_QUEUE_RELEASE_RECOVERY_KIND.NOT_FOUND,
      message: 'This Music Queue link is unavailable. Return to the queue to continue.',
      role: 'status',
      tone: 'warning',
    };
  }

  if (typeof errorMessage !== 'string' || errorMessage.trim().length === 0) {
    return null;
  }

  return {
    announcement: 'Release details could not be loaded.',
    canRetry: true,
    heading: 'Release details unavailable',
    kind: MUSIC_QUEUE_RELEASE_RECOVERY_KIND.RETRY,
    message: 'Harmoniarr could not load these release details. Try again or return to the queue.',
    role: 'alert',
    tone: 'danger',
  };
}
