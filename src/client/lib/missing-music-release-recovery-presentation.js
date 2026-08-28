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

const AUTOMATIC_RECOVERY = Object.freeze({
  kind: 'automatic',
  nextStep: 'No action is needed. Harmoniarr will continue this release automatically.',
});

export function buildMissingMusicReleaseRecoveryPresentation(status = {}) {
  switch (status.code) {
    case 'trying_next_match':
      return {
        ...AUTOMATIC_RECOVERY,
        detail: 'A previous match did not work. Harmoniarr is moving to the next eligible match automatically.',
      };
    case 'retrying_search':
      return {
        ...AUTOMATIC_RECOVERY,
        detail: 'No acceptable match was found in the last search. Harmoniarr will try again automatically.',
      };
    case 'no_matches_left':
      return {
        canSearchAgain: true,
        detail: 'No acceptable matches remain for this release. Harmoniarr has stopped automatic recovery.',
        kind: 'action_required',
        nextStep: 'Review the result, then choose Search again to begin a new search.',
        retryLabel: 'Search again',
      };
    case 'failed':
      return {
        canSearchAgain: true,
        detail: 'The last search did not finish. Harmoniarr needs a new search before it can continue.',
        kind: 'action_required',
        nextStep: 'Review the result, then choose Try again to begin a new search.',
        retryLabel: 'Try again',
      };
    default:
      return null;
  }
}
