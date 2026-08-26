/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateVapidKeyPair } from '../src/server/push/vapid-keys.js';
import { assertControlledProviderPipelineEvidence } from './controlled-provider-pipeline-evidence.js';
import { writeControlledProviderApiKeySecret } from './controlled-provider-validation-secret.js';
import { createRedactedDockerValidationError } from './docker-validation-redaction.js';
import { runBufferedCommand } from './process-runtime.js';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const composeFilePath = resolve(rootDir, 'compose.yaml');
const overlayFilePath = resolve(rootDir, 'compose.controlled-provider-fixture.yaml');
const defaultStartupTimeoutSeconds = 180;

function createProjectName() {
  return `harmoniarrcontrolled${Date.now()}`;
}

function parsePositiveInteger(value, fieldName, fallback) {
  if (value == null || String(value).trim() === '') return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${fieldName} must be a positive integer`);
  return parsed;
}

async function getAvailablePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : null;
  server.close();
  await once(server, 'close');
  if (!Number.isInteger(port)) throw new Error('Unable to allocate a Docker controlled-provider validation port');
  return port;
}

async function createWorkspace(baseDir) {
  const directories = Object.fromEntries(['appData', 'downloads', 'music', 'secrets', 'staging', 'transcodeTemp'].map((name) => [name, resolve(baseDir, name)]));
  await Promise.all(Object.values(directories).map((directory) => mkdir(directory, { mode: 0o700, recursive: true })));
  return directories;
}

async function runCompose({ args, composeArgs, env, timeoutMs }) {
  return runBufferedCommand({ args: [...composeArgs, ...args], command: 'docker', cwd: rootDir, env, timeoutMs });
}

async function collectComposeLogs({ composeArgs, env }) {
  try {
    const result = await runCompose({
      args: ['logs', '--no-color', '--tail', '200'],
      composeArgs,
      env,
      timeoutMs: 30_000,
    });
    return result.stdout.trim();
  } catch {
    return '';
  }
}

function buildEnvironment({
  appPort,
  directories,
  imageRef,
  processEnv,
  providerApiKeySecretPath,
  vapidKeys,
}) {
  const environment = { ...processEnv };
  delete environment.HARMONIARR_IMAGE;
  return {
    ...environment,
    APP_PORT: '3000',
    HARMONIARR_APPDATA: directories.appData,
    HARMONIARR_CONTACT_EMAIL: 'controlled-provider-validation@harmoniarr.local',
    HARMONIARR_CONTACT_URL: 'https://harmoniarr.local/controlled-provider-validation',
    HARMONIARR_DOWNLOADS: directories.downloads,
    HARMONIARR_IMAGE: imageRef,
    HARMONIARR_MUSIC: directories.music,
    HARMONIARR_PORT: String(appPort),
    HARMONIARR_CONTROLLED_PROVIDER_SECRET_FILE: providerApiKeySecretPath,
    HARMONIARR_STAGING: directories.staging,
    HARMONIARR_TRANSCODE_TEMP: directories.transcodeTemp,
    PGID: '1000',
    PUID: '1000',
    VAPID_CONTACT: 'mailto:controlled-provider-validation@harmoniarr.local',
    VAPID_PRIVATE_KEY: vapidKeys.privateKey,
    VAPID_PUBLIC_KEY: vapidKeys.publicKey,
  };
}

async function waitForHealth({ port, timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (response.ok && (await response.json())?.ok === true) return;
      lastError = new Error(`Harmoniarr health returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => {
      setTimeout(resolveDelay, 250);
    });
  }
  throw new Error(`Controlled-provider validation did not become healthy: ${lastError?.message ?? 'unknown error'}`);
}

