import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertProviderAcceptanceEvidenceResult,
  buildProviderAcceptanceEvidenceResult,
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

test('buildProviderAcceptanceEvidenceResult redacts provider secrets and includes path mapping evidence', () => {
  const result = buildProviderAcceptanceEvidenceResult({
    baseUrl: 'http://127.0.0.1:47956',
    downloaderQueue: createDownloaderQueue(),
    executionSummary: createExecutionSummary(),
    settings: createSettingsPayload(),
    username: 'walkthrough-admin',
  });

  assert.equal(result.provider.enabled, true);
  assert.equal(result.paths.slskdSecretConfigured, true);
  assert.deepEqual(result.paths.downloadMappings, [{
    downloadClientPrefix: '/downloads/complete/Music',
    harmoniarrPrefix: '/data/downloads/complete',
  }]);
  assert.doesNotMatch(JSON.stringify(result), /should-not-appear/u);
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
    /Expected at least one Import Review download acceptance diagnostic/u,
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
    /Expected at least one provider-accepted download acceptance diagnostic/u,
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

test('resolveDockerProviderAcceptanceInputs reads walkthrough defaults and strict evidence options', () => {
  const inputs = resolveDockerProviderAcceptanceInputs({
    args: ['--require-accepted-transfer', 'true', '--timeout-ms', '25000'],
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
    requirePathMapping: true,
    screenshotDir: 'artifacts/screens',
    timeoutMs: 25_000,
    username: 'walkthrough-admin',
  });
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
  assert.equal(result.evidencePath, 'C:/repo/artifacts/provider-acceptance.json');
  assert.equal(calls.closeContext, 1);
  assert.equal(calls.closeBrowser, 1);
});
