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

function buildFileStatus({ decision, libraryTarget, sourceFile }) {
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

  if (counts.skippedCount > 0) {
    return {
      message: `${counts.skippedCount} colliding file${counts.skippedCount === 1 ? '' : 's'} will be skipped during import apply by saved operator decision.`,
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
  previewImportCandidate = null,
  statFn = stat,
} = {}) {
  if (typeof previewImportCandidate !== 'function') {
    throw new Error('createImportCandidateApplyPreviewService requires previewImportCandidate');
  }

  async function previewImportCandidateApply({ importCandidateId }) {
    const preview = await previewImportCandidate({ importCandidateId });
    const filePreviews = Array.isArray(preview?.naming?.filePreviews) ? preview.naming.filePreviews : [];
    const decisions = mapDecisionsByFileId(await listImportCandidateFileDecisions({ importCandidateId }));

    const files = await Promise.all(filePreviews.map(async (filePreview) => {
      const [libraryTarget, sourceFile, stagingTarget] = await Promise.all([
        inspectPath(filePreview.libraryPath, statFn),
        inspectPath(filePreview.sourcePath, statFn),
        inspectPath(filePreview.stagingPath, statFn),
      ]);
      const decision = decisions.get(filePreview.fileId) ?? null;

      return {
        decision,
        fileId: filePreview.fileId,
        filename: filePreview.filename,
        libraryTarget,
        sourceFile,
        stagingTarget,
        status: buildFileStatus({ decision, libraryTarget, sourceFile }),
      };
    }));

    const counts = files.reduce((summary, file) => {
      summary.totalFiles += 1;
      if (file.status.code === 'collision') {
        summary.collisionCount += 1;
      } else if (file.status.code === 'blocked') {
        summary.missingSourceCount += 1;
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
      missingSourceCount: 0,
      readyCount: 0,
      skippedCount: 0,
      stagingPresentCount: 0,
      totalFiles: 0,
    });

    return {
      counts,
      files,
      preview,
      summary: buildSummary(counts, preview),
    };
  }

  return {
    previewImportCandidateApply,
  };
}