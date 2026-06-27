import assert from 'node:assert/strict';
import test from 'node:test';

import { runDockerOperatorBrowserSmoke } from '../../scripts/docker-browser-smoke-validation.js';
import {
  resolveDockerBrowserSmokeInputs,
  dockerBrowserSmokeEvidencePathEnvVar,
} from '../../scripts/validate-docker-browser-smoke.js';

test('resolveDockerBrowserSmokeInputs reads defaults and required walkthrough credentials from environment', () => {
  const inputs = resolveDockerBrowserSmokeInputs({
    args: [],
    env: {
      HARMONIARR_WALKTHROUGH_PASSWORD: 'HarmoniarrLocal123!',
      HARMONIARR_WALKTHROUGH_USERNAME: 'walkthrough-admin',
    },
  });

  assert.equal(inputs.baseUrl, 'http://127.0.0.1:47956');
  assert.equal(inputs.username, 'walkthrough-admin');
  assert.equal(inputs.password, 'HarmoniarrLocal123!');
  assert.equal(inputs.timeoutMs, 15_000);
  assert.equal(inputs.headless, true);
  assert.equal(inputs.evidencePath, null);
  assert.equal(inputs.screenshotDir, null);
});

test('resolveDockerBrowserSmokeInputs accepts CLI overrides and dedicated evidence path env', () => {
  const inputs = resolveDockerBrowserSmokeInputs({
    args: [
      '--base-url', 'http://127.0.0.1:49100',
      '--username', 'admin',
      '--password', 'BrowserPass123!',
      '--screenshot-dir', 'artifacts/docker/screenshots',
      '--timeout-ms', '25000',
    ],
    env: {
      [dockerBrowserSmokeEvidencePathEnvVar]: 'artifacts/docker/browser-smoke.json',
      HARMONIARR_DOCKER_BROWSER_SMOKE_HEADLESS: 'false',
      HARMONIARR_WALKTHROUGH_PASSWORD: 'ignored',
      HARMONIARR_WALKTHROUGH_USERNAME: 'ignored',
    },
  });

  assert.deepEqual(inputs, {
    baseUrl: 'http://127.0.0.1:49100',
    evidencePath: 'artifacts/docker/browser-smoke.json',
    headless: false,
    password: 'BrowserPass123!',
    screenshotDir: 'artifacts/docker/screenshots',
    timeoutMs: 25_000,
    username: 'admin',
  });
});

test('runDockerOperatorBrowserSmoke runs scenario and writes evidence', async () => {
  const calls = {
    closeBrowser: 0,
    closeContext: 0,
    launch: 0,
    screenshot: [],
    setDefaultTimeout: [],
    writeEvidence: [],
  };

  const page = {
    screenshot: async (options) => {
      calls.screenshot.push(options);
    },
    setDefaultTimeout: (value) => {
      calls.setDefaultTimeout.push(value);
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

  const result = await runDockerOperatorBrowserSmoke({
    baseUrl: 'http://127.0.0.1:49100',
    evidencePath: 'artifacts/docker/browser-smoke.json',
    launchBrowserFn: async () => {
      calls.launch += 1;
      return browser;
    },
    mkdirFn: async () => {},
    password: 'BrowserPass123!',
    runOperatorBrowserScenarioFn: async ({ baseUrl, password, recordCheckpoint, username }) => {
      assert.equal(baseUrl, 'http://127.0.0.1:49100');
      assert.equal(username, 'admin');
      assert.equal(password, 'BrowserPass123!');
      await recordCheckpoint('login_page_loaded');
      await recordCheckpoint('recovery_loaded');
      return ['login_page_loaded', 'recovery_loaded'];
    },
    screenshotDir: 'artifacts/docker/browser-screenshots',
    username: 'admin',
    writeDockerSmokeEvidenceFn: async (options) => {
      calls.writeEvidence.push(options);
      return { evidencePath: 'C:/repo/artifacts/docker/browser-smoke.json' };
    },
  });

  assert.equal(calls.launch, 1);
  assert.deepEqual(calls.setDefaultTimeout, [15_000]);
  assert.equal(calls.closeContext, 1);
  assert.equal(calls.closeBrowser, 1);
  assert.equal(calls.screenshot.length, 2);
  assert.match(calls.screenshot[0].path, /01-login-page-loaded\.png$/);
  assert.match(calls.screenshot[1].path, /02-recovery-loaded\.png$/);
  assert.equal(calls.writeEvidence.length, 1);
  assert.equal(calls.writeEvidence[0].validationKind, 'browser-operator-smoke');
  assert.deepEqual(calls.writeEvidence[0].validationResult.screenshots.map((screenshot) => screenshot.checkpoint), [
    'login_page_loaded',
    'recovery_loaded',
  ]);
  assert.deepEqual(result.checkpoints, ['login_page_loaded', 'recovery_loaded']);
  assert.equal(result.screenshots.length, 2);
  assert.equal(result.evidencePath, 'C:/repo/artifacts/docker/browser-smoke.json');
});

test('runDockerOperatorBrowserSmoke closes browser resources when scenario fails', async () => {
  const calls = {
    closeBrowser: 0,
    closeContext: 0,
  };

  const page = {
    screenshot: async () => {},
    setDefaultTimeout: () => {},
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

  await assert.rejects(() => runDockerOperatorBrowserSmoke({
    launchBrowserFn: async () => browser,
    password: 'BrowserPass123!',
    runOperatorBrowserScenarioFn: async () => {
      throw new Error('scenario failed');
    },
    username: 'admin',
  }), /scenario failed/);

  assert.equal(calls.closeContext, 1);
  assert.equal(calls.closeBrowser, 1);
});
