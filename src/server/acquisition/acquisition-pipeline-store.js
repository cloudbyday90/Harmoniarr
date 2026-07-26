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

function normalizeRequiredFunction(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`createAcquisitionPipelineStore requires ${name}`);
  }

  return value;
}

function normalizeWantedReleaseId(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizePagination({ limit = 100, offset = 0 } = {}) {
  return {
    limit: Math.max(1, Math.min(Number(limit) || 100, 500)),
    offset: Math.max(0, Number(offset) || 0),
  };
}

export function createAcquisitionPipelineStore({
  buildLibraryWantedReleases,
} = {}) {
  const listWantedReleases = normalizeRequiredFunction(buildLibraryWantedReleases, 'buildLibraryWantedReleases');

  async function listWantedReleaseEvidence({ appUserId, limit, metadataArtistId = null, offset } = {}) {
    const pagination = normalizePagination({ limit, offset });
    const payload = await listWantedReleases({
      appUserId,
      includeDiscoveryRequestDetails: true,
      limit: pagination.limit + pagination.offset,
      metadataArtistId,
    });
    const releases = Array.isArray(payload?.wantedReleases) ? payload.wantedReleases : [];
    const page = releases.slice(pagination.offset, pagination.offset + pagination.limit);

    return {
      checkedAt: payload?.checkedAt ?? new Date().toISOString(),
      pagination: {
        ...pagination,
        total: Number(payload?.total ?? releases.length) || releases.length,
      },
      releases: page,
    };
  }

  async function getWantedReleaseEvidence({ appUserId, wantedReleaseId } = {}) {
    const normalizedWantedReleaseId = normalizeWantedReleaseId(wantedReleaseId);
    if (!normalizedWantedReleaseId) return null;
    const payload = await listWantedReleaseEvidence({ appUserId, limit: 500, offset: 0 });
    return payload.releases.find((release) => release.id === normalizedWantedReleaseId) ?? null;
  }

  return {
    getWantedReleaseEvidence,
    listWantedReleaseEvidence,
  };
}
