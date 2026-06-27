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

export const DISCOVER_RECOMMENDATION_FOCUS_QUERY_KEY = 'focusArtist';

function toArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
}

function normalizeId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeRecommendationFocusIds(value, availableArtists = null) {
  const allowedIds = Array.isArray(availableArtists)
    ? new Set(availableArtists.map((artist) => normalizeId(artist?.id)).filter(Boolean))
    : null;
  const ids = [];
  const seen = new Set();

  for (const rawValue of toArray(value)) {
    const id = normalizeId(rawValue);
    if (!id || seen.has(id) || (allowedIds && !allowedIds.has(id))) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }

  return ids;
}

export function filterRecommendationInputsByFocus(recommendationInputs, focusIds) {
  const inputs = Array.isArray(recommendationInputs) ? recommendationInputs : [];
  const normalizedFocusIds = normalizeRecommendationFocusIds(focusIds, inputs);
  if (!normalizedFocusIds.length) {
    return inputs;
  }

  const focusedIdSet = new Set(normalizedFocusIds);
  return inputs.filter((input) => focusedIdSet.has(input.id));
}

export function filterInputResultsByFocus(inputResults, focusIds, recommendationInputs) {
  const results = inputResults instanceof Map ? inputResults : new Map();
  const inputs = Array.isArray(recommendationInputs) ? recommendationInputs : [];
  const filteredInputs = filterRecommendationInputsByFocus(recommendationInputs, focusIds);
  if (filteredInputs.length === inputs.length) {
    return results;
  }

  const focusedIdSet = new Set(filteredInputs.map((input) => input.id));
  return new Map(
    [...results.entries()].filter(([artistId]) => focusedIdSet.has(artistId)),
  );
}

export function isRecommendationFocusActive(focusIds, recommendationInputs) {
  return normalizeRecommendationFocusIds(focusIds, recommendationInputs).length > 0;
}

export function buildDiscoverRecommendationFocusQuery(routeQuery, focusIds) {
  const normalizedFocusIds = normalizeRecommendationFocusIds(focusIds);
  const nextQuery = { ...(routeQuery ?? {}) };
  delete nextQuery[DISCOVER_RECOMMENDATION_FOCUS_QUERY_KEY];

  if (normalizedFocusIds.length === 1) {
    nextQuery[DISCOVER_RECOMMENDATION_FOCUS_QUERY_KEY] = normalizedFocusIds[0];
  } else if (normalizedFocusIds.length > 1) {
    nextQuery[DISCOVER_RECOMMENDATION_FOCUS_QUERY_KEY] = normalizedFocusIds;
  }

  return nextQuery;
}
