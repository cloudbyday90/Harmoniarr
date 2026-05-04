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

export function buildMediaRequestTargetEligibility(user) {
  if (!user || typeof user !== 'object') {
    return {
      eligible: false,
      needsOperatorReview: true,
      reasonCode: 'media_request_target_unknown',
    };
  }

  if (user.isDisabled) {
    return {
      eligible: false,
      needsOperatorReview: false,
      reasonCode: 'media_request_target_disabled',
    };
  }

  const plexAccessPolicy = user.plexProfile?.accessPolicy ?? null;
  if (!plexAccessPolicy) {
    return {
      eligible: true,
      needsOperatorReview: false,
      reasonCode: 'media_request_target_local_user',
    };
  }

  if (plexAccessPolicy.requestTargetingEligible) {
    return {
      eligible: true,
      needsOperatorReview: false,
      reasonCode: plexAccessPolicy.reasonCode ?? 'media_request_target_plex_eligible',
    };
  }

  return {
    eligible: false,
    needsOperatorReview: plexAccessPolicy.needsOperatorReview !== false,
    reasonCode: plexAccessPolicy.reasonCode ?? 'media_request_target_plex_ineligible',
  };
}