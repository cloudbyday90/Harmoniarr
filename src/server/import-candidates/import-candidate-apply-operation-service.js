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

import { constants } from 'node:fs';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { posix, win32 } from 'node:path';
import { recordImportOperation } from './import-candidate-operation-repository.js';

function selectPathModule(...pathValues) {
  return pathValues.some((value) => typeof value === 'string' && /^[A-Za-z]:[\\/]/.test(value))
    ? win32
    : posix;
}

function normalizePath(pathValue, pathModule) {
  if (typeof pathValue !== 'string') {
    return '';
  }

  return pathModule === win32
    ? pathValue.replaceAll('/', '\\')
    : pathValue.replaceAll('\\', '/');
}

function isPathInsideRoot(pathValue, rootPath) {
  const pathModule = selectPathModule(pathValue, rootPath);
  const resolvedPath = pathModule.resolve(normalizePath(pathValue, pathModule));
  const resolvedRoot = pathModule.resolve(normalizePath(rootPath, pathModule));
  const relative = pathModule.relative(resolvedRoot, resolvedPath);

  return relative === '' || (!relative.startsWith('..') && !pathModule.isAbsolute(relative));
}

function assertPathInsideRoot({ label, pathValue, rootPath }) {
  if (!rootPath || !isPathInsideRoot(pathValue, rootPath)) {
    const error = new Error(`${label} must remain inside the configured root boundary.`);
    error.code = 'import_candidate_apply_boundary_violation';
    throw error;
  }
}

async function moveFileExclusively({ copyFileFn, destinationPath, mkdirFn, removeFileFn, sourcePath }) {
  const pathModule = selectPathModule(sourcePath, destinationPath);
  await mkdirFn(pathModule.dirname(normalizePath(destinationPath, pathModule)), { recursive: true });
  await copyFileFn(sourcePath, destinationPath, constants.COPYFILE_EXCL);
  await removeFileFn(sourcePath);

  return {
    transport: 'copy_then_remove',
  };
}

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

export function createImportCandidateApplyOperationService({
  copyFileFn = copyFile,
  mkdirFn = mkdir,
  recordImportOperationFn = recordImportOperation,
  removeFileFn = rm,
} = {}) {
  async function applyImportCandidatePreview({
    applyPreview,
    executionMode = 'move',
    importCandidateId = null,
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
      skippedFileCount: 0,
      stagedFromSourceCount: 0,
      totalFiles: applyPreview.files.length,
    };
    let operationPosition = 0;

    async function persistOperation({
      destinationPath,
      errorMessage = null,
      file,
      finishedAt = null,
      sourcePath,
      startedAt = null,
      status,
      stepType,
      transport = null,
    }) {
      if (!operationRunId || !importCandidateId || !file?.fileId) {
        return null;
      }

      operationPosition += 1;

      return recordImportOperationFn({
        destinationPath,
        errorMessage,
        finishedAt,
        importCandidateFileId: file.fileId,
        importCandidateId,
        operationRunId,
        operationType: executionMode,
        position: operationPosition,
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
      };
      let currentStep = null;

      try {
        if (!file.stagingTarget?.exists) {
          currentStep = {
            destinationPath: file.stagingTarget?.path ?? null,
            sourcePath: file.sourceFile?.path ?? null,
            startedAt: new Date().toISOString(),
            stepType: 'stage',
          };
          assertPathInsideRoot({
            label: 'Import source path',
            pathValue: file.sourceFile?.path,
            rootPath: applyPreview?.preview?.source?.resolvedFolderPath,
          });
          assertPathInsideRoot({
            label: 'Staging destination path',
            pathValue: file.stagingTarget?.path,
            rootPath: applyPreview?.preview?.staging?.root,
          });

          const stageMove = await moveFileExclusively({
            copyFileFn,
            destinationPath: file.stagingTarget.path,
            mkdirFn,
            removeFileFn,
            sourcePath: file.sourceFile.path,
          });
          const finishedAt = new Date().toISOString();
          summary.stagedFromSourceCount += 1;
          operation.steps.push({
            destinationPath: file.stagingTarget.path,
            sourcePath: file.sourceFile.path,
            status: 'applied',
            stepType: 'stage',
            transport: stageMove.transport,
          });
          await persistOperation({
            destinationPath: file.stagingTarget.path,
            file,
            finishedAt,
            sourcePath: file.sourceFile.path,
            startedAt: currentStep.startedAt,
            status: 'applied',
            stepType: 'stage',
            transport: stageMove.transport,
          });
        }

        currentStep = {
          destinationPath: file.libraryTarget?.path ?? null,
          sourcePath: file.stagingTarget?.path ?? null,
          startedAt: new Date().toISOString(),
          stepType: 'finalize',
        };
        assertPathInsideRoot({
          label: 'Staging source path',
          pathValue: file.stagingTarget?.path,
          rootPath: applyPreview?.preview?.staging?.root,
        });
        assertPathInsideRoot({
          label: 'Library destination path',
          pathValue: file.libraryTarget?.path,
          rootPath: applyPreview?.preview?.library?.root,
        });

        const finalizeMove = await moveFileExclusively({
          copyFileFn,
          destinationPath: file.libraryTarget.path,
          mkdirFn,
          removeFileFn,
          sourcePath: file.stagingTarget.path,
        });
        const finishedAt = new Date().toISOString();
        operation.steps.push({
          destinationPath: file.libraryTarget.path,
          sourcePath: file.stagingTarget.path,
          status: 'applied',
          stepType: 'finalize',
          transport: finalizeMove.transport,
        });
        operation.status = 'applied';
        operation.transport = finalizeMove.transport;
        summary.appliedFileCount += 1;
        await persistOperation({
          destinationPath: file.libraryTarget.path,
          file,
          finishedAt,
          sourcePath: file.stagingTarget.path,
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