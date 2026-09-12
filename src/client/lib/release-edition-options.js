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

function nonempty(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function getReleaseEditionTarget(edition) {
  const localId = nonempty(edition?.id);
  if (localId) return { key: `local:${localId}`, preferReleaseId: localId };
  const mbid = nonempty(edition?.musicbrainzReleaseId);
  return mbid ? { key: `musicbrainz:${mbid}`, preferReleaseMbid: mbid } : null;
}

export function buildReleaseEditionOptions(editions = []) {
  return editions.map((edition, index) => {
    const target = getReleaseEditionTarget(edition);
    const facts = [
      `Edition ${index + 1}`,
      nonempty(edition?.country) ?? 'Country not specified',
      nonempty(edition?.releaseDate) ?? 'Date not specified',
    ];
    if (Number.isInteger(edition?.trackCount) && edition.trackCount > 0) facts.push(`${edition.trackCount} tracks`);
    if (nonempty(edition?.disambiguation)) facts.push(edition.disambiguation.trim());
    if (!target) facts.push('Preview unavailable');
    return { key: nonempty(edition?.musicbrainzReleaseId) ? `musicbrainz:${edition.musicbrainzReleaseId.trim()}` : target?.key ?? `unavailable:${index}`, label: facts.join(' · '), target };
  });
}

export function getAvailableReleaseEditionKey(options, edition) {
  const mbid = nonempty(edition?.musicbrainzReleaseId);
  const key = mbid ? `musicbrainz:${mbid}` : getReleaseEditionTarget(edition)?.key;
  return options.some((option) => option.key === key) ? key : '';
}
