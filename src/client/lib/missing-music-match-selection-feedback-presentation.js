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

import { buildMusicQueueReleaseTransitionPresentation } from './music-queue-release-transition-presentation.js';

const FALLBACK_SUCCESS_MESSAGE = 'Match selected. Harmoniarr will update this release as it prepares the next step.';

/**
 * Builds a bounded, state-derived confirmation after a manual Missing Music
 * match selection. The response release is authoritative; the client does not
 * infer that a provider transfer has been accepted.
 *
 * @param {{ release?: { status?: { code?: unknown }, statusCode?: unknown } } | null | undefined} result
 * @returns {string}
 */
export function buildMissingMusicMatchSelectionSuccessMessage(result) {
  const transition = buildMusicQueueReleaseTransitionPresentation(result?.release);
  return transition
    ? `Match selected. ${transition.message}`
    : FALLBACK_SUCCESS_MESSAGE;
}
