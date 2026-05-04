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

function normalizeAccessDetails(details) {
  if (!details || typeof details !== 'object') {
    return {};
  }

  return details;
}

function countServerIds(details) {
  if (!Array.isArray(details.serverIds)) {
    return 0;
  }

  return details.serverIds.filter((value) => String(value ?? '').trim().length > 0).length;
}

function hasRestrictionSignals(details) {
  return ['allowChannels', 'allowSubtitleAdmin', 'allowSync', 'allowTuners']
    .some((key) => details[key] !== undefined && details[key] !== null);
}

export function buildPlexLibraryAccessPolicy({
  homeRole = null,
  libraryAccessDetails = {},
  libraryAccessState = 'unknown',
} = {}) {
  const normalizedDetails = normalizeAccessDetails(libraryAccessDetails);
  const serverCount = countServerIds(normalizedDetails);
  const restrictionSignals = hasRestrictionSignals(normalizedDetails);

  if (homeRole === 'home_admin' || libraryAccessState === 'owner') {
    return {
      classification: 'eligible',
      fulfillmentVisibilityEligible: true,
      libraryAccessConfirmed: true,
      needsOperatorReview: false,
      reasonCode: 'plex_owner_access',
      requestTargetingEligible: true,
      restrictionSignals,
      serverCount,
    };
  }

  if (libraryAccessState === 'shared') {
    return {
      classification: 'eligible',
      fulfillmentVisibilityEligible: true,
      libraryAccessConfirmed: true,
      needsOperatorReview: false,
      reasonCode: 'plex_shared_library_access',
      requestTargetingEligible: true,
      restrictionSignals,
      serverCount,
    };
  }

  if (homeRole === 'home_managed') {
    return {
      classification: 'review_required',
      fulfillmentVisibilityEligible: false,
      libraryAccessConfirmed: false,
      needsOperatorReview: true,
      reasonCode: 'plex_managed_access_unconfirmed',
      requestTargetingEligible: false,
      restrictionSignals,
      serverCount,
    };
  }

  if (homeRole === 'home_member') {
    return {
      classification: 'review_required',
      fulfillmentVisibilityEligible: false,
      libraryAccessConfirmed: false,
      needsOperatorReview: true,
      reasonCode: 'plex_member_access_unconfirmed',
      requestTargetingEligible: false,
      restrictionSignals,
      serverCount,
    };
  }

  return {
    classification: 'unknown',
    fulfillmentVisibilityEligible: false,
    libraryAccessConfirmed: false,
    needsOperatorReview: true,
    reasonCode: 'plex_access_unknown',
    requestTargetingEligible: false,
    restrictionSignals,
    serverCount,
  };
}