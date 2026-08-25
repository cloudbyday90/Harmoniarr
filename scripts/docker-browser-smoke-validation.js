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

export const defaultDockerBrowserSmokeBaseUrl = 'http://127.0.0.1:47956';
const downloaderProviderSetupObservationMs = 5_500;
const providerSetupRetryIntervalMs = 250;

async function waitForHeading(page, name) {
  await page.getByRole('heading', { name }).waitFor();
}

function sanitizeEvidenceFileSegment(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'checkpoint';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getResponsePayloadValue(payload, key) {
  return payload && typeof payload === 'object' ? payload[key] : null;
}

function normalizeDownloaderPayload(payload) {
  return getResponsePayloadValue(payload, 'downloader') ?? payload;
}

function getDiscoveryHeartbeat(overview) {
  const heartbeats = Array.isArray(overview?.heartbeats) ? overview.heartbeats : [];
  return heartbeats.find((heartbeat) => heartbeat?.key === 'libraryDiscovery') ?? null;
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

async function waitForDiscoverySetupRequired(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let latestOverview = null;

  while (Date.now() <= deadline) {
    latestOverview = await fetchJsonFromApp(page, '/api/v1/system/overview');
    const heartbeat = getDiscoveryHeartbeat(latestOverview);
    if (heartbeat?.status === 'setup_required') {
      return latestOverview;
    }
    await page.waitForTimeout(providerSetupRetryIntervalMs);
  }

  const latestStatus = getDiscoveryHeartbeat(latestOverview)?.status ?? 'missing';
  throw new Error(`Discovery dispatch heartbeat did not reach setup_required; latest status was ${latestStatus}`);
}

export function assertUnconfiguredProviderSetupPayloads({
  downloaderQueue,
  notifications,
  overview,
} = {}) {
  const normalizedDownloaderQueue = normalizeDownloaderPayload(downloaderQueue);
  const discoveryHeartbeat = getDiscoveryHeartbeat(overview);
  const notificationList = Array.isArray(notifications?.notifications) ? notifications.notifications : [];
  const noisyNotifications = notificationList.filter((notification) => {
    const title = String(notification?.title ?? '');
    const message = String(notification?.message ?? '');
    return /Library discovery failed|Metadata artist refresh failed/u.test(`${title} ${message}`);
  });

  assertCondition(
    notifications?.counts?.total === 0,
    `Expected no operator notifications on unconfigured provider startup, received ${notifications?.counts?.total ?? 'unknown'}`,
  );
  assertCondition(
    notifications?.counts?.unacknowledged === 0,
    `Expected no unread operator notifications on unconfigured provider startup, received ${notifications?.counts?.unacknowledged ?? 'unknown'}`,
  );
  assertCondition(
    noisyNotifications.length === 0,
    `Expected no discovery or metadata refresh alert noise, received ${noisyNotifications.length}`,
  );
  assertCondition(
    discoveryHeartbeat?.status === 'setup_required',
    `Expected Discovery dispatch heartbeat to be setup_required, received ${discoveryHeartbeat?.status ?? 'missing'}`,
  );
  assertCondition(
    /Configure Soulseek \(slskd\)/u.test(discoveryHeartbeat?.message ?? ''),
    'Expected Discovery dispatch heartbeat to provide slskd setup guidance',
  );
  assertCondition(
    normalizedDownloaderQueue?.providerState?.enabled === false,
    'Expected downloader providerState.enabled to be false when slskd is unconfigured',
  );
  assertCondition(
    normalizedDownloaderQueue?.queueHealth?.status === 'disabled',
    `Expected downloader queueHealth.status disabled, received ${normalizedDownloaderQueue?.queueHealth?.status ?? 'missing'}`,
  );
  assertCondition(
    Array.isArray(normalizedDownloaderQueue?.transfers) && normalizedDownloaderQueue.transfers.length === 0,
    'Expected disabled downloader queue to expose an empty transfer list',
  );

  return {
    discoveryHeartbeatStatus: discoveryHeartbeat.status,
    downloaderStatus: normalizedDownloaderQueue.queueHealth.status,
    notificationCount: notifications.counts.total,
  };
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

export async function runOperatorBrowserScenario({
  baseUrl,
  page,
  password,
  recordCheckpoint = async () => {},
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
  await page.getByRole('button', { name: new RegExp(escapeRegExp(username), 'u') }).waitFor();
  await record('login_completed');

  const downloaderQueueResponses = [];
  const recordDownloaderQueueResponse = (response) => {
    if (response.url().includes('/api/v1/downloader/queue')) {
      downloaderQueueResponses.push({
        status: response.status(),
        url: response.url(),
      });
    }
  };

  const overview = await waitForDiscoverySetupRequired(page, timeoutMs);
  const notifications = await fetchJsonFromApp(page, '/api/v1/system/operator-notifications?limit=25');
  const downloaderQueue = await fetchJsonFromApp(page, '/api/v1/downloader/queue');
  assertUnconfiguredProviderSetupPayloads({
    downloaderQueue,
    notifications,
    overview,
  });
  await record('provider_setup_state_verified');

  page.on('response', recordDownloaderQueueResponse);
  try {
    await page.getByRole('link', { name: 'Downloader' }).click();
    await page.waitForURL(/\/app\/downloader(?:\?.*)?(?:#.*)?$/);
    await waitForHeading(page, 'Downloader');
    await page.getByText('Set up Soulseek to enable downloads').waitFor();
    await page.getByText('Add your Soulseek download client URL and slskd API key in Settings.').waitFor();
    await page.getByRole('link', { name: 'Configure slskd' }).waitFor();
    await page.waitForTimeout(downloaderProviderSetupObservationMs);
  } finally {
    page.off('response', recordDownloaderQueueResponse);
  }

  assertCondition(
    downloaderQueueResponses.length === 1,
    `Expected exactly one downloader queue read while provider is disabled, received ${downloaderQueueResponses.length}`,
  );
  assertCondition(
    downloaderQueueResponses.every((response) => response.status >= 200 && response.status < 400),
    'Expected disabled downloader queue read to complete without provider errors',
  );
  await record('downloader_setup_state_loaded');

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.waitForURL(/\/app\/settings(?:\?.*)?(?:#.*)?$/);
  await waitForHeading(page, 'Settings');
  await record('settings_loaded');

  await page.getByRole('link', { name: 'Activity' }).click();
  await page.waitForURL(/\/app\/activity(?:\/operations)?(?:\?.*)?(?:#.*)?$/);
  await waitForHeading(page, 'Activity');
  await waitForHeading(page, 'Background Jobs');
  await record('operations_loaded');

  await page.getByRole('link', { name: 'Candidates' }).click();
  await page.waitForURL(/\/app\/activity\/candidates(?:\?.*)?(?:#.*)?$/);
  await waitForHeading(page, 'Match diagnostics');
  await record('candidates_loaded');

  await page.getByRole('link', { name: 'Settings' }).click();
  await page.waitForURL(/\/app\/settings(?:\?.*)?(?:#.*)?$/);
  await page.getByRole('link', { name: 'Backup & Restore' }).click();
  await page.waitForURL(/\/app\/settings\/recovery(?:\?.*)?(?:#.*)?$/);
  await waitForHeading(page, 'Backups');
  await record('recovery_loaded');

  await page.getByRole('button', { name: 'Create backup' }).click();
  await page.getByRole('link', { name: 'Download' }).waitFor();
  await page.getByText('This backup passed all checks and can be applied.').waitFor();
  await record('backup_preview_ready');

  return checkpoints;
}

export function renderDockerBrowserSmokeSuccessMessage({
  baseUrl,
  checkpoints,
  evidencePath,
  username,
} = {}) {
  const checkpointSummary = Array.isArray(checkpoints) && checkpoints.length > 0
    ? checkpoints.join(', ')
    : 'no checkpoints recorded';
  const evidenceSummary = evidencePath ? `; evidence ${evidencePath}` : '';
  return `Docker browser smoke passed for ${username} on ${baseUrl} (${checkpointSummary}${evidenceSummary})`;
}

export async function runDockerOperatorBrowserSmoke({
  baseUrl = defaultDockerBrowserSmokeBaseUrl,
  evidencePath = null,
  headless = true,
  launchBrowserFn,
  mkdirFn = mkdir,
  password,
  runOperatorBrowserScenarioFn = runOperatorBrowserScenario,
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
    const checkpoints = await runOperatorBrowserScenarioFn({
      baseUrl,
      page,
      password,
      recordCheckpoint: checkpointRecorder.record,
      timeoutMs,
      username,
    });

    const validationResult = {
      baseUrl,
      checkedAt: new Date().toISOString(),
      checkpoints,
      screenshots: checkpointRecorder.screenshots,
      username,
    };

    const evidence = await writeDockerSmokeEvidenceFn({
      evidencePath,
      validationKind: 'browser-operator-smoke',
      validationResult,
    });

    return {
      ...validationResult,
      evidencePath: evidence?.evidencePath ?? null,
    };
  } finally {
    await browserContext.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
