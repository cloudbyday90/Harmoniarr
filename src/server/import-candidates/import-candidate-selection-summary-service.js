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

import {
  buildStageCandidateBase,
  normalizeStageSummaryLimit,
} from './import-candidate-stage-summary.js';
import { buildImportCandidateVisibilityFilter } from './import-candidate-visibility.js';

function createEmptySelectedSummary(limit) {
  return {
    checkedAt: new Date().toISOString(),
    counts: {
      blocked: 0,
      ready: 0,
      readyWithWarnings: 0,
      totalSelected: 0,
    },
    pagination: {
      limit,
      offset: 0,
      total: 0,
    },
    selectedCandidates: [],
    summary: {
      message: 'No candidates are selected for the next execution stage yet.',
      status: 'empty',
    },
  };
}

function resolveExecutionStatus(preview) {
  const blockers = preview?.validation?.blockers ?? [];
  const warnings = preview?.validation?.warnings ?? [];

  if (blockers.length > 0) {
    return {
      code: 'blocked',
      message: blockers[0].message,
    };
  }

  if (warnings.length > 0) {
    return {
      code: 'ready_with_warnings',
      message: warnings[0].message,
    };
  }

  return {
    code: 'ready',
    message: 'Planning data is resolved and ready for the next execution slice.',
  };
}

function buildSummary(counts) {
  if (counts.totalSelected === 0) {
    return {
      message: 'No candidates are selected for the next execution stage yet.',
      status: 'empty',
    };
  }

  if (counts.blocked > 0) {
    const verb = counts.blocked === 1 ? 'needs' : 'need';
    return {
      message: `${counts.blocked} selected candidate${counts.blocked === 1 ? ' is' : 's are'} blocked and ${verb} operator attention before download enqueue can proceed.`,
      status: 'blocked',
    };
  }

  if (counts.readyWithWarnings > 0) {
    return {
      message: `${counts.readyWithWarnings} selected candidate${counts.readyWithWarnings === 1 ? ' has' : 's have'} warnings but can still be queued for download.`,
      status: 'attention',
    };
  }

  return {
    message: `${counts.ready} selected candidate${counts.ready === 1 ? ' is' : 's are'} ready for download enqueue.`,
    status: 'ready',
  };
}

export function createImportCandidateSelectionSummaryService({
  listImportCandidates = async () => ({
    candidates: [],
    pagination: { total: 0 },
  }),
  previewImportCandidate = async () => null,
} = {}) {
  async function buildSelectedImportCandidateSummary({
    actorUserId = null,
    actorUserRole = null,
    candidateIds = null,
    limit,
    targetUser = null,
  } = {}) {
    const normalizedLimit = normalizeStageSummaryLimit(limit);
    const visibilityFilter = buildImportCandidateVisibilityFilter({
      actorUserId,
      actorUserRole,
    });
    const selectedQueue = await listImportCandidates({
      ...(Array.isArray(candidateIds) ? { candidateIds } : {}),
      limit: normalizedLimit,
      offset: 0,
      requestedForUserId: visibilityFilter.requestedForUserId,
      status: 'selected',
    });

    if (!selectedQueue.candidates?.length) {
      return createEmptySelectedSummary(normalizedLimit);
    }

    const selectedCandidates = await Promise.all(selectedQueue.candidates.map(async (candidate) => {
      const preview = await previewImportCandidate({ importCandidateId: candidate.id, targetUser });
      const executionStatus = resolveExecutionStatus(preview);

      return {
        ...buildStageCandidateBase(candidate, preview),
        executionStatus,
        selectedAt: candidate.updatedAt ?? candidate.discoveredAt ?? null,
      };
    }));

    const counts = selectedCandidates.reduce((summary, candidate) => {
      summary.totalSelected += 1;
      switch (candidate.executionStatus.code) {
        case 'blocked':
          summary.blocked += 1;
          break;
        case 'ready_with_warnings':
          summary.readyWithWarnings += 1;
          break;
        default:
          summary.ready += 1;
          break;
      }
      return summary;
    }, {
      blocked: 0,
      ready: 0,
      readyWithWarnings: 0,
      totalSelected: 0,
    });

    return {
      checkedAt: new Date().toISOString(),
      counts,
      pagination: {
        limit: selectedQueue.pagination?.limit ?? normalizedLimit,
        offset: selectedQueue.pagination?.offset ?? 0,
        total: selectedQueue.pagination?.total ?? selectedCandidates.length,
      },
      selectedCandidates,
      summary: buildSummary(counts),
    };
  }

  return {
    buildSelectedImportCandidateSummary,
  };
}
