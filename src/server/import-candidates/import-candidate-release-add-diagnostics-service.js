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

import { createApiError } from '../auth.js';
import { buildAcquisitionAddBlockerRepair } from '../acquisition/acquisition-add-blocker-repair.js';
import { deriveImportCandidateAddBlockerCode } from './import-candidate-add-blocker.js';
import { createImportCandidateReleaseAddDiagnosticRepository } from './import-candidate-release-add-diagnostic-repository.js';

const wantedReleaseIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeLimit(value) {
  const parsed = Number.parseInt(String(value ?? 10), 10);
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : 10, 1), 25);
}

function normalizeWantedReleaseId(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return wantedReleaseIdPattern.test(normalized) ? normalized : null;
}

function buildOutcomePresentation({ applyOutcome, blockerCode, itemStatus }) {
  if (blockerCode) {
    const repair = buildAcquisitionAddBlockerRepair(blockerCode);
    return {
      code: repair.code,
      detail: repair.detail,
      label: repair.title,
      nextStep: repair.nextStep,
      settingsRouteLabel: repair.settingsRouteLabel ?? null,
      settingsRouteName: repair.settingsRouteName ?? null,
      tone: 'warning',
    };
  }

  if (itemStatus === 'applied' || applyOutcome === 'applied') {
    return {
      code: 'added_to_library',
      detail: 'Harmoniarr completed the safe library add for this match.',
      label: 'Added to library',
      nextStep: null,
      settingsRouteLabel: null,
      settingsRouteName: null,
      tone: 'success',
    };
  }

  if (itemStatus === 'applied_with_warnings' || applyOutcome === 'applied_with_warnings') {
    return {
      code: 'added_with_warnings',
      detail: 'Harmoniarr completed the library add with recorded warnings.',
      label: 'Added with warnings',
      nextStep: 'Open match diagnostics only if you need the recorded file details.',
      settingsRouteLabel: null,
      settingsRouteName: null,
      tone: 'warning',
    };
  }

  return {
    code: 'add_check_recorded',
    detail: 'Harmoniarr recorded a safe library-add check for this match.',
    label: 'Add check recorded',
    nextStep: 'Open match diagnostics only if you need the detailed add plan.',
    settingsRouteLabel: null,
    settingsRouteName: null,
    tone: 'info',
  };
}

function projectReleaseAddOutcome(item) {
  const apply = item.applySnapshot?.apply ?? {};
  const applyOutcome = typeof apply.outcome === 'string' ? apply.outcome : null;
  const blockerCode = deriveImportCandidateAddBlockerCode({
    applyOutcome,
    itemStatus: item.itemStatus,
    previewBlockerCode: apply.addBlockerCode,
  });

  return {
    diagnosticCandidateId: item.importCandidateId,
    presentation: buildOutcomePresentation({
      applyOutcome,
      blockerCode,
      itemStatus: item.itemStatus,
    }),
    updatedAt: item.updatedAt,
  };
}

function createNotFoundError() {
  return createApiError(404, 'music_queue_release_not_found', 'Music Queue release not found');
}

export function createImportCandidateReleaseAddDiagnosticsService({
  releaseAddDiagnosticRepository = createImportCandidateReleaseAddDiagnosticRepository(),
} = {}) {
  async function buildReleaseAddDiagnostics({
    actorUserId,
    limit,
    wantedReleaseId,
  } = {}) {
    const normalizedWantedReleaseId = normalizeWantedReleaseId(wantedReleaseId);
    if (!normalizedWantedReleaseId || typeof actorUserId !== 'string' || actorUserId.trim().length < 1) {
      throw createNotFoundError();
    }

    const release = await releaseAddDiagnosticRepository.getScopedWantedRelease({
      appUserId: actorUserId.trim(),
      wantedReleaseId: normalizedWantedReleaseId,
    });
    if (!release) {
      throw createNotFoundError();
    }

    const outcomes = (await releaseAddDiagnosticRepository.listLatestReleaseAddOutcomes({
      limit: normalizeLimit(limit),
      wantedReleaseId: normalizedWantedReleaseId,
    })).map(projectReleaseAddOutcome);

    const latestOutcome = outcomes[0] ?? null;
    return {
      checkedAt: new Date().toISOString(),
      latestOutcome,
      outcomes,
      release,
      summary: latestOutcome
        ? {
          message: latestOutcome.presentation.detail,
          status: latestOutcome.presentation.tone,
        }
        : {
          message: 'No library-add result has been recorded for this release yet.',
          status: 'empty',
        },
    };
  }

  return {
    buildReleaseAddDiagnostics,
  };
}
