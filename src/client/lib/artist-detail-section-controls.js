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

export const ARTIST_DETAIL_SECTION_SELECTION_FILTERS = Object.freeze([
  { label: 'All selections', value: 'all' },
  { label: 'Selected', value: 'selected' },
  { label: 'Partial', value: 'partial' },
  { label: 'Unselected', value: 'unselected' },
  { label: 'Manual overrides', value: 'manual_overrides' },
]);

export const ARTIST_DETAIL_SECTION_SORT_OPTIONS = Object.freeze([
  { label: 'Newest first', value: 'newest' },
  { label: 'Oldest first', value: 'oldest' },
  { label: 'Title A-Z', value: 'title_asc' },
  { label: 'Title Z-A', value: 'title_desc' },
  { label: 'Selection state', value: 'selection_state' },
]);

export const defaultArtistDetailSectionControls = Object.freeze({
  query: '',
  selectionFilter: 'all',
  sortMode: 'newest',
});

const validSelectionFilters = new Set(ARTIST_DETAIL_SECTION_SELECTION_FILTERS.map((option) => option.value));
const validSortModes = new Set(ARTIST_DETAIL_SECTION_SORT_OPTIONS.map((option) => option.value));
const selectionStateRank = Object.freeze({
  selected: 0,
  partial: 1,
  unselected: 2,
});

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeSearchText(value) {
  return normalizeString(value).toLocaleLowerCase();
}

function normalizeControls(controls = {}) {
  return {
    query: normalizeString(controls.query),
    selectionFilter: validSelectionFilters.has(controls.selectionFilter)
      ? controls.selectionFilter
      : defaultArtistDetailSectionControls.selectionFilter,
    sortMode: validSortModes.has(controls.sortMode)
      ? controls.sortMode
      : defaultArtistDetailSectionControls.sortMode,
  };
}

function getReleaseDate(release) {
  return normalizeString(release?.date ?? release?.firstReleaseDate);
}

function getReleaseTitle(release) {
  return normalizeString(release?.title ?? release?.releaseTitle);
}

function getReleaseSearchHaystack(release) {
  const parts = [
    release?.title,
    release?.releaseTitle,
    release?.artistCredit,
    release?.date,
    release?.firstReleaseDate,
    release?.disambiguation,
    release?.releaseGroup?.primaryType,
    ...(Array.isArray(release?.secondaryTypes) ? release.secondaryTypes : []),
  ];

  return normalizeSearchText(parts.filter(Boolean).join(' '));
}

function compareDateDescThenTitleAsc(a, b) {
  const dateCompare = getReleaseDate(b).localeCompare(getReleaseDate(a));
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return getReleaseTitle(a).localeCompare(getReleaseTitle(b));
}

function compareDateAscThenTitleAsc(a, b) {
  const dateCompare = getReleaseDate(a).localeCompare(getReleaseDate(b));
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return getReleaseTitle(a).localeCompare(getReleaseTitle(b));
}

function compareTitleAscThenDateDesc(a, b) {
  const titleCompare = getReleaseTitle(a).localeCompare(getReleaseTitle(b));
  if (titleCompare !== 0) {
    return titleCompare;
  }

  return compareDateDescThenTitleAsc(a, b);
}

function compareTitleDescThenDateDesc(a, b) {
  const titleCompare = getReleaseTitle(b).localeCompare(getReleaseTitle(a));
  if (titleCompare !== 0) {
    return titleCompare;
  }

  return compareDateDescThenTitleAsc(a, b);
}

function compareSelectionThenDateDesc(a, b, getSelectionState) {
  const aRank = selectionStateRank[getSelectionState(a)] ?? 99;
  const bRank = selectionStateRank[getSelectionState(b)] ?? 99;
  if (aRank !== bRank) {
    return aRank - bRank;
  }

  return compareDateDescThenTitleAsc(a, b);
}

export function isArtistDetailSectionControlsActive(controls = {}) {
  const normalized = normalizeControls(controls);
  return normalized.query.length > 0
    || normalized.selectionFilter !== defaultArtistDetailSectionControls.selectionFilter
    || normalized.sortMode !== defaultArtistDetailSectionControls.sortMode;
}

export function applyArtistDetailSectionControls({
  controls = {},
  getSelectionState = () => 'selected',
  hasManualOverride = () => false,
  releases = [],
} = {}) {
  const normalizedControls = normalizeControls(controls);
  const query = normalizeSearchText(normalizedControls.query);
  const sourceReleases = Array.isArray(releases) ? releases : [];
  const filteredReleases = sourceReleases.filter((release) => {
    if (query && !getReleaseSearchHaystack(release).includes(query)) {
      return false;
    }

    if (normalizedControls.selectionFilter === 'manual_overrides') {
      return hasManualOverride(release);
    }

    if (normalizedControls.selectionFilter !== 'all') {
      return getSelectionState(release) === normalizedControls.selectionFilter;
    }

    return true;
  });
  const sortedReleases = [...filteredReleases];

  if (normalizedControls.sortMode === 'oldest') {
    sortedReleases.sort(compareDateAscThenTitleAsc);
  } else if (normalizedControls.sortMode === 'title_asc') {
    sortedReleases.sort(compareTitleAscThenDateDesc);
  } else if (normalizedControls.sortMode === 'title_desc') {
    sortedReleases.sort(compareTitleDescThenDateDesc);
  } else if (normalizedControls.sortMode === 'selection_state') {
    sortedReleases.sort((a, b) => compareSelectionThenDateDesc(a, b, getSelectionState));
  } else {
    sortedReleases.sort(compareDateDescThenTitleAsc);
  }

  return {
    controls: normalizedControls,
    isFiltered: query.length > 0 || normalizedControls.selectionFilter !== 'all',
    isSorted: normalizedControls.sortMode !== defaultArtistDetailSectionControls.sortMode,
    isActive: isArtistDetailSectionControlsActive(normalizedControls),
    releases: sortedReleases,
    totalCount: sourceReleases.length,
    visibleCount: sortedReleases.length,
  };
}
