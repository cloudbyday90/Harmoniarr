/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createDockerProviderAcceptanceArtifact } from '../../scripts/docker-provider-acceptance-artifact.js';

test('createDockerProviderAcceptanceArtifact persists only bounded provider acceptance evidence', () => {
  const artifact = createDockerProviderAcceptanceArtifact({
    baseUrl: 'http://127.0.0.1:47956',
    browser: {
      checkpoints: ['login_completed'],
      screenshots: [{ path: 'C:/repo/artifacts/login.png' }],
    },
    checkedAt: '2026-08-26T12:00:00.000Z',
    importReview: {
      currentRun: {
        id: 'execution-run-1',
        itemCount: 1,
        queuedCount: 1,
        queueFailedCount: 0,
        requestedCandidateCount: 1,
        status: 'running',
      },
      diagnosticCount: 1,
      diagnostics: [{
        acceptedTransferCount: 1,
        candidateId: 'candidate-1',
        code: 'provider_accepted',
        failedFileCount: 0,
        requestedFileCount: 1,
        title: 'Provider accepted transfer',
        tone: 'success',
      }],
      summaryStatus: 'running',
    },
    musicQueue: {
      afterRefresh: {
        linkedTransferCount: 1,
        totalTransferCount: 2,
      },
      linkedTransferCount: 1,
      totalTransferCount: 2,
    },
    paths: {
      downloadMappingCount: 1,
      downloadsRootConfigured: true,
      slskdBaseUrlConfigured: true,
      slskdSecretConfigured: true,
    },
    provider: {
      enabled: true,
      queueCounts: {
        active: 1,
        completed: 0,
        failed: 0,
        queued: 0,
        total: 1,
      },
      queueHealthStatus: 'busy',
    },
    readiness: {
      code: 'ready',
      label: 'Provider acceptance evidence is ready',
      nextAction: 'Save this result with your local validation evidence.',
      ready: true,
      status: 'ready',
      summary: 'All selected provider acceptance requirements are met.',
    },
    requirements: {
      requireAcceptedTransfer: true,
      requireConfiguredProvider: true,
      requireDiagnostic: true,
      requireMusicQueueLink: true,
      requirePathMapping: true,
    },
    username: 'walkthrough-admin',
  });

  assert.deepEqual(artifact, {
    checkedAt: '2026-08-26T12:00:00.000Z',
    importReview: {
      currentRun: {
        itemCount: 1,
        queuedCount: 1,
        queueFailedCount: 0,
        requestedCandidateCount: 1,
        status: 'running',
      },
      diagnosticCount: 1,
      diagnostics: [{
        acceptedTransferCount: 1,
        code: 'provider_accepted',
        failedFileCount: 0,
        requestedFileCount: 1,
      }],
      summaryStatus: 'running',
    },
    musicQueue: {
      afterRefresh: {
        linkedTransferCount: 1,
        totalTransferCount: 2,
      },
      linkedTransferCount: 1,
      totalTransferCount: 2,
    },
    paths: {
      downloadMappingCount: 1,
      downloadsRootConfigured: true,
      slskdBaseUrlConfigured: true,
      slskdSecretConfigured: true,
    },
    provider: {
      enabled: true,
      queueCounts: {
        active: 1,
        completed: 0,
        failed: 0,
        queued: 0,
        total: 1,
      },
      queueHealthStatus: 'busy',
    },
    readiness: {
      code: 'ready',
      label: 'Provider acceptance evidence is ready',
      nextAction: 'Save this result with your local validation evidence.',
      ready: true,
      status: 'ready',
      summary: 'All selected provider acceptance requirements are met.',
    },
    requirements: {
      requireAcceptedTransfer: true,
      requireConfiguredProvider: true,
      requireDiagnostic: true,
      requireMusicQueueLink: true,
      requirePathMapping: true,
    },
  });

  assert.doesNotMatch(
    JSON.stringify(artifact),
    /127\.0\.0\.1|walkthrough-admin|execution-run-1|candidate-1|Provider accepted transfer|C:\/repo/u,
  );
});
