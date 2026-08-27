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

const AUTOMATIC_TRANSITION_MESSAGES = Object.freeze({
  adding_to_library: 'Harmoniarr will finish adding the files and update this release.',
  checking_matches: 'Harmoniarr will automatically queue the selected match for download when its checks finish.',
  downloading: 'Harmoniarr will automatically check the files, then add them to the library.',
  queued_for_search: 'Harmoniarr will automatically search for a matching release in the next pass.',
  ready_to_add: 'Harmoniarr will automatically add the verified files to the library.',
  retrying_search: 'Harmoniarr will automatically search again after the retry delay.',
  searching: 'Harmoniarr will automatically check the best results against the selected quality settings.',
  trying_next_match: 'Harmoniarr will automatically try the next eligible match.',
});

/**
 * Builds the one compact automatic handoff shown in a normal Missing Music row.
 * Unknown and attention states intentionally return null rather than claiming
 * a client-inferred next operation.
 *
 * @param {{ status?: { code?: unknown }, statusCode?: unknown }} release
 * @returns {{ label: string, message: string } | null}
 */
export function buildMissingMusicReleaseTransitionPresentation(release = {}) {
  const statusCode = typeof release?.statusCode === 'string'
    ? release.statusCode
    : release?.status?.code;
  const message = AUTOMATIC_TRANSITION_MESSAGES[statusCode];

  return message ? { label: 'Up next', message } : null;
}
