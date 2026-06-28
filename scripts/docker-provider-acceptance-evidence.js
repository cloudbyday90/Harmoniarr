/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

import { writeDockerSmokeEvidence } from './docker-smoke-evidence.js';

export const defaultDockerProviderAcceptanceBaseUrl = 'http://127.0.0.1:47956';

const acceptedDiagnosticCodes = new Set([
  'provider_accepted',
  'provider_accepted_with_rejections',
]);

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sanitizeEvidenceFileSegment(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'checkpoint';
}

async function waitForHeading(page, name) {
  await page.getByRole('heading', { name }).waitFor();
}

async function fetchJsonFromApp(page, path) {
  const result = await page.evaluate(async (requestPath) => {
    const response = await fetch(requestPath, {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    });
    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    return {
      ok: response.ok,
      payload,
      status: response.status,
      text,
    };
  }, path);

  if (!result.ok) {
    throw new Error(`GET ${path} failed with status ${result.status}: ${result.text}`);
  }

  return result.payload;
}

function getPayloadValue(payload, key) {
  return payload && typeof payload === 'object' ? payload[key] : null;
}

function normalizeDownloaderPayload(payload) {
  return getPayloadValue(payload, 'downloader') ?? payload ?? {};
}

function getDownloadAcceptanceDiagnostic(item) {
  return item?.planningSnapshot?.execution?.diagnostics?.downloadAcceptance
    ?? item?.diagnostics?.downloadAcceptance
    ?? null;
}

function normalizeCount(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function summarizeProviderState(downloaderQueue) {
  const downloader = normalizeDownloaderPayload(downloaderQueue);
  const queueHealth = downloader.queueHealth ?? {};
  const counts = queueHealth.counts ?? {};

  return {
    enabled: Boolean(downloader.providerState?.enabled),
    queueCounts: {
      active: normalizeCount(counts.active),
      completed: normalizeCount(counts.completed),
      failed: normalizeCount(counts.failed),
      queued: normalizeCount(counts.queued),
      total: normalizeCount(counts.total),
    },
    queueHealthStatus: queueHealth.status ?? 'unknown',
  };
}

function summarizePathMappings(settingsPayload) {
  const settings = settingsPayload?.settings ?? {};
  const mappings = Array.isArray(settings.paths?.downloadMappings)
    ? settings.paths.downloadMappings
    : [];

  return {
    downloadMappingCount: mappings.length,
    downloadMappings: mappings.map((mapping) => ({
      downloadClientPrefix: mapping.slskdPrefix ?? '',
      harmoniarrPrefix: mapping.harmoniarrPrefix ?? '',
    })),
    downloadsRootConfigured: typeof settings.paths?.downloads === 'string' && settings.paths.downloads.trim().length > 0,
    slskdBaseUrlConfigured: typeof settings.slskd?.baseUrl === 'string' && settings.slskd.baseUrl.trim().length > 0,
    slskdSecretConfigured: Boolean(settingsPayload?.secretStatus?.slskd?.apiKeyConfigured),
  };
}

export function summarizeExecutionDiagnostics(executionSummaryPayload) {
  const executionSummary = executionSummaryPayload?.importCandidateExecution ?? {};
  const currentRun = executionSummary.currentRun ?? null;
  const items = Array.isArray(currentRun?.items) ? currentRun.items : [];
  const diagnostics = items
    .map((item) => {
      const diagnostic = getDownloadAcceptanceDiagnostic(item);
      if (!diagnostic) {
        return null;
      }

      const counts = diagnostic.counts ?? {};
      return {
        acceptedTransferCount: normalizeCount(counts.enqueuedTransfers),
        candidateId: item.planningSnapshot?.candidate?.id ?? item.importCandidateId ?? null,
        code: diagnostic.code ?? 'unknown',
        failedFileCount: normalizeCount(counts.failedFiles),
        requestedFileCount: normalizeCount(counts.requestedFiles),
        title: diagnostic.title ?? 'Download acceptance diagnostic',
        tone: diagnostic.tone ?? 'info',
      };
    })
    .filter(Boolean);

  return {
    currentRun: currentRun
      ? {
          id: currentRun.id,
          itemCount: items.length,
          queuedCount: normalizeCount(currentRun.queuedCount ?? currentRun.readyCount),
          queueFailedCount: normalizeCount(currentRun.queueFailedCount),
          requestedCandidateCount: normalizeCount(currentRun.requestedCandidateCount),
          status: currentRun.status ?? 'unknown',
        }
      : null,
    diagnosticCount: diagnostics.length,
    diagnostics,
    summaryStatus: executionSummary.summary?.status ?? executionSummary.status ?? 'unknown',
  };
}

export function buildProviderAcceptanceEvidenceResult({
  baseUrl,
  checkedAt = new Date().toISOString(),
  downloaderQueue,
  executionSummary,
  settings,
  username,
} = {}) {
  const provider = summarizeProviderState(downloaderQueue);
  const importReview = summarizeExecutionDiagnostics(executionSummary);
  const paths = summarizePathMappings(settings);

  return {
    baseUrl,
    checkedAt,
    importReview,
    paths,
    provider,
    username,
  };
}

export function assertProviderAcceptanceEvidenceResult(result, {
  requireAcceptedTransfer = false,
  requireConfiguredProvider = true,
  requireDiagnostic = true,
  requirePathMapping = true,
} = {}) {
  assertCondition(result && typeof result === 'object', 'provider acceptance evidence result must be an object');
  assertCondition(typeof result.baseUrl === 'string' && result.baseUrl.length > 0, 'provider acceptance evidence baseUrl is required');
  assertCondition(typeof result.username === 'string' && result.username.length > 0, 'provider acceptance evidence username is required');

  if (requireConfiguredProvider) {
    assertCondition(result.provider?.enabled === true, 'Expected configured downloader provider to be enabled');
    assertCondition(result.paths?.slskdBaseUrlConfigured === true, 'Expected slskd base URL to be configured');
    assertCondition(result.paths?.slskdSecretConfigured === true, 'Expected slskd API key secret to be configured');
  }

  if (requirePathMapping) {
    assertCondition(
      result.paths?.downloadMappingCount > 0,
      'Expected at least one download path mapping for provider acceptance evidence',
    );
  }

  if (requireDiagnostic) {
    assertCondition(result.importReview?.currentRun, 'Expected an Import Review download run to exist');
    assertCondition(
      result.importReview?.diagnosticCount > 0,
      'Expected at least one Import Review download acceptance diagnostic',
    );
  }

  if (requireAcceptedTransfer) {
    assertCondition(
      result.importReview?.diagnostics?.some((diagnostic) => acceptedDiagnosticCodes.has(diagnostic.code)),
      'Expected at least one provider-accepted download acceptance diagnostic',
    );
  }

  return result;
}

function createNoopCheckpointRecorder() {
  return {
    screenshots: [],
    async record() {},
  };
}

async function createScreenshotCheckpointRecorder({
  mkdirFn = mkdir,
  page,
  screenshotDir,
} = {}) {
  if (typeof screenshotDir !== 'string' || screenshotDir.trim().length === 0) {
    return createNoopCheckpointRecorder();
  }

  const resolvedScreenshotDir = resolve(screenshotDir);
  await mkdirFn(resolvedScreenshotDir, { recursive: true });

  const screenshots = [];

  return {
    screenshots,
    async record(checkpoint) {
      const screenshotPath = resolve(
        resolvedScreenshotDir,
        `${String(screenshots.length + 1).padStart(2, '0')}-${sanitizeEvidenceFileSegment(checkpoint)}.png`,
      );

      await page.screenshot({
        fullPage: true,
        path: screenshotPath,
      });

      screenshots.push({
        checkpoint,
        path: screenshotPath,
      });
    },
  };
}

export async function runProviderAcceptanceBrowserScenario({
  baseUrl,
  page,
  password,
  recordCheckpoint = async () => {},
  requireAcceptedTransfer = false,
  requireConfiguredProvider = true,
  requireDiagnostic = true,
  requirePathMapping = true,
  timeoutMs = 15_000,
  username,
} = {}) {
  const checkpoints = [];

  async function record(checkpoint) {
    checkpoints.push(checkpoint);
    await recordCheckpoint(checkpoint);
  }

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await waitForHeading(page, 'Log in to Harmoniarr');
  await record('login_page_loaded');

  await page.getByLabel('Username or email').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL(/\/app(?:\?.*)?$/);
  await page.getByRole('button', { name: new RegExp(username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u') }).waitFor();
  await record('login_completed');

  const [downloaderQueue, executionSummary, settings] = await Promise.all([
    fetchJsonFromApp(page, '/api/v1/downloader/queue'),
    fetchJsonFromApp(page, '/api/v1/import-candidates/execution-summary'),
    fetchJsonFromApp(page, '/api/v1/settings'),
  ]);
  const result = assertProviderAcceptanceEvidenceResult(buildProviderAcceptanceEvidenceResult({
    baseUrl,
    downloaderQueue,
    executionSummary,
    settings,
    username,
  }), {
    requireAcceptedTransfer,
    requireConfiguredProvider,
    requireDiagnostic,
    requirePathMapping,
  });
  await record('provider_acceptance_api_verified');

  await page.goto(`${baseUrl}/app/activity/candidates`, { waitUntil: 'domcontentloaded' });
  await waitForHeading(page, 'Download candidates');

  const firstDiagnostic = result.importReview.diagnostics[0] ?? null;
  if (firstDiagnostic) {
    await page.getByText('Download acceptance diagnostic', { exact: true }).first().waitFor({ timeout: timeoutMs });
    await page.getByText(firstDiagnostic.title, { exact: true }).first().waitFor({ timeout: timeoutMs });
  }
  await record('provider_acceptance_ui_verified');

  return {
    ...result,
    browser: {
      checkpoints,
    },
  };
}

export function renderDockerProviderAcceptanceSuccessMessage({
  baseUrl,
  evidencePath,
  importReview,
  provider,
  username,
} = {}) {
  const diagnosticCodes = importReview?.diagnostics?.map((diagnostic) => diagnostic.code).join(', ') || 'none';
  const evidenceSummary = evidencePath ? `; evidence ${evidencePath}` : '';
  return `Docker provider acceptance evidence passed for ${username} on ${baseUrl} (provider ${provider?.queueHealthStatus ?? 'unknown'}; diagnostics ${diagnosticCodes}${evidenceSummary})`;
}

export async function runDockerProviderAcceptanceEvidence({
  baseUrl = defaultDockerProviderAcceptanceBaseUrl,
  evidencePath = null,
  headless = true,
  launchBrowserFn,
  mkdirFn = mkdir,
  password,
  requireAcceptedTransfer = false,
  requireConfiguredProvider = true,
  requireDiagnostic = true,
  requirePathMapping = true,
  runProviderAcceptanceBrowserScenarioFn = runProviderAcceptanceBrowserScenario,
  screenshotDir = null,
  timeoutMs = 15_000,
  username,
  writeDockerSmokeEvidenceFn = writeDockerSmokeEvidence,
} = {}) {
  if (typeof username !== 'string' || username.trim().length === 0) {
    throw new Error('username is required');
  }

  if (typeof password !== 'string' || password.trim().length === 0) {
    throw new Error('password is required');
  }

  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('timeoutMs must be a positive integer');
  }

  const openBrowser = launchBrowserFn ?? (() => chromium.launch({ headless }));
  const browser = await openBrowser();
  const browserContext = await browser.newContext();
  const page = await browserContext.newPage();
  page.setDefaultTimeout(timeoutMs);

  try {
    const checkpointRecorder = await createScreenshotCheckpointRecorder({
      mkdirFn,
      page,
      screenshotDir,
    });
    const validationResult = await runProviderAcceptanceBrowserScenarioFn({
      baseUrl,
      page,
      password,
      recordCheckpoint: checkpointRecorder.record,
      requireAcceptedTransfer,
      requireConfiguredProvider,
      requireDiagnostic,
      requirePathMapping,
      timeoutMs,
      username,
    });

    const resultWithScreenshots = {
      ...validationResult,
      browser: {
        ...validationResult.browser,
        screenshots: checkpointRecorder.screenshots,
      },
    };

    const evidence = await writeDockerSmokeEvidenceFn({
      evidencePath,
      validationKind: 'docker-provider-acceptance',
      validationResult: resultWithScreenshots,
    });

    return {
      ...resultWithScreenshots,
      evidencePath: evidence?.evidencePath ?? null,
    };
  } finally {
    await browserContext.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
