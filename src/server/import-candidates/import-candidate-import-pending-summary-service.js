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
import { createImportCandidateApplyPreviewService } from './import-candidate-apply-preview-service.js';

function createEmptyImportPendingSummary(limit) {
  return {
    checkedAt: new Date().toISOString(),
    counts: {
      blocked: 0,
      ready: 0,
      readyWithWarnings: 0,
      totalImportPending: 0,
    },
    importPendingCandidates: [],
    pagination: {
      limit,
      offset: 0,
      total: 0,
    },
    summary: {
      message: 'No completed downloads are waiting for import review yet.',
      status: 'empty',
    },
  };
}

function resolveImportStatus(applyPreview) {
  if (applyPreview?.summary?.status === 'blocked') {
    return {
      code: 'blocked',
      message: applyPreview.summary.message,
    };
  }

  if (applyPreview?.summary?.status === 'attention') {
    return {
      code: 'ready_with_warnings',
      message: applyPreview.summary.message,
    };
  }

  return {
    code: 'ready',
    message: applyPreview?.summary?.message ?? 'Completed download paths are resolved and ready for import review.',
  };
}

function buildSummary(counts) {
  if (counts.totalImportPending === 0) {
    return {
      message: 'No completed downloads are waiting for import review yet.',
      status: 'empty',
    };
  }

  if (counts.blocked > 0) {
    return {
      message: `${counts.blocked} completed download candidate${counts.blocked === 1 ? ' is' : 's are'} blocked and need operator attention before import apply can proceed.`,
      status: 'blocked',
    };
  }

  if (counts.readyWithWarnings > 0) {
    return {
      message: `${counts.readyWithWarnings} completed download candidate${counts.readyWithWarnings === 1 ? ' has' : 's have'} warnings but remain ready for import review.`,
      status: 'attention',
    };
  }

  return {
    message: `${counts.ready} completed download candidate${counts.ready === 1 ? ' is' : 's are'} ready for import review.`,
    status: 'ready',
  };
}

export function createImportCandidateImportPendingSummaryService({
  listImportCandidates = async () => ({
    candidates: [],
    pagination: { total: 0 },
  }),
  previewImportCandidate = null,
  previewImportCandidateApply = null,
} = {}) {
  const resolveApplyPreview = previewImportCandidateApply
    ?? (typeof previewImportCandidate === 'function'
      ? createImportCandidateApplyPreviewService({ previewImportCandidate }).previewImportCandidateApply
      : null);

  async function buildImportPendingCandidateSummary({ limit } = {}) {
    const normalizedLimit = normalizeStageSummaryLimit(limit);
    const importPendingQueue = await listImportCandidates({
      limit: normalizedLimit,
      offset: 0,
      status: 'import_pending',
    });

    if (!importPendingQueue.candidates?.length) {
      return createEmptyImportPendingSummary(normalizedLimit);
    }

    if (typeof resolveApplyPreview !== 'function') {
      throw new Error('createImportCandidateImportPendingSummaryService requires previewImportCandidateApply');
    }

    const importPendingCandidates = await Promise.all(importPendingQueue.candidates.map(async (candidate) => {
      const applyPreview = await resolveApplyPreview({ importCandidateId: candidate.id });
      const importStatus = resolveImportStatus(applyPreview);

      return {
        ...buildStageCandidateBase(candidate, applyPreview.preview),
        applyPreview: {
          counts: applyPreview.counts,
          summary: applyPreview.summary,
        },
        importPendingAt: candidate.updatedAt ?? candidate.discoveredAt ?? null,
        importStatus,
      };
    }));

    const counts = importPendingCandidates.reduce((summary, candidate) => {
      summary.totalImportPending += 1;
      switch (candidate.importStatus.code) {
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
      totalImportPending: 0,
    });

    return {
      checkedAt: new Date().toISOString(),
      counts,
      importPendingCandidates,
      pagination: {
        limit: importPendingQueue.pagination?.limit ?? normalizedLimit,
        offset: importPendingQueue.pagination?.offset ?? 0,
        total: importPendingQueue.pagination?.total ?? importPendingCandidates.length,
      },
      summary: buildSummary(counts),
    };
  }

  return {
    buildImportPendingCandidateSummary,
  };
}