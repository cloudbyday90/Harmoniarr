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

import { copyFile, link, mkdir, rm, stat } from 'node:fs/promises';
import { posix as path } from 'node:path';
import { createMediaFilesystemService } from '../media/media-filesystem-service.js';
import { recordImportOperation } from './import-candidate-operation-repository.js';

function buildBlockedError(message) {
  const error = new Error(message);
  error.code = 'import_candidate_apply_not_ready';
  return error;
}

function buildNotAttemptedOperation(file) {
  return {
    errorMessage: 'The candidate apply run stopped after an earlier file failure.',
    fileId: file.fileId,
    filename: file.filename,
    libraryPath: file.libraryTarget?.path ?? null,
    sourcePath: file.sourceFile?.path ?? null,
    stagingPath: file.stagingTarget?.path ?? null,
    status: 'not_attempted',
    steps: [],
    transcodeExecution: {
      mode: 'preflight_only',
      status: 'not_attempted',
      warnings: [],
    },
  };
}

function buildSkippedOperation(file) {
  return {
    errorMessage: file.status?.message ?? 'The file was skipped during import apply by operator decision.',
    fileId: file.fileId,
    filename: file.filename,
    libraryPath: file.libraryTarget?.path ?? null,
    sourcePath: file.sourceFile?.path ?? null,
    stagingPath: file.stagingTarget?.path ?? null,
    status: 'skipped',
    steps: [],
    transcodeExecution: {
      mode: 'preflight_only',
      status: 'not_required',
      warnings: [],
    },
  };
}

function resolvePendingStep(file) {
  if (file?.stagingTarget?.exists) {
    return {
      destinationPath: file.libraryTarget?.path ?? null,
      sourcePath: file.stagingTarget?.path ?? null,
      stepType: 'finalize',
    };
  }

  return {
    destinationPath: file?.stagingTarget?.path ?? null,
    sourcePath: file?.sourceFile?.path ?? null,
    stepType: 'stage',
  };
}

function normalizePathInput(value) {
  return typeof value === 'string' ? value.trim().replaceAll('\\', '/') : '';
}

function isPathWithinRoot(pathValue, rootPath) {
  const normalizedPath = normalizePathInput(pathValue);
  const normalizedRoot = normalizePathInput(rootPath).replace(/\/+$/, '');
  if (!normalizedPath || !normalizedRoot) {
    return false;
  }

  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`);
}

function resolveRelativePathWithinRoot(pathValue, rootPath) {
  const normalizedPath = normalizePathInput(pathValue);
  const normalizedRoot = normalizePathInput(rootPath).replace(/\/+$/, '');
  if (!isPathWithinRoot(normalizedPath, normalizedRoot)) {
    return null;
  }

  if (normalizedPath === normalizedRoot) {
    return null;
  }

  return normalizedPath.slice(normalizedRoot.length).replace(/^\/+/, '');
}

function collectReusableCandidatePaths({
  destinationPath,
  libraryRoot,
  sourcePath,
  stagingPath,
  targetUserRootPath,
  configuredUserRootPaths = [],
}) {
  const normalizedDestinationPath = normalizePathInput(destinationPath);
  const normalizedLibraryRoot = normalizePathInput(libraryRoot);
  const normalizedTargetUserRootPath = normalizePathInput(targetUserRootPath);
  const normalizedConfiguredUserRootPaths = configuredUserRootPaths
    .map((entry) => normalizePathInput(entry))
    .filter(Boolean);
  const searchableRoots = [...new Set([
    normalizedLibraryRoot,
    ...normalizedConfiguredUserRootPaths,
  ].filter(Boolean))];
  const activeDestinationRoot = normalizedTargetUserRootPath
    || searchableRoots.find((rootPath) => isPathWithinRoot(normalizedDestinationPath, rootPath))
    || normalizedLibraryRoot;

  const relativePath = resolveRelativePathWithinRoot(
    normalizedDestinationPath,
    activeDestinationRoot,
  );
  if (!relativePath) {
    return [];
  }

  const ignoredPaths = new Set([
    normalizePathInput(sourcePath),
    normalizePathInput(stagingPath),
    normalizePathInput(destinationPath),
  ].filter(Boolean));

  return searchableRoots
    .filter((rootPath) => normalizePathInput(rootPath) !== normalizePathInput(activeDestinationRoot))
    .map((rootPath) => path.join(rootPath, relativePath))
    .map((candidatePath) => normalizePathInput(candidatePath))
    .filter((candidatePath) => !ignoredPaths.has(candidatePath));
}

function normalizeExpectedSize(value) {
  const size = Number(value);
  return Number.isFinite(size) && size >= 0 ? size : null;
}

function buildMutationIntent({
  destinationPath,
  expectedSizeBytes,
  file,
  operationPosition,
  removeSourceAfterSuccess,
  requestedMode,
  sourcePath,
  startedAt,
  stepType,
}) {
  return {
    destinationPath,
    expectedSizeBytes: normalizeExpectedSize(expectedSizeBytes),
    fileId: file.fileId,
    filename: file.filename,
    operationPosition,
    removeSourceAfterSuccess: Boolean(removeSourceAfterSuccess),
    requestedMode,
    sourcePath,
    startedAt,
    stepType,
  };
}

function buildRecoveredMutationStep(intent) {
  return {
    appliedMode: intent.requestedMode,
    destinationPath: intent.destinationPath,
    fallbackFromMode: null,
    fallbackReason: null,
    requestedMode: intent.requestedMode,
    sourcePath: intent.sourcePath,
    status: 'applied',
    stepType: intent.stepType,
    transport: 'confirmed_after_restart',
    verification: {
      destinationExists: true,
      destinationSizeBytes: intent.expectedSizeBytes,
      hardlinkSharedInode: null,
      sourceExistsAfterSuccess: !intent.removeSourceAfterSuccess,
      sourceRemoved: intent.removeSourceAfterSuccess,
      sourceSizeBytes: intent.expectedSizeBytes,
    },
  };
}

export function createImportCandidateApplyOperationService({
  copyFileFn = copyFile,
  linkFn = link,
  mkdirFn = mkdir,
  mediaFilesystemService = null,
  mediaTranscodeExecutionService = null,
  onMutationIntent = async () => {},
  recordImportOperationFn = recordImportOperation,
  removeFileFn = rm,
  statFn = stat,
} = {}) {
  const resolvedMediaFilesystemService = mediaFilesystemService ?? createMediaFilesystemService({
    copyFileFn,
    linkFn,
    mkdirFn,
    removeFileFn,
    statFn,
  });

  async function applyImportCandidatePreview({
    applyPreview,
    executionMode = 'move',
    importCandidateId = null,
    onMutationIntent: onMutationIntentFn = onMutationIntent,
    operationPositionStart = 0,
    operationRunId = null,
  }) {
    if (!Array.isArray(applyPreview?.files)) {
      throw new Error('applyPreview.files must be an array');
    }

    if ((applyPreview?.summary?.status ?? 'blocked') === 'blocked') {
      throw buildBlockedError(applyPreview.summary?.message ?? 'Import candidate is not ready for apply.');
    }

    const fileOperations = [];
    const summary = {
      appliedFileCount: 0,
      failedFileCount: 0,
      notAttemptedCount: 0,
      reusedExistingLosslessCount: 0,
      skippedFileCount: 0,
      stagedFromSourceCount: 0,
      totalFiles: applyPreview.files.length,
      transcodePreflightBypassedCount: 0,
      transcodePreflightFailedCount: 0,
      transcodePreflightPassedCount: 0,
      transcodePreflightUnavailableCount: 0,
    };
    let operationPosition = Number.isInteger(operationPositionStart) && operationPositionStart >= 0
      ? operationPositionStart
      : 0;
    const preferHardlink = applyPreview?.preview?.library?.reusePolicy?.sameVolumeLinkMode === 'prefer_hardlink';
    const duplicateLosslessPolicy = applyPreview?.preview?.library?.reusePolicy?.duplicateLosslessPolicy;
    const canReuseExistingLossless = duplicateLosslessPolicy === 'reuse_existing_lossless_by_default';

    function reserveOperationPosition() {
      operationPosition += 1;
      return operationPosition;
    }

    async function applyFilesystemMutation({
      destinationPath,
      destinationRoot,
      expectedSizeBytes,
      fallbackMode = null,
      file,
      removeSourceAfterSuccess,
      requestedMode,
      sourcePath,
      sourceRoot,
      startedAt,
      stepType,
    }) {
      const operationPositionForMutation = reserveOperationPosition();
      const intent = buildMutationIntent({
        destinationPath,
        expectedSizeBytes,
        file,
        operationPosition: operationPositionForMutation,
        removeSourceAfterSuccess,
        requestedMode,
        sourcePath,
        startedAt,
        stepType,
      });

      await onMutationIntentFn(intent);

      const result = await resolvedMediaFilesystemService.applyExclusiveFileMutationPlan(
        resolvedMediaFilesystemService.createExclusiveFileMutationPlan({
          destinationPath,
          destinationRoot,
          fallbackMode,
          removeSourceAfterSuccess,
          requestedMode,
          sourcePath,
          sourceRoot,
        }),
      );

      return {
        intent,
        result,
      };
    }

    async function resolveReusableSourcePath(file) {
      if (!canReuseExistingLossless) {
        return null;
      }

      const candidatePaths = collectReusableCandidatePaths({
        configuredUserRootPaths: applyPreview?.preview?.library?.configuredUserRootPaths,
        destinationPath: file?.libraryTarget?.path,
        libraryRoot: applyPreview?.preview?.library?.root,
        sourcePath: file?.sourceFile?.path,
        stagingPath: file?.stagingTarget?.path,
        targetUserRootPath: applyPreview?.preview?.library?.targetUser?.userRootPath,
      });

      for (const candidatePath of candidatePaths) {
        try {
          await statFn(candidatePath);
          return candidatePath;
        } catch (error) {
          if (error?.code === 'ENOENT') {
            continue;
          }

          throw error;
        }
      }

      return null;
    }

    async function persistOperation({
      destinationPath,
      errorMessage = null,
      file,
      finishedAt = null,
      sourcePath,
      startedAt = null,
      position = null,
      status,
      stepType,
      transport = null,
    }) {
      if (!operationRunId || !importCandidateId || !file?.fileId) {
        return null;
      }

      const resolvedPosition = Number.isInteger(position) && position > 0
        ? position
        : operationPosition + 1;
      operationPosition = Math.max(operationPosition, resolvedPosition);

      return recordImportOperationFn({
        destinationPath,
        errorMessage,
        finishedAt,
        importCandidateFileId: file.fileId,
        importCandidateId,
        operationRunId,
        operationType: executionMode,
        position: resolvedPosition,
        sourcePath,
        startedAt,
        status,
        stepType,
        transport,
      });
    }

    for (let index = 0; index < applyPreview.files.length; index += 1) {
      const file = applyPreview.files[index];

      if (file.status?.code === 'skipped') {
        const pendingStep = resolvePendingStep(file);
        const operation = buildSkippedOperation(file);
        const now = new Date().toISOString();
        summary.skippedFileCount += 1;
        await persistOperation({
          destinationPath: pendingStep.destinationPath,
          errorMessage: operation.errorMessage,
          file,
          finishedAt: now,
          sourcePath: pendingStep.sourcePath,
          startedAt: now,
          status: 'skipped',
          stepType: pendingStep.stepType,
        });
        fileOperations.push(operation);
        continue;
      }

      if (file.status?.code !== 'ready') {
        throw buildBlockedError(file.status?.message ?? 'Every file must be ready before import apply can begin.');
      }

      const operation = {
        fileId: file.fileId,
        filename: file.filename,
        libraryPath: file.libraryTarget?.path ?? null,
        sourcePath: file.sourceFile?.path ?? null,
        stagingPath: file.stagingTarget?.path ?? null,
        status: 'pending',
        steps: [],
        transcodeExecution: {
          mode: 'preflight_only',
          status: 'not_required',
          warnings: [],
        },
      };
      let currentStep = null;

      if (file.recovery?.confirmedStageIntent) {
        const intent = file.recovery.confirmedStageIntent;
        const finishedAt = new Date().toISOString();
        const recoveredStep = buildRecoveredMutationStep(intent);
        operation.steps.push(recoveredStep);
        summary.stagedFromSourceCount += 1;
        await persistOperation({
          destinationPath: intent.destinationPath,
          file,
          finishedAt,
          position: intent.operationPosition,
          sourcePath: intent.sourcePath,
          startedAt: intent.startedAt,
          status: 'applied',
          stepType: 'stage',
          transport: recoveredStep.transport,
        });
      }

      if (file.recovery?.confirmedFinalizeIntent) {
        const intent = file.recovery.confirmedFinalizeIntent;
        const finishedAt = new Date().toISOString();
        const recoveredStep = buildRecoveredMutationStep(intent);
        operation.steps.push(recoveredStep);
        operation.status = 'applied';
        operation.transport = recoveredStep.transport;
        summary.appliedFileCount += 1;
        await persistOperation({
          destinationPath: intent.destinationPath,
          file,
          finishedAt,
          position: intent.operationPosition,
          sourcePath: intent.sourcePath,
          startedAt: intent.startedAt,
          status: 'applied',
          stepType: 'finalize',
          transport: recoveredStep.transport,
        });
        fileOperations.push(operation);
        continue;
      }

      try {
        if (typeof mediaTranscodeExecutionService?.executeCandidate === 'function') {
          operation.transcodeExecution = await mediaTranscodeExecutionService.executeCandidate({
            sourcePath: file.sourceFile.path,
            transcodePlan: file.transcodePlan,
          });

          if (operation.transcodeExecution.status === 'preflight_passed') {
            summary.transcodePreflightPassedCount += 1;
          } else if (operation.transcodeExecution.status === 'preflight_failed') {
            summary.transcodePreflightFailedCount += 1;
          } else if (operation.transcodeExecution.status === 'tooling_unavailable') {
            summary.transcodePreflightUnavailableCount += 1;
          } else {
            summary.transcodePreflightBypassedCount += 1;
          }
        }

        let finalizeSourcePath = file.stagingTarget?.path ?? null;
        let finalizeSourceRoot = applyPreview?.preview?.staging?.root;
        let finalizeRemovesSource = true;

        if (!file.stagingTarget?.exists) {
          const reusableSourcePath = await resolveReusableSourcePath(file);

          if (reusableSourcePath) {
            currentStep = {
              destinationPath: file.stagingTarget?.path ?? null,
              sourcePath: reusableSourcePath,
              startedAt: new Date().toISOString(),
              stepType: 'stage',
            };
            const finishedAt = new Date().toISOString();
            summary.reusedExistingLosslessCount += 1;
            operation.steps.push({
              appliedMode: 'reuse',
              destinationPath: file.stagingTarget.path,
              fallbackFromMode: null,
              fallbackReason: null,
              requestedMode: 'reuse',
              sourcePath: reusableSourcePath,
              status: 'applied',
              stepType: 'stage',
              transport: 'reuse_existing_lossless',
              verification: {
                destinationExists: false,
                destinationSizeBytes: 0,
                hardlinkSharedInode: null,
                sourceExistsAfterSuccess: true,
                sourceRemoved: false,
                sourceSizeBytes: 0,
              },
            });
            await persistOperation({
              destinationPath: file.stagingTarget.path,
              file,
              finishedAt,
              sourcePath: reusableSourcePath,
              startedAt: currentStep.startedAt,
              status: 'applied',
              stepType: 'stage',
              transport: 'reuse_existing_lossless',
            });

            finalizeSourcePath = reusableSourcePath;
            finalizeSourceRoot = applyPreview?.preview?.library?.root;
            finalizeRemovesSource = false;
          } else {
            currentStep = {
              destinationPath: file.stagingTarget?.path ?? null,
              expectedSizeBytes: file.sourceFile?.sizeBytes ?? null,
              operationPosition: operationPosition + 1,
              removeSourceAfterSuccess: true,
              requestedMode: 'move',
              sourcePath: file.sourceFile?.path ?? null,
              startedAt: new Date().toISOString(),
              stepType: 'stage',
            };
            const { intent: stageIntent, result: stageMove } = await applyFilesystemMutation({
              destinationPath: file.stagingTarget.path,
              destinationRoot: applyPreview?.preview?.staging?.root,
              expectedSizeBytes: currentStep.expectedSizeBytes,
              file,
              removeSourceAfterSuccess: currentStep.removeSourceAfterSuccess,
              requestedMode: currentStep.requestedMode,
              sourcePath: file.sourceFile.path,
              sourceRoot: applyPreview?.preview?.source?.resolvedFolderPath,
              startedAt: currentStep.startedAt,
              stepType: currentStep.stepType,
            });
            const finishedAt = new Date().toISOString();
            summary.stagedFromSourceCount += 1;
            operation.steps.push({
              appliedMode: stageMove.appliedMode,
              destinationPath: file.stagingTarget.path,
              fallbackFromMode: stageMove.fallbackFromMode,
              fallbackReason: stageMove.fallbackReason,
              requestedMode: stageMove.requestedMode,
              sourcePath: file.sourceFile.path,
              status: 'applied',
              stepType: 'stage',
              transport: stageMove.transport,
              verification: stageMove.verification,
            });
            await persistOperation({
              destinationPath: file.stagingTarget.path,
              file,
              finishedAt,
              position: stageIntent.operationPosition,
              sourcePath: file.sourceFile.path,
              startedAt: currentStep.startedAt,
              status: 'applied',
              stepType: 'stage',
              transport: stageMove.transport,
            });
          }
        }

        const finalizeRequestedMode = preferHardlink ? 'hardlink' : (finalizeRemovesSource ? 'move' : 'copy');
        const finalizeFallbackMode = preferHardlink ? (finalizeRemovesSource ? 'move' : 'copy') : null;
        currentStep = {
          destinationPath: file.libraryTarget?.path ?? null,
          expectedSizeBytes: file.sourceFile?.sizeBytes ?? null,
          operationPosition: operationPosition + 1,
          removeSourceAfterSuccess: finalizeRemovesSource,
          requestedMode: finalizeRequestedMode,
          sourcePath: finalizeSourcePath,
          startedAt: new Date().toISOString(),
          stepType: 'finalize',
        };
        const { intent: finalizeIntent, result: finalizeMove } = await applyFilesystemMutation({
          destinationPath: file.libraryTarget.path,
          destinationRoot: applyPreview?.preview?.library?.root,
          expectedSizeBytes: currentStep.expectedSizeBytes,
          fallbackMode: finalizeFallbackMode,
          file,
          removeSourceAfterSuccess: currentStep.removeSourceAfterSuccess,
          requestedMode: currentStep.requestedMode,
          sourcePath: finalizeSourcePath,
          sourceRoot: finalizeSourceRoot,
          startedAt: currentStep.startedAt,
          stepType: currentStep.stepType,
        });
        const finishedAt = new Date().toISOString();
        operation.steps.push({
          appliedMode: finalizeMove.appliedMode,
          destinationPath: file.libraryTarget.path,
          fallbackFromMode: finalizeMove.fallbackFromMode,
          fallbackReason: finalizeMove.fallbackReason,
          requestedMode: finalizeMove.requestedMode,
          sourcePath: finalizeSourcePath,
          status: 'applied',
          stepType: 'finalize',
          transport: finalizeMove.transport,
          verification: finalizeMove.verification,
        });
        operation.status = 'applied';
        operation.transport = finalizeMove.transport;
        summary.appliedFileCount += 1;
        await persistOperation({
          destinationPath: file.libraryTarget.path,
          file,
          finishedAt,
          position: finalizeIntent.operationPosition,
          sourcePath: finalizeSourcePath,
          startedAt: currentStep.startedAt,
          status: 'applied',
          stepType: 'finalize',
          transport: finalizeMove.transport,
        });
        fileOperations.push(operation);
      } catch (error) {
        summary.failedFileCount += 1;
        operation.errorMessage = error instanceof Error ? error.message : String(error);
        operation.status = 'failed';
        if (currentStep?.sourcePath && currentStep?.destinationPath) {
          await persistOperation({
            destinationPath: currentStep.destinationPath,
            errorMessage: operation.errorMessage,
            file,
            finishedAt: new Date().toISOString(),
            position: currentStep.operationPosition,
            sourcePath: currentStep.sourcePath,
            startedAt: currentStep.startedAt,
            status: 'failed',
            stepType: currentStep.stepType,
          });
        }
        fileOperations.push(operation);

        for (let remainingIndex = index + 1; remainingIndex < applyPreview.files.length; remainingIndex += 1) {
          summary.notAttemptedCount += 1;
          const remainingFile = applyPreview.files[remainingIndex];
          const notAttemptedOperation = buildNotAttemptedOperation(remainingFile);
          const pendingStep = resolvePendingStep(remainingFile);
          fileOperations.push(notAttemptedOperation);
          await persistOperation({
            destinationPath: pendingStep.destinationPath,
            errorMessage: notAttemptedOperation.errorMessage,
            file: remainingFile,
            finishedAt: new Date().toISOString(),
            sourcePath: pendingStep.sourcePath,
            startedAt: new Date().toISOString(),
            status: 'not_attempted',
            stepType: pendingStep.stepType,
          });
        }

        return {
          executionMode,
          fileOperations,
          summary,
        };
      }
    }

    return {
      executionMode,
      fileOperations,
      summary,
    };
  }

  return {
    applyImportCandidatePreview,
  };
}