async function generateFixtureAudio({ composeArgs, env }) {
  const command = [
    'set -eu',
    'mkdir -p /data/downloads/controlled-provider-fixtures',
    "ffmpeg -y -f lavfi -i 'aevalsrc=0.2*sin(2*PI*21000*t)+0.2*sin(2*PI*1000*t):s=44100:d=3' -c:a flac /data/downloads/controlled-provider-fixtures/track-01.flac >/dev/null 2>&1",
    "ffmpeg -y -f lavfi -i 'aevalsrc=0.2*sin(2*PI*21000*t)+0.2*sin(2*PI*800*t):s=44100:d=3' -c:a flac /data/downloads/controlled-provider-fixtures/track-02.flac >/dev/null 2>&1",
    "ffmpeg -y -f lavfi -i 'aevalsrc=0.2*sin(2*PI*21000*t)+0.2*sin(2*PI*700*t):s=44100:d=3' -c:a flac /data/downloads/controlled-provider-fixtures/track-11-fallback.flac >/dev/null 2>&1",
    "ffmpeg -y -f lavfi -i 'aevalsrc=0.2*sin(2*PI*21000*t)+0.2*sin(2*PI*500*t):s=44100:d=3' -c:a flac /data/downloads/controlled-provider-fixtures/track-12.flac >/dev/null 2>&1",
    "ffmpeg -y -f lavfi -i 'aevalsrc=0.2*sin(2*PI*21000*t)+0.2*sin(2*PI*300*t):s=44100:d=3' -c:a flac /data/downloads/controlled-provider-fixtures/track-12-fallback.flac >/dev/null 2>&1",
    "ffmpeg -y -f lavfi -i 'aevalsrc=0.2*sin(2*PI*12000*t)+0.2*sin(2*PI*900*t):s=44100:d=3' -c:a flac /data/downloads/controlled-provider-fixtures/track-13.flac >/dev/null 2>&1",
    "ffmpeg -y -f lavfi -i 'aevalsrc=0.2*sin(2*PI*21000*t)+0.2*sin(2*PI*1100*t):s=44100:d=3' -c:a flac /data/downloads/controlled-provider-fixtures/track-13-fallback.flac >/dev/null 2>&1",
    "ffmpeg -y -f lavfi -i 'aevalsrc=0.2*sin(2*PI*12000*t)+0.2*sin(2*PI*1200*t):s=44100:d=3' -c:a flac /data/downloads/controlled-provider-fixtures/track-14.flac >/dev/null 2>&1",
    "ffmpeg -y -f lavfi -i 'aevalsrc=0.2*sin(2*PI*21000*t)+0.2*sin(2*PI*600*t):s=44100:d=3' -c:a flac /data/downloads/controlled-provider-fixtures/track-16-fallback.flac >/dev/null 2>&1",
    "ffmpeg -y -f lavfi -i 'aevalsrc=0.2*sin(2*PI*21000*t)+0.2*sin(2*PI*400*t):s=44100:d=3' -c:a flac /data/downloads/controlled-provider-fixtures/track-17.flac >/dev/null 2>&1",
  ].join('; ');
  await runCompose({ args: ['exec', '-T', 'harmoniarr', 'sh', '-ec', command], composeArgs, env, timeoutMs: 30_000 });
}

async function copyAndRunVerifier({ composeArgs, env }) {
  const result = await runCompose({
    args: ['exec', '-T', 'harmoniarr', 'node', '/validation/controlled-provider-pipeline-verifier.mjs'],
    composeArgs,
    env,
    timeoutMs: 180_000,
  });
  const payload = result.stdout.trim().split(/\r?\n/u).filter(Boolean).at(-1);
  if (!payload) throw new Error('Controlled-provider verifier did not produce a result');
  return assertControlledProviderPipelineEvidence(JSON.parse(payload));
}

export async function runDockerControlledProviderPipelineValidation({
  buildImage = true,
  noCache = false,
  imageRef = null,
  processEnv = process.env,
  projectName = createProjectName(),
  startupTimeoutSeconds = defaultStartupTimeoutSeconds,
} = {}) {
  const workspaceRoot = await mkdtemp(resolve(tmpdir(), 'harmoniarr-controlled-provider-validation-'));
  const composeArgs = ['compose', '-f', composeFilePath, '-f', overlayFilePath, '-p', projectName];
  let directories = null;
  let env = null;
  let providerApiKey = null;
  let providerApiKeySecretPath = null;
  let vapidKeys = null;
  let result = null;
  let validationError = null;

  const getSensitivePaths = () => [
    workspaceRoot,
    providerApiKeySecretPath,
    ...Object.values(directories ?? {}),
  ];
  const getSensitiveValues = () => [
    providerApiKey,
    vapidKeys?.privateKey,
    vapidKeys?.publicKey,
  ];

  try {
    directories = await createWorkspace(workspaceRoot);
    const appPort = await getAvailablePort();
    vapidKeys = generateVapidKeyPair();
    providerApiKey = randomBytes(32).toString('base64url');
    providerApiKeySecretPath = await writeControlledProviderApiKeySecret({
      apiKey: providerApiKey,
      secretDirectory: directories.secrets,
    });
    const effectiveImageRef = imageRef ?? `harmoniarr:controlled-provider-${projectName}`;
    env = buildEnvironment({
      appPort,
      directories,
      imageRef: effectiveImageRef,
      processEnv,
      providerApiKeySecretPath,
      vapidKeys,
    });
    if (buildImage) {
      await runCompose({ args: ['build', ...(noCache ? ['--no-cache'] : []), 'harmoniarr'], composeArgs, env, timeoutMs: 300_000 });
    }
    await runCompose({ args: ['up', buildImage ? '--no-build' : '--no-build', '--detach', '--wait', '--wait-timeout', String(startupTimeoutSeconds)], composeArgs, env, timeoutMs: (startupTimeoutSeconds + 30) * 1000 });
    await waitForHealth({ port: appPort, timeoutMs: startupTimeoutSeconds * 1000 });
    await generateFixtureAudio({ composeArgs, env });
    result = await copyAndRunVerifier({ composeArgs, env });
  } catch (error) {
    validationError = error;
  }

  const logs = validationError && env
    ? await collectComposeLogs({ composeArgs, env })
    : null;
  let cleanupError = null;

  if (env) {
    try {
      await runCompose({ args: ['down', '--volumes', '--remove-orphans'], composeArgs, env, timeoutMs: 60_000 });
    } catch (error) {
      cleanupError = error;
    }
  }

  try {
    await rm(workspaceRoot, { force: true, recursive: true });
  } catch (error) {
    cleanupError ??= error;
  }

  if (validationError) {
    throw createRedactedDockerValidationError({
      error: validationError,
      logLabel: 'Controlled-provider Compose logs',
      logs,
      sensitivePaths: getSensitivePaths(),
      sensitiveValues: getSensitiveValues(),
    });
  }

  if (cleanupError) {
    throw createRedactedDockerValidationError({
      error: cleanupError,
      sensitivePaths: getSensitivePaths(),
      sensitiveValues: getSensitiveValues(),
    });
  }

  return { ...result, projectName };
}

export function resolveDockerControlledProviderPipelineValidationInputs({ args = process.argv.slice(2), env = process.env } = {}) {
  const allowed = new Set(['--no-build', '--no-cache']);
  if (args.some((arg) => !allowed.has(arg))) throw new Error('Usage: node scripts/validate-docker-controlled-provider-pipeline.js [--no-build] [--no-cache]');
  const buildImage = !args.includes('--no-build');
  const imageRef = env.HARMONIARR_CONTROLLED_PROVIDER_VALIDATION_IMAGE ?? null;
  if (!buildImage && !imageRef) throw new Error('--no-build requires HARMONIARR_CONTROLLED_PROVIDER_VALIDATION_IMAGE to name a locally available image');
  return {
    buildImage,
    imageRef,
    noCache: args.includes('--no-cache'),
    startupTimeoutSeconds: parsePositiveInteger(env.HARMONIARR_CONTROLLED_PROVIDER_VALIDATION_STARTUP_TIMEOUT_SECONDS, 'HARMONIARR_CONTROLLED_PROVIDER_VALIDATION_STARTUP_TIMEOUT_SECONDS', defaultStartupTimeoutSeconds),
  };
}
