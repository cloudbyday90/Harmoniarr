/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { seedMetadataImportReviewWorkspace } from './metadata-browser-fixtures.js';

export async function openImportReviewRunHistory(page) {
  const disclosure = page.locator('details.import-review-runway');
  await disclosure.waitFor();

  const isOpen = await disclosure.evaluate((element) => element.open);
  if (!isOpen) {
    await disclosure.locator('summary').click();
  }

  await page.waitForFunction(() =>
    globalThis.document.querySelector('details.import-review-runway')?.open === true,
  );
}

export function buildImportReviewCandidate(overrides = {}) {
  const candidateId = overrides.id ?? 'candidate-private';
  const folderPath = overrides.folderPath
    ?? '/private/staging/Boards of Canada/Music Has the Right to Children';

  return {
    discoveredAt: '2026-06-25T17:00:00.000Z',
    fileCount: 1,
    files: [
      {
        bitRateKbps: 921,
        extension: 'flac',
        filename: 'private-track.flac',
        folderPath,
        id: `${candidateId}-file-1`,
        isLocked: false,
        lengthSeconds: 301,
        sizeBytes: 52428800,
      },
    ],
    folderPath,
    id: candidateId,
    lockedFileCount: 0,
    normalizedPayload: {
      extensions: ['flac'],
    },
    sourceSearchId: 'search-private',
    status: 'pending',
    totalSizeBytes: 52428800,
    updatedAt: '2026-06-25T17:08:00.000Z',
    uploaderReputation: {
      evidenceCount: 4,
      reviewState: 'watch',
      successCount: 2,
      successRate: 0.5,
    },
    username: 'remote-peer',
    ...overrides,
  };
}

export function buildFailedImportCandidate(overrides = {}) {
  return buildImportReviewCandidate({
    status: 'failed',
    ...overrides,
  });
}

export function buildImportReviewPreview(candidate = buildImportReviewCandidate()) {
  const fileId = candidate.files?.[0]?.id ?? `${candidate.id}-file-1`;

  return {
    library: {
      previewFolderPath: 'household/listener/Boards of Canada/Music Has the Right to Children',
      rootFolderPolicy: 'requester_root',
    },
    naming: {
      filePreviews: [
        {
          fileId,
          filename: 'private-track.flac',
          libraryPath: 'household/listener/Boards of Canada/Music Has the Right to Children/private-track.flac',
          rawSourcePath: '/private/staging/Boards of Canada/Music Has the Right to Children/private-track.flac',
          sourcePath: '/downloads/complete/Boards of Canada/Music Has the Right to Children/private-track.flac',
          stagingPath: `/data/staging/${candidate.id}/private-track.flac`,
        },
      ],
      strategy: 'metadata_release',
    },
    source: {
      downloadsRoot: '/downloads/complete',
      mapping: {
        harmoniarrPrefix: '/downloads/complete',
        slskdPrefix: '/private/staging',
      },
      resolutionStrategy: 'mapped',
      resolvedFolderPath: '/downloads/complete/Boards of Canada/Music Has the Right to Children',
      sourceFolderPath: '/private/staging/Boards of Canada/Music Has the Right to Children',
    },
    staging: {
      previewFolderPath: `/data/staging/${candidate.id}`,
      root: '/data/staging',
    },
    validation: {
      blockers: [
        {
          code: 'import_validation_failed',
          message: 'Import validation failed for remote-peer. Reopen the candidate after correcting the source files.',
        },
      ],
      warnings: [],
    },
  };
}

export function buildFailedImportPreview(candidate = buildFailedImportCandidate()) {
  return buildImportReviewPreview(candidate);
}

function buildImportReviewRunBase(overrides = {}) {
  const id = overrides.id ?? 'import-review-run-1';
  const startedAt = overrides.startedAt ?? '2026-06-25T18:00:00.000Z';

  return {
    currentStep: 'Run completed in the browser fixture.',
    errorMessage: null,
    finishedAt: overrides.finishedAt ?? '2026-06-25T18:02:00.000Z',
    id,
    items: [],
    requestedCandidateCount: 1,
    startedAt,
    status: 'completed',
    ...overrides,
  };
}

export function buildImportReviewMediaInspectionRun(overrides = {}) {
  return {
    ...buildImportReviewRunBase({
      blockedCandidateCount: 0,
      inspectedCandidateCount: 1,
      inspectedFileCount: 1,
      inspectionUnavailableCount: 0,
      warningCount: 0,
      ...overrides,
    }),
  };
}

export function buildImportReviewExecutionRun(overrides = {}) {
  return {
    ...buildImportReviewRunBase({
      blockedCount: 0,
      processedCandidateCount: 1,
      queuedCount: 1,
      queuedWithWarningsCount: 0,
      queueFailedCount: 0,
      readyCount: 1,
      readyWithWarningsCount: 0,
      ...overrides,
    }),
  };
}

export function buildImportReviewApplyRun(overrides = {}) {
  return {
    ...buildImportReviewRunBase({
      appliedCount: 1,
      appliedWithWarningsCount: 0,
      applyFailedCount: 0,
      blockedCount: 0,
      processedCandidateCount: 1,
      ...overrides,
    }),
  };
}

