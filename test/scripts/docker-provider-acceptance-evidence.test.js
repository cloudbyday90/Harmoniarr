import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertProviderAcceptanceEvidenceResult,
  buildProviderAcceptanceEvidenceResult,
  openImportReviewRunHistoryDisclosure,
  renderDockerProviderAcceptanceSuccessMessage,
  runDockerProviderAcceptanceEvidence,
  summarizeExecutionDiagnostics,
} from '../../scripts/docker-provider-acceptance-evidence.js';
import {
  dockerProviderAcceptanceEvidencePathEnvVar,
  resolveDockerProviderAcceptanceInputs,
} from '../../scripts/validate-docker-provider-acceptance.js';

function createDownloaderQueue(overrides = {}) {
  return {
    downloader: {
      providerState: {
        enabled: true,
      },
      queueHealth: {
        counts: {
          active: 1,
          completed: 0,
          failed: 0,
          queued: 0,
          total: 1,
        },
        status: 'busy',
      },
      transfers: [],
      ...overrides,
    },
  };
}

function createSettingsPayload(overrides = {}) {
  return {
    secretStatus: {
      slskd: {
        apiKeyConfigured: true,
        apiKeySource: 'stored',
      },
    },
    settings: {
      paths: {
        downloadMappings: [{
          harmoniarrPrefix: '/data/downloads/complete',
          slskdPrefix: '/downloads/complete/Music',
        }],
        downloads: '/data/downloads',
      },
      slskd: {
        apiKey: 'should-not-appear',
        baseUrl: 'http://slskd:5030',
      },
    },
    ...overrides,
  };
}

function createExecutionSummary({ diagnosticCode = 'provider_accepted' } = {}) {
  return {
    importCandidateExecution: {
      currentRun: {
        id: 'execution-run-1',
        items: [{
          id: 'item-1',
          planningSnapshot: {
            candidate: {
              id: 'candidate-1',
            },
            execution: {
              diagnostics: {
                downloadAcceptance: {
                  code: diagnosticCode,
                  counts: {
                    enqueuedTransfers: diagnosticCode === 'provider_accepted' ? 1 : 0,
                    failedFiles: diagnosticCode === 'provider_accepted' ? 0 : 1,
                    requestedFiles: 1,
                  },
                  message: 'The download provider accepted 1 transfer for this candidate.',
                  operatorAction: 'Monitor Downloader until the transfer completes.',
                  title: diagnosticCode === 'provider_accepted'
                    ? 'Provider accepted transfer'
                    : 'Provider rejected the candidate',
                  tone: diagnosticCode === 'provider_accepted' ? 'success' : 'danger',
                },
              },
            },
          },
        }],
        queuedCount: diagnosticCode === 'provider_accepted' ? 1 : 0,
        queueFailedCount: diagnosticCode === 'provider_accepted' ? 0 : 1,
        requestedCandidateCount: 1,
        status: diagnosticCode === 'provider_accepted' ? 'running' : 'completed',
      },
      summary: {
        status: diagnosticCode === 'provider_accepted' ? 'running' : 'completed',
      },
    },
  };
}

function createImportReviewRunHistoryPage({ isOpen = false } = {}) {
  const calls = {
    disclosureHeadingWaits: 0,
    disclosureWaits: 0,
    openDisclosureWaits: 0,
    summaryClicks: 0,
  };
  const state = { isOpen };
  const heading = {
    waitFor: async () => {
      calls.disclosureHeadingWaits += 1;
    },
  };
  const summary = {
    click: async () => {
      calls.summaryClicks += 1;
      state.isOpen = true;
    },
  };
  const disclosure = {
    evaluate: async (callback) => callback({ open: state.isOpen }),
    getByRole: (role, options) => {
      assert.equal(role, 'heading');
      assert.deepEqual(options, {
        exact: true,
        name: 'Run history and controls',
      });
      return heading;
    },
    locator: (selector) => {
      assert.equal(selector, ':scope > summary');
      return summary;
    },
    waitFor: async () => {
      calls.disclosureWaits += 1;
    },
  };
  const openDisclosure = {
    waitFor: async () => {
      assert.equal(state.isOpen, true);
      calls.openDisclosureWaits += 1;
    },
  };
  const page = {
    locator: (selector) => {
      if (selector === 'details.import-review-runway') {
        return disclosure;
      }

      assert.equal(selector, 'details.import-review-runway[open]');
      return openDisclosure;
    },
  };

  return {
    calls,
    disclosure,
    page,
  };
}

test('openImportReviewRunHistoryDisclosure opens the native advanced diagnostics disclosure', async () => {
  const { calls, disclosure, page } = createImportReviewRunHistoryPage();

  const result = await openImportReviewRunHistoryDisclosure(page);

  assert.equal(result, disclosure);
  assert.deepEqual(calls, {
    disclosureHeadingWaits: 1,
    disclosureWaits: 1,
    openDisclosureWaits: 1,
    summaryClicks: 1,
  });
});

test('openImportReviewRunHistoryDisclosure preserves an already open disclosure', async () => {
  const { calls, page } = createImportReviewRunHistoryPage({ isOpen: true });

  await openImportReviewRunHistoryDisclosure(page);

  assert.deepEqual(calls, {
    disclosureHeadingWaits: 1,
    disclosureWaits: 1,
    openDisclosureWaits: 1,
    summaryClicks: 0,
  });
});

test('summarizeExecutionDiagnostics extracts bounded download acceptance details', () => {
  const result = summarizeExecutionDiagnostics(createExecutionSummary());

  assert.deepEqual(result, {
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
  });
});

test('buildProviderAcceptanceEvidenceResult redacts provider secrets and path prefixes', () => {
  const result = buildProviderAcceptanceEvidenceResult({
    baseUrl: 'http://127.0.0.1:47956',
    downloaderQueue: createDownloaderQueue(),
    executionSummary: createExecutionSummary(),
    settings: createSettingsPayload(),
    username: 'walkthrough-admin',
  });

  assert.equal(result.provider.enabled, true);
  assert.deepEqual(result.musicQueue, {
    linkedTransferCount: 0,
    totalTransferCount: 0,
  });
  assert.equal(result.paths.slskdSecretConfigured, true);
  assert.equal(result.paths.downloadMappingCount, 1);
  assert.equal(result.readiness.ready, true);
  assert.doesNotMatch(JSON.stringify(result), /should-not-appear/u);
  assert.doesNotMatch(JSON.stringify(result), /\/downloads\/complete\/Music|\/data\/downloads/u);
});

test('assertProviderAcceptanceEvidenceResult rejects missing diagnostics by default', () => {
  const result = buildProviderAcceptanceEvidenceResult({
    baseUrl: 'http://127.0.0.1:47956',
    downloaderQueue: createDownloaderQueue(),
    executionSummary: {
      importCandidateExecution: {
        currentRun: {
          id: 'execution-run-1',
          items: [],
          status: 'completed',
        },
      },
    },
    settings: createSettingsPayload(),
    username: 'walkthrough-admin',
  });

  assert.throws(
    () => assertProviderAcceptanceEvidenceResult(result),
    /Record a download outcome: No Import Review download outcome has been recorded yet\./u,
  );
});

test('assertProviderAcceptanceEvidenceResult can require accepted provider evidence', () => {
  const rejectedResult = buildProviderAcceptanceEvidenceResult({
    baseUrl: 'http://127.0.0.1:47956',
    downloaderQueue: createDownloaderQueue(),
    executionSummary: createExecutionSummary({ diagnosticCode: 'provider_rejected_all_files' }),
    settings: createSettingsPayload(),
    username: 'walkthrough-admin',
  });

  assert.throws(
    () => assertProviderAcceptanceEvidenceResult(rejectedResult, { requireAcceptedTransfer: true }),
    /Get a provider-accepted transfer: The provider has not accepted a transfer yet\./u,
  );

  const acceptedResult = buildProviderAcceptanceEvidenceResult({
    baseUrl: 'http://127.0.0.1:47956',
    downloaderQueue: createDownloaderQueue(),
    executionSummary: createExecutionSummary(),
    settings: createSettingsPayload(),
    username: 'walkthrough-admin',
  });
  assert.equal(
    assertProviderAcceptanceEvidenceResult(acceptedResult, { requireAcceptedTransfer: true })
      .importReview.diagnostics[0].code,
    'provider_accepted',
  );
});

test('assertProviderAcceptanceEvidenceResult can require a Music Queue-linked transfer', () => {
  const result = buildProviderAcceptanceEvidenceResult({
    baseUrl: 'http://127.0.0.1:47956',
    downloaderQueue: createDownloaderQueue({
      transfers: [{
        diagnostics: {
          importLinkage: {
            musicQueueRelease: {
              wantedReleaseId: 'wanted-release-1',
            },
          },
        },
        id: 'transfer-1',
        sourceUser: 'source-one',
        transferKey: 'source-one::transfer-1',
      }],
    }),
    executionSummary: createExecutionSummary(),
    settings: createSettingsPayload(),
    username: 'walkthrough-admin',
  });

  assert.equal(
    assertProviderAcceptanceEvidenceResult(result, { requireMusicQueueLink: true })
      .musicQueue.linkedTransferCount,
    1,
  );
});

test('resolveDockerProviderAcceptanceInputs reads walkthrough defaults and strict evidence options', async () => {
  const inputs = await resolveDockerProviderAcceptanceInputs({
    args: ['--require-accepted-transfer', '--require-music-queue-link', '--timeout-ms', '25000'],
    env: {
      [dockerProviderAcceptanceEvidencePathEnvVar]: 'artifacts/provider-acceptance.json',
      HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_HEADLESS: 'false',
      HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_SCREENSHOT_DIR: 'artifacts/screens',
      HARMONIARR_WALKTHROUGH_PASSWORD: 'HarmoniarrLocal123!',
      HARMONIARR_WALKTHROUGH_USERNAME: 'walkthrough-admin',
    },
  });

  assert.deepEqual(inputs, {
    baseUrl: 'http://127.0.0.1:47956',
    evidencePath: 'artifacts/provider-acceptance.json',
    headless: false,
    password: 'HarmoniarrLocal123!',
    requireAcceptedTransfer: true,
    requireConfiguredProvider: true,
    requireDiagnostic: true,
    requireMusicQueueLink: true,
    requirePathMapping: true,
    screenshotDir: 'artifacts/screens',
    timeoutMs: 25_000,
    username: 'walkthrough-admin',
  });
});

test('resolveDockerProviderAcceptanceInputs accepts a file-backed walkthrough password', async () => {
  const inputs = await resolveDockerProviderAcceptanceInputs({
    args: ['--password-file', 'C:/secrets/walkthrough-password'],
    env: {
      HARMONIARR_WALKTHROUGH_USERNAME: 'walkthrough-admin',
    },
    readFileFn: async (path, encoding) => {
      assert.equal(path, 'C:/secrets/walkthrough-password');
      assert.equal(encoding, 'utf8');
      return 'FilePass123!\n';
    },
  });

  assert.equal(inputs.password, 'FilePass123!');
});

test('resolveDockerProviderAcceptanceInputs selects read-only readiness requirements', async () => {
  const inputs = await resolveDockerProviderAcceptanceInputs({
    args: ['--readiness-only'],
    env: {
      HARMONIARR_WALKTHROUGH_PASSWORD: 'HarmoniarrLocal123!',
      HARMONIARR_WALKTHROUGH_USERNAME: 'walkthrough-admin',
    },
  });

  assert.equal(inputs.requireAcceptedTransfer, false);
  assert.equal(inputs.requireConfiguredProvider, true);
  assert.equal(inputs.requireDiagnostic, false);
  assert.equal(inputs.requireMusicQueueLink, false);
  assert.equal(inputs.requirePathMapping, true);
});

test('renderDockerProviderAcceptanceSuccessMessage distinguishes readiness from transfer acceptance', () => {
  const readinessMessage = renderDockerProviderAcceptanceSuccessMessage({
    baseUrl: 'http://127.0.0.1:47956',
    importReview: { diagnostics: [] },
    provider: { queueHealthStatus: 'ready' },
    requirements: {
      requireAcceptedTransfer: false,
      requireConfiguredProvider: true,
      requireDiagnostic: false,
      requireMusicQueueLink: false,
      requirePathMapping: true,
    },
    username: 'walkthrough-admin',
  });
  const acceptanceMessage = renderDockerProviderAcceptanceSuccessMessage({
    baseUrl: 'http://127.0.0.1:47956',
    importReview: { diagnostics: [] },
    provider: { queueHealthStatus: 'ready' },
    requirements: {
      requireAcceptedTransfer: false,
      requireConfiguredProvider: true,
      requireDiagnostic: true,
      requireMusicQueueLink: false,
      requirePathMapping: true,
    },
    username: 'walkthrough-admin',
  });

  assert.match(readinessMessage, /^Docker provider readiness evidence passed/u);
  assert.match(acceptanceMessage, /^Docker provider acceptance evidence passed/u);
});

test('runDockerProviderAcceptanceEvidence writes evidence and closes browser resources', async () => {
  const calls = {
    closeBrowser: 0,
    closeContext: 0,
    screenshots: [],
    setDefaultTimeout: [],
    writeEvidence: [],
  };
  const page = {
    screenshot: async (options) => {
      calls.screenshots.push(options);
    },
    setDefaultTimeout: (timeoutMs) => {
      calls.setDefaultTimeout.push(timeoutMs);
    },
  };
  const browserContext = {
    close: async () => {
      calls.closeContext += 1;
    },
    newPage: async () => page,
  };
  const browser = {
    close: async () => {
      calls.closeBrowser += 1;
    },
    newContext: async () => browserContext,
  };

  const result = await runDockerProviderAcceptanceEvidence({
    baseUrl: 'http://127.0.0.1:49100',
    evidencePath: 'artifacts/provider-acceptance.json',
    launchBrowserFn: async () => browser,
    mkdirFn: async () => {},
    password: 'BrowserPass123!',
    runProviderAcceptanceBrowserScenarioFn: async ({ baseUrl, password, recordCheckpoint, username }) => {
      assert.equal(baseUrl, 'http://127.0.0.1:49100');
      assert.equal(username, 'admin');
      assert.equal(password, 'BrowserPass123!');
      await recordCheckpoint('login_completed');
      await recordCheckpoint('provider_acceptance_ui_verified');
      return buildProviderAcceptanceEvidenceResult({
        baseUrl,
        downloaderQueue: createDownloaderQueue(),
        executionSummary: createExecutionSummary(),
        settings: createSettingsPayload(),
        username,
      });
    },
    screenshotDir: 'artifacts/screens',
    username: 'admin',
    writeDockerSmokeEvidenceFn: async (options) => {
      calls.writeEvidence.push(options);
      return { evidencePath: 'C:/repo/artifacts/provider-acceptance.json' };
    },
  });

  assert.deepEqual(calls.setDefaultTimeout, [15_000]);
  assert.equal(calls.screenshots.length, 2);
  assert.match(calls.screenshots[0].path, /01-login-completed\.png$/u);
  assert.match(calls.screenshots[1].path, /02-provider-acceptance-ui-verified\.png$/u);
  assert.equal(calls.writeEvidence.length, 1);
  assert.equal(calls.writeEvidence[0].validationKind, 'docker-provider-acceptance');
  assert.equal(calls.writeEvidence[0].validationResult.provider.enabled, true);
  assert.doesNotMatch(
    JSON.stringify(calls.writeEvidence[0].validationResult),
    /127\.0\.0\.1|admin|execution-run-1|candidate-1|Provider accepted transfer|C:\/repo/u,
  );
  assert.equal(result.evidencePath, 'C:/repo/artifacts/provider-acceptance.json');
  assert.equal(calls.closeContext, 1);
  assert.equal(calls.closeBrowser, 1);
});

test('runDockerProviderAcceptanceEvidence writes bounded readiness evidence before a strict failure', async () => {
  const calls = {
    closeBrowser: 0,
    closeContext: 0,
    writeEvidence: [],
  };
  const browserContext = {
    close: async () => {
      calls.closeContext += 1;
    },
    newPage: async () => ({
      setDefaultTimeout() {},
    }),
  };
  const browser = {
    close: async () => {
      calls.closeBrowser += 1;
    },
    newContext: async () => browserContext,
  };

  await assert.rejects(
    () => runDockerProviderAcceptanceEvidence({
      baseUrl: 'http://127.0.0.1:49100',
      evidencePath: 'artifacts/provider-acceptance.json',
      launchBrowserFn: async () => browser,
      password: 'BrowserPass123!',
      runProviderAcceptanceBrowserScenarioFn: async ({ baseUrl, username }) => buildProviderAcceptanceEvidenceResult({
        baseUrl,
        downloaderQueue: createDownloaderQueue(),
        executionSummary: createExecutionSummary(),
        settings: createSettingsPayload({
          settings: {
            paths: {
              downloadMappings: [],
              downloads: '/data/downloads',
            },
            slskd: {
              apiKey: 'should-not-appear',
              baseUrl: 'http://slskd:5030',
            },
          },
        }),
        username,
      }),
      username: 'admin',
      writeDockerSmokeEvidenceFn: async (options) => {
        calls.writeEvidence.push(options);
        return { evidencePath: 'C:/repo/artifacts/provider-acceptance.json' };
      },
    }),
    /Set the download path mapping: No download path mapping is configured\..*A local evidence artifact was written\./u,
  );

  assert.equal(calls.writeEvidence.length, 1);
  assert.equal(calls.writeEvidence[0].validationResult.readiness.code, 'download_path_mapping_required');
  assert.doesNotMatch(JSON.stringify(calls.writeEvidence[0]), /should-not-appear|\/data\/downloads/u);
  assert.equal(calls.closeContext, 1);
  assert.equal(calls.closeBrowser, 1);
});
