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
  await waitForHeading(page, 'Download candidates');
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
