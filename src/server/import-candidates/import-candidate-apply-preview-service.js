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

import { stat } from 'node:fs/promises';
import { createMediaLosslessRetentionPolicyService } from '../media/media-lossless-retention-policy-service.js';

function mapDecisionsByFileId(decisions) {
  return decisions.reduce((mapped, decision) => {
    mapped.set(decision.importCandidateFileId, decision);
    return mapped;
  }, new Map());
}

async function inspectPath(pathValue, statFn) {
  if (!pathValue) {
    return {
      exists: false,
      path: pathValue,
      type: 'missing',
    };
  }

  try {
    const stats = await statFn(pathValue);
    return {
      exists: true,
      path: pathValue,
      type: stats.isDirectory() ? 'directory' : 'file',
    };
  } catch {
    return {
      exists: false,
      path: pathValue,
      type: 'missing',
    };
  }
}

function buildFileStatus({ decision, libraryTarget, losslessPolicy, sourceFile }) {
  if (!sourceFile.exists) {
    return {
      code: 'blocked',
      message: 'The expected source file is not reachable from the resolved download path.',
    };
  }

  if (libraryTarget.exists) {
    if (decision?.decisionType === 'skip') {
      return {
        code: 'skipped',
        message: 'The target library path already exists, and this file will be skipped during import apply by operator decision.',
      };
    }

    return {
      code: 'collision',
      message: 'The target library path already exists and would require an operator decision before import apply.',
    };
  }

  if (losslessPolicy.requiresLossyAcknowledgement && !losslessPolicy.lossyDerivativeAcknowledged) {
    return {
      code: 'blocked',
      message: 'This lossy transcode candidate requires an explicit allow-lossy-derivative decision before import apply can continue.',
    };
  }

  return {
    code: 'ready',
    message: 'The file can be staged for import apply without overwriting an existing library target.',
  };
}

function buildSummary(counts, preview) {
  if ((preview?.validation?.blockers?.length ?? 0) > 0) {
    return {
      message: preview.validation.blockers[0].message,
      status: 'blocked',
    };
  }

  if (counts.missingSourceCount > 0) {
    return {
      message: `${counts.missingSourceCount} file${counts.missingSourceCount === 1 ? ' is' : 's are'} missing from the resolved source path and block import apply.`,
      status: 'blocked',
    };
  }

  if (counts.collisionCount > 0) {
    return {
      message: `${counts.collisionCount} target file${counts.collisionCount === 1 ? '' : 's'} already exist in the library and require collision review before import apply.`,
      status: 'blocked',
    };
  }

  if (counts.lossyDecisionRequiredCount > 0) {
    return {
      message: `${counts.lossyDecisionRequiredCount} lossy transcode candidate file${counts.lossyDecisionRequiredCount === 1 ? ' requires' : 's require'} an explicit allow-lossy-derivative decision before import apply.`,
      status: 'blocked',
    };
  }

  if (counts.skippedCount > 0) {
    return {
      message: `${counts.skippedCount} colliding file${counts.skippedCount === 1 ? '' : 's'} will be skipped during import apply by saved operator decision.`,
      status: 'attention',
    };
  }

  if (counts.inspectionWarningCount > 0) {
    return {
      message: `${counts.inspectionWarningCount} media inspection warning${counts.inspectionWarningCount === 1 ? ' is' : 's are'} present in apply preview.`,
      status: 'attention',
    };
  }

  if (counts.transcodeWarningCount > 0) {
    return {
      message: `${counts.transcodeWarningCount} transcode planning warning${counts.transcodeWarningCount === 1 ? ' is' : 's are'} present in apply preview.`,
      status: 'attention',
    };
  }

  if (counts.losslessPolicyWarningCount > 0) {
    return {
      message: `${counts.losslessPolicyWarningCount} lossless-retention policy warning${counts.losslessPolicyWarningCount === 1 ? ' is' : 's are'} present in apply preview.`,
      status: 'attention',
    };
  }

  if ((preview?.validation?.warnings?.length ?? 0) > 0) {
    return {
      message: preview.validation.warnings[0].message,
      status: 'attention',
    };
  }

  return {
    message: `${counts.readyCount} file${counts.readyCount === 1 ? ' is' : 's are'} ready for a guarded import apply preview.`,
    status: 'ready',
  };
}

export function createImportCandidateApplyPreviewService({
  listImportCandidateFileDecisions = async () => [],
  mediaLosslessRetentionPolicyService = createMediaLosslessRetentionPolicyService(),
  mediaInspectionService = null,
  mediaTranscodePlanningService = null,
  previewImportCandidate = null,
  statFn = stat,
} = {}) {
  if (typeof previewImportCandidate !== 'function') {
    throw new Error('createImportCandidateApplyPreviewService requires previewImportCandidate');
  }

  async function previewImportCandidateApply({ importCandidateId, targetUser = null }) {
    const preview = await previewImportCandidate({ importCandidateId, targetUser });
    const filePreviews = Array.isArray(preview?.naming?.filePreviews) ? preview.naming.filePreviews : [];
    const decisions = mapDecisionsByFileId(await listImportCandidateFileDecisions({ importCandidateId }));
    const hasMediaLosslessRetentionPolicy = typeof mediaLosslessRetentionPolicyService?.evaluateCandidatePolicy === 'function';
    const hasMediaInspection = typeof mediaInspectionService?.inspectSourceFile === 'function';
    const hasMediaTranscodePlanning = typeof mediaTranscodePlanningService?.planInspection === 'function';

    const files = await Promise.all(filePreviews.map(async (filePreview) => {
      const [libraryTarget, sourceFile, stagingTarget] = await Promise.all([
        inspectPath(filePreview.libraryPath, statFn),
        inspectPath(filePreview.sourcePath, statFn),
        inspectPath(filePreview.stagingPath, statFn),
      ]);
      const decision = decisions.get(filePreview.fileId) ?? null;
      const inspection = hasMediaInspection && sourceFile.exists
        ? await mediaInspectionService.inspectSourceFile({ sourcePath: filePreview.sourcePath })
        : {
          metadata: null,
          warnings: [],
        };
      const transcodePlan = hasMediaTranscodePlanning && sourceFile.exists
        ? mediaTranscodePlanningService.planInspection({
          inspection,
        })
        : {
          mode: 'planning_only',
          rationale: 'transcode_planning_not_configured',
          recommendedAction: 'keep_original',
          target: null,
          warnings: [],
        };
      const losslessPolicy = hasMediaLosslessRetentionPolicy
        ? mediaLosslessRetentionPolicyService.evaluateCandidatePolicy({
          decision,
          transcodePlan,
        })
        : {
          lossyDerivativeAcknowledged: false,
          requiresLossyAcknowledgement: false,
          warnings: [],
        };

      return {
        decision,
        fileId: filePreview.fileId,
        filename: filePreview.filename,
        inspection,
        libraryTarget,
        losslessPolicy,
        sourceFile,
        stagingTarget,
        status: buildFileStatus({
          decision,
          libraryTarget,
          losslessPolicy,
          sourceFile,
        }),
        transcodePlan,
      };
    }));

    const counts = files.reduce((summary, file) => {
      summary.totalFiles += 1;
      summary.inspectionWarningCount += file.inspection.warnings.length;
      summary.losslessPolicyWarningCount += file.losslessPolicy.warnings.length;
      summary.transcodeWarningCount += file.transcodePlan.warnings.length;
      if (file.status.code === 'collision') {
        summary.collisionCount += 1;
      } else if (file.status.code === 'blocked') {
        if (file.losslessPolicy.requiresLossyAcknowledgement && !file.losslessPolicy.lossyDerivativeAcknowledged) {
          summary.lossyDecisionRequiredCount += 1;
        } else {
          summary.missingSourceCount += 1;
        }
      } else if (file.status.code === 'skipped') {
        summary.skippedCount += 1;
      } else {
        summary.readyCount += 1;
      }

      if (file.stagingTarget.exists) {
        summary.stagingPresentCount += 1;
      }

      return summary;
    }, {
      collisionCount: 0,
      inspectionWarningCount: 0,
      losslessPolicyWarningCount: 0,
      lossyDecisionRequiredCount: 0,
      missingSourceCount: 0,
      readyCount: 0,
      skippedCount: 0,
      stagingPresentCount: 0,
      totalFiles: 0,
      transcodeWarningCount: 0,
    });

    const inspectionWarnings = files.flatMap((file) => file.inspection.warnings.map((warning) => ({
      ...warning,
      fileId: file.fileId,
      filename: file.filename,
    })));
    const transcodeWarnings = files.flatMap((file) => file.transcodePlan.warnings.map((warning) => ({
      ...warning,
      fileId: file.fileId,
      filename: file.filename,
    })));
    const losslessPolicyWarnings = files.flatMap((file) => file.losslessPolicy.warnings.map((warning) => ({
      ...warning,
      fileId: file.fileId,
      filename: file.filename,
    })));

    return {
      counts,
      files,
      inspectionWarnings,
      losslessPolicyWarnings,
      preview,
      summary: buildSummary(counts, preview),
      transcodeWarnings,
    };
  }

  return {
    previewImportCandidateApply,
  };
}