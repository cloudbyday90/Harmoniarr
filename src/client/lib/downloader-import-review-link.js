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

import { buildImportReviewRouteQuery } from './import-review-route-state.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildDownloaderImportCandidateLocation(transfer) {
  const candidateId = normalizeString(transfer?.diagnostics?.importLinkage?.candidateId);

  if (!candidateId) {
    return null;
  }

  return {
    name: 'activity-candidates',
    query: buildImportReviewRouteQuery({
      candidateId,
      status: '',
    }),
  };
}
