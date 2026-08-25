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

const selectionOrigins = new Set(['manual_edition', 'manual_inclusion']);
const selectionSources = new Set(['manual', 'policy']);
const selectionStates = new Set(['unselected', 'selected', 'partial']);

function normalizeKnownToken(value, allowedValues) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return allowedValues.has(normalized) ? normalized : null;
}

/**
 * Narrows persisted wanted-release evidence to the selection facts that the
 * operator-facing Music Queue may safely present. The database is authoritative
 * for newly saved values; this second allowlist keeps malformed legacy JSON
 * from becoming a user-facing claim.
 *
 * @param {{ evidence?: object } | null | undefined} release
 * @returns {{ selectionOrigin: string | null, selectionSource: string | null, selectionState: string | null }}
 */
export function buildMusicQueueOperatorSelectionEvidence(release = {}) {
  const evidence = release?.evidence && typeof release.evidence === 'object'
    ? release.evidence
    : {};
  const selectionSource = normalizeKnownToken(evidence.selectionSource, selectionSources);

  return {
    selectionOrigin: selectionSource === 'manual'
      ? normalizeKnownToken(evidence.selectionOrigin, selectionOrigins)
      : null,
    selectionSource,
    selectionState: normalizeKnownToken(evidence.selectionState, selectionStates),
  };
}
