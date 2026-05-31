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

/**
 * Artist detail route helpers.
 *
 * Pure utilities for building router locations to the artist detail view and
 * for normalizing MusicBrainz release-group browse results into the shape
 * expected by ReleaseCard.
 */

/**
 * Canonical primary-type ordering for discography sections.
 * Types not in this list are grouped under the last section.
 */
export const RELEASE_GROUP_TYPE_ORDER = ['Album', 'EP', 'Single', 'Broadcast', 'Other'];

/**
 * Returns a Vue Router location object for the artist detail page.
 *
 * An optional `nameHint` is forwarded as a query parameter so the view can
 * display the artist name during the initial load without waiting for the API.
 *
 * @param {string} mbid - MusicBrainz artist MBID.
 * @param {string} [nameHint] - Optional artist name for display while loading.
 * @returns {{ name: string, params: { mbid: string }, query?: { name: string } }}
 */
export function buildArtistDetailLocation(mbid, nameHint) {
  if (nameHint) {
    return { name: 'artist-detail', params: { mbid }, query: { name: nameHint } };
  }
  return { name: 'artist-detail', params: { mbid } };
}

/**
 * Normalizes a MusicBrainz browse release-group result to a shape compatible
 * with ReleaseCard.
 *
 * ReleaseCard resolves artwork and text through the following fields:
 *   - `release.id ?? release.musicbrainzReleaseId` → release MBID (for ArtworkImage)
 *   - `release.releaseGroup?.id ?? release.releaseGroupId` → release-group MBID
 *   - `release.date ?? release.releaseDate` → year (getReleaseYear)
 *   - `release.releaseGroup?.primaryType` → type shown in meta line
 *   - `release.artistCredit` → artist name
 *   - `release.title ?? release.releaseTitle` → title
 *
 * Browse results have `primaryType` at the top level and use `firstReleaseDate`
 * rather than `date`. This function maps those fields so ReleaseCard renders
 * release-group artwork (not release artwork) and shows the correct year.
 *
 * @param {object} releaseGroup - Entry from `browseMusicBrainzArtistReleaseGroups` results.
 * @returns {object} ReleaseCard-compatible object.
 */
export function normalizeReleaseGroupForCard(releaseGroup) {
  const musicbrainzReleaseGroupId = releaseGroup.musicbrainzReleaseGroupId ?? releaseGroup.id;

  return {
    // Clear release MBID so ArtworkImage falls through to release-group artwork.
    id: null,
    musicbrainzReleaseId: null,
    // Release-group MBID for ArtworkImage (mbidType='release-group').
    releaseGroupId: musicbrainzReleaseGroupId,
    // Local metadata release-group UUID, when available from operator projection.
    metadataReleaseGroupId: releaseGroup.id,
    // Nested releaseGroup: ReleaseCard reads primaryType from here for the meta line.
    releaseGroup: {
      id: musicbrainzReleaseGroupId,
      primaryType: releaseGroup.primaryType ?? null,
    },
    // Map firstReleaseDate → date so getReleaseYear picks it up.
    date: releaseGroup.firstReleaseDate ?? null,
    // Pass-through fields.
    title: releaseGroup.title ?? null,
    artistCredit: releaseGroup.artistCredit ?? null,
    disambiguation: releaseGroup.disambiguation ?? null,
    secondaryTypes: releaseGroup.secondaryTypes ?? [],
    sourceProvider: releaseGroup.sourceProvider ?? 'musicbrainz',
    operatorState: releaseGroup.operatorState ?? null,
    musicbrainzReleaseGroupId,
  };
}

/**
 * Groups raw browse release-group results by primary type in canonical section
 * order (Album → EP → Single → Broadcast → Other, then any unknown types).
 *
 * Within each section, entries are sorted newest first by `firstReleaseDate`,
 * with title as a stable tiebreaker.
 *
 * @param {object[]} releaseGroups - Raw results from `browseMusicBrainzArtistReleaseGroups`.
 * @returns {{ type: string, items: object[] }[]} Ordered sections.
 */
export function groupReleaseGroupsByType(releaseGroups) {
  if (!Array.isArray(releaseGroups) || releaseGroups.length === 0) return [];

  const buckets = new Map();

  for (const rg of releaseGroups) {
    const type = rg.primaryType ?? 'Other';
    if (!buckets.has(type)) buckets.set(type, []);
    buckets.get(type).push(rg);
  }

  // Sort each bucket newest first; title is a stable tiebreaker.
  for (const items of buckets.values()) {
    items.sort((a, b) => {
      const da = a.firstReleaseDate ?? '';
      const db = b.firstReleaseDate ?? '';
      const dateCmp = db.localeCompare(da);
      if (dateCmp !== 0) return dateCmp;
      return (a.title ?? '').localeCompare(b.title ?? '');
    });
  }

  const sections = [];

  // Emit sections in canonical type order.
  for (const type of RELEASE_GROUP_TYPE_ORDER) {
    if (buckets.has(type)) {
      sections.push({ type, items: buckets.get(type) });
      buckets.delete(type);
    }
  }

  // Append any unexpected primary types after the canonical ones.
  for (const [type, items] of buckets) {
    sections.push({ type, items });
  }

  return sections;
}