export function buildImportReviewRunSummary({
  checkedAt = '2026-06-25T18:05:00.000Z',
  currentRun = null,
  recentRuns = [],
  summary = {},
} = {}) {
  return {
    activeRun: currentRun?.status === 'pending' || currentRun?.status === 'running' ? currentRun : null,
    checkedAt,
    currentRun,
    latestRun: currentRun ?? recentRuns[0] ?? null,
    recentRuns: recentRuns.length ? recentRuns : [currentRun].filter(Boolean),
    summary: {
      message: 'Import Review run history is available in the browser fixture.',
      status: currentRun ? 'ready' : 'empty',
      ...summary,
    },
  };
}

export function buildImportReviewDiagnosticCandidate(overrides = {}) {
  const folderPath = overrides.folderPath ?? '/private/staging/Boards of Canada/Geogaddi';
  const candidateId = overrides.id ?? 'candidate-diagnostics';

  return buildImportReviewCandidate({
    fileCount: 2,
    files: [
      {
        bitRateKbps: 921,
        extension: 'flac',
        filename: 'alpha.flac',
        folderPath,
        id: `${candidateId}-file-1`,
        isLocked: false,
        lengthSeconds: 301,
        sizeBytes: 52428800,
      },
      {
        bitRateKbps: 844,
        extension: 'flac',
        filename: 'beta.flac',
        folderPath,
        id: `${candidateId}-file-2`,
        isLocked: false,
        lengthSeconds: 284,
        sizeBytes: 49283072,
      },
    ],
    folderPath,
    id: candidateId,
    lockedFileCount: 0,
    normalizedPayload: {
      extensions: ['flac'],
    },
    sourceSearchId: 'search-diagnostics',
    status: 'selected',
    totalSizeBytes: 101711872,
    username: 'diagnostic-peer',
    ...overrides,
  });
}

export function buildImportReviewPendingComparisonCandidate(overrides = {}) {
  const folderPath = overrides.folderPath ?? '/private/staging/Aphex Twin/Selected Ambient Works';

  return buildImportReviewCandidate({
    fileCount: 1,
    files: [{
      bitRateKbps: 894,
      extension: 'flac',
      filename: 'xtal.flac',
      folderPath,
      id: 'candidate-normal-file-1',
      isLocked: false,
      lengthSeconds: 293,
      sizeBytes: 41779200,
    }],
    folderPath,
    id: 'candidate-normal',
    sourceSearchId: 'search-normal',
    status: 'pending',
    username: 'normal-peer',
    ...overrides,
  });
}

export function buildImportReviewDiagnosticRunWorkspace({
  includeComparisonCandidate = false,
} = {}) {
  const diagnosticCandidate = buildImportReviewDiagnosticCandidate();
  const comparisonCandidate = buildImportReviewPendingComparisonCandidate();
  const currentRun = buildImportReviewMediaInspectionRun({
    id: 'media-inspection-run-current',
  });
  const diagnosticRun = buildImportReviewMediaInspectionRun({
    currentStep: 'Media inspection completed with file diagnostics.',
    id: 'media-inspection-run-diagnostics',
    inspectedCandidateCount: 1,
    inspectedFileCount: 2,
    inspectionDiagnostics: [{
      candidateId: diagnosticCandidate.id,
      code: 'media_inspection_probe_failed',
      fileId: `${diagnosticCandidate.id}-file-1`,
      filename: 'alpha.flac',
      folderPath: diagnosticCandidate.folderPath,
      message: 'ffprobe could not read alpha.flac.',
      username: diagnosticCandidate.username,
    }, {
      candidateId: diagnosticCandidate.id,
      code: 'media_inspection_no_audio_stream',
      fileId: `${diagnosticCandidate.id}-file-2`,
      filename: 'beta.flac',
      folderPath: diagnosticCandidate.folderPath,
      message: 'No audio stream was detected in beta.flac.',
      username: diagnosticCandidate.username,
    }],
    inspectionUnavailableCount: 1,
    status: 'completed',
    warningCount: 2,
  });
  const candidates = includeComparisonCandidate
    ? [diagnosticCandidate, comparisonCandidate]
    : [diagnosticCandidate];

  return {
    candidates,
    mediaInspectionSummary: buildImportReviewRunSummary({
      currentRun,
      recentRuns: [diagnosticRun, currentRun],
      summary: {
        message: 'Media inspection diagnostics are ready.',
      },
    }),
    previewById: Object.fromEntries(
      candidates.map((candidate) => [candidate.id, buildImportReviewPreview(candidate)]),
    ),
    run: diagnosticRun,
    diagnosticCandidate,
    comparisonCandidate,
  };
}

export async function seedImportReviewCandidateWorkspace(page, {
  candidate = buildImportReviewCandidate(),
  preview = buildImportReviewPreview(candidate),
} = {}) {
  await seedMetadataImportReviewWorkspace(page, {
    candidates: [candidate],
    previewById: {
      [candidate.id]: preview,
    },
  });
}

export async function seedFailedImportReviewWorkspace(page, {
  candidate = buildFailedImportCandidate(),
  preview = buildFailedImportPreview(candidate),
} = {}) {
  await seedImportReviewCandidateWorkspace(page, {
    candidate,
    preview,
  });
}
