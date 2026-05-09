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

const candidateStatusPriority = new Map([
  ['applied', 700],
  ['import_pending', 600],
  ['downloading', 500],
  ['selected', 400],
  ['pending', 300],
  ['held', 290],
  ['rejected', 200],
  ['failed', 190],
]);

function normalizeMediaRequestId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function candidateTimestampValue(candidate) {
  const parsed = Date.parse(candidate?.updatedAt ?? candidate?.discoveredAt ?? candidate?.createdAt ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function getCandidatePriority(candidate) {
  return candidateStatusPriority.get(candidate?.status) ?? 0;
}

function resolveCandidateSourceMediaRequestId(candidate) {
  return normalizeMediaRequestId(candidate?.normalizedPayload?.requestOwnership?.sourceMediaRequestId);
}

function mapCandidateFulfillmentStatus(candidate) {
  switch (candidate?.status) {
    case 'applied':
      return {
        code: 'fulfilled',
        detail: 'Imported media has been applied to the library.',
        label: 'Fulfilled',
        occurredAt: candidate?.updatedAt ?? candidate?.discoveredAt ?? candidate?.createdAt ?? null,
        tone: 'selected',
      };
    case 'import_pending':
      return {
        code: 'import_pending',
        detail: 'Download completed and is waiting for import apply.',
        label: 'Import pending',
        occurredAt: candidate?.updatedAt ?? candidate?.discoveredAt ?? candidate?.createdAt ?? null,
        tone: 'held',
      };
    case 'downloading':
      return {
        code: 'downloading',
        detail: 'Files are currently downloading.',
        label: 'Downloading',
        occurredAt: candidate?.updatedAt ?? candidate?.discoveredAt ?? candidate?.createdAt ?? null,
        tone: 'held',
      };
    case 'selected':
      return {
        code: 'queued',
        detail: 'Reviewed and queued for import execution.',
        label: 'Queued',
        occurredAt: candidate?.updatedAt ?? candidate?.discoveredAt ?? candidate?.createdAt ?? null,
        tone: 'held',
      };
    case 'held':
      return {
        code: 'under_review',
        detail: 'Held for additional review before execution.',
        label: 'Under review',
        occurredAt: candidate?.updatedAt ?? candidate?.discoveredAt ?? candidate?.createdAt ?? null,
        tone: 'held',
      };
    case 'rejected':
      return {
        code: 'failed',
        detail: 'Review rejected this request.',
        label: 'Not proceeding',
        occurredAt: candidate?.updatedAt ?? candidate?.discoveredAt ?? candidate?.createdAt ?? null,
        tone: 'failed',
      };
    case 'failed':
      return {
        code: 'failed',
        detail: 'Import execution failed and needs operator attention.',
        label: 'Failed',
        occurredAt: candidate?.updatedAt ?? candidate?.discoveredAt ?? candidate?.createdAt ?? null,
        tone: 'failed',
      };
    default:
      return {
        code: 'under_review',
        detail: 'Waiting for import review.',
        label: 'Under review',
        occurredAt: candidate?.updatedAt ?? candidate?.discoveredAt ?? candidate?.createdAt ?? null,
        tone: 'held',
      };
  }
}

export function buildFallbackMediaRequestFulfillmentStatus(request) {
  switch (request?.requestState) {
    case 'already_exists':
      return {
        code: 'already_available',
        detail: 'This request already matched imported media.',
        label: 'Already available',
        occurredAt: request?.updatedAt ?? request?.createdAt ?? null,
        tone: 'selected',
      };
    case 'needs_review':
      return {
        code: 'under_review',
        detail: 'Needs operator review before fetch can continue.',
        label: 'Needs review',
        occurredAt: request?.updatedAt ?? request?.createdAt ?? null,
        tone: 'held',
      };
    default:
      return {
        code: 'queued',
        detail: 'Waiting for fetch and discovery follow-up.',
        label: 'Queued',
        occurredAt: request?.updatedAt ?? request?.createdAt ?? null,
        tone: 'held',
      };
  }
}

export function buildMediaRequestFulfillmentStatus({ importCandidates = [], request } = {}) {
  if (!Array.isArray(importCandidates) || importCandidates.length === 0) {
    return buildFallbackMediaRequestFulfillmentStatus(request);
  }

  const selectedCandidate = [...importCandidates].sort((left, right) => {
    const priorityDifference = getCandidatePriority(right) - getCandidatePriority(left);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return candidateTimestampValue(right) - candidateTimestampValue(left);
  })[0];

  return {
    ...mapCandidateFulfillmentStatus(selectedCandidate),
    importCandidateId: selectedCandidate.id,
    importCandidateStatus: selectedCandidate.status,
  };
}

export function createEmptyMediaRequestFulfillmentCounts() {
  return {
    active: 0,
    alreadyAvailable: 0,
    downloading: 0,
    failed: 0,
    fulfilled: 0,
    importPending: 0,
    queued: 0,
    satisfied: 0,
    totalRequests: 0,
    underReview: 0,
  };
}

export function buildMediaRequestFulfillmentCounts(mediaRequests) {
  const counts = createEmptyMediaRequestFulfillmentCounts();

  for (const request of Array.isArray(mediaRequests) ? mediaRequests : []) {
    counts.totalRequests += 1;

    switch (request?.fulfillmentStatus?.code) {
      case 'already_available':
        counts.alreadyAvailable += 1;
        counts.satisfied += 1;
        break;
      case 'fulfilled':
        counts.fulfilled += 1;
        counts.satisfied += 1;
        break;
      case 'import_pending':
        counts.importPending += 1;
        counts.active += 1;
        break;
      case 'downloading':
        counts.downloading += 1;
        counts.active += 1;
        break;
      case 'queued':
        counts.queued += 1;
        counts.active += 1;
        break;
      case 'failed':
        counts.failed += 1;
        break;
      default:
        counts.underReview += 1;
        break;
    }
  }

  return counts;
}

export function createLibraryMediaRequestFulfillmentService({
  listImportCandidatesBySourceMediaRequestIds = async () => [],
  getMediaRequestById = async () => null,
} = {}) {
  async function enrichMediaRequests(mediaRequests) {
    const requests = Array.isArray(mediaRequests) ? mediaRequests : [];
    const sourceMediaRequestIds = requests
      .map((request) => normalizeMediaRequestId(request?.id))
      .filter(Boolean);

    const linkedRequestIds = requests
      .filter((request) => request?.linkedRequestId)
      .map((request) => normalizeMediaRequestId(request.linkedRequestId))
      .filter((id) => !sourceMediaRequestIds.includes(id));

    const allRequestIds = [...new Set([...sourceMediaRequestIds, ...linkedRequestIds])];

    const importCandidates = allRequestIds.length > 0
      ? await listImportCandidatesBySourceMediaRequestIds({ sourceMediaRequestIds: allRequestIds })
      : [];
    const candidatesByRequestId = new Map();

    for (const candidate of importCandidates) {
      const mediaRequestId = resolveCandidateSourceMediaRequestId(candidate);
      if (!mediaRequestId) {
        continue;
      }

      const existing = candidatesByRequestId.get(mediaRequestId) ?? [];
      existing.push(candidate);
      candidatesByRequestId.set(mediaRequestId, existing);
    }

    const linkedRequestMap = new Map();
    for (const linkedId of linkedRequestIds) {
      if (!candidatesByRequestId.has(linkedId)) {
        const primaryRequest = await getMediaRequestById({ mediaRequestId: linkedId });
        if (primaryRequest) {
          linkedRequestMap.set(linkedId, primaryRequest);
        }
      }
    }

    return requests.map((request) => {
      const directCandidates = candidatesByRequestId.get(normalizeMediaRequestId(request?.id)) ?? [];

      let linked = false;
      let linkedToUsername = null;
      let candidates = directCandidates;

      if (request?.linkedRequestId && directCandidates.length === 0) {
        const primaryCandidates = candidatesByRequestId.get(normalizeMediaRequestId(request.linkedRequestId)) ?? [];
        if (primaryCandidates.length > 0) {
          candidates = primaryCandidates;
        }
        linked = true;
        const primary = linkedRequestMap.get(request.linkedRequestId);
        if (primary?.requestedByUser?.username) {
          linkedToUsername = primary.requestedByUser.username;
        } else {
          const linkedRequest = requests.find((r) => r?.id === request.linkedRequestId);
          linkedToUsername = linkedRequest?.requestedByUser?.username ?? null;
        }
      }

      const fulfillmentStatus = {
        ...buildMediaRequestFulfillmentStatus({ importCandidates: candidates, request }),
      };

      if (linked) {
        fulfillmentStatus.linked = true;
        fulfillmentStatus.linkedToUsername = linkedToUsername;
      }

      return {
        ...request,
        fulfillmentStatus,
      };
    });
  }

  return {
    buildMediaRequestFulfillmentCounts,
    enrichMediaRequests,
  };
}
