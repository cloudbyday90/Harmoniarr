/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateVapidKeyPair } from '../src/server/push/vapid-keys.js';
import { runBufferedCommand } from './process-runtime.js';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const composeFilePath = resolve(rootDir, 'compose.yaml');
const overlayFilePath = resolve(rootDir, 'compose.controlled-provider-fixture.yaml');
const verifierPath = resolve(rootDir, 'testing/docker/controlled-provider-pipeline-verifier.mjs');
const catalogPath = resolve(rootDir, 'testing/docker/controlled-provider-fixture-catalog.mjs');
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
  const directories = Object.fromEntries(['appData', 'downloads', 'music', 'staging', 'transcodeTemp'].map((name) => [name, resolve(baseDir, name)]));
  await Promise.all(Object.values(directories).map((directory) => mkdir(directory, { mode: 0o700, recursive: true })));
  return directories;
}

async function runCompose({ args, composeArgs, env, timeoutMs }) {
  return runBufferedCommand({ args: [...composeArgs, ...args], command: 'docker', cwd: rootDir, env, timeoutMs });
}

function buildEnvironment({ appPort, directories, imageRef, processEnv, providerApiKey, vapidKeys }) {
  const environment = { ...processEnv };
  delete environment.HARMONIARR_IMAGE;
  return {
    ...environment,
    APP_PORT: '3000',
    CONTROLLED_PROVIDER_API_KEY: providerApiKey,
    HARMONIARR_APPDATA: directories.appData,
    HARMONIARR_CONTACT_EMAIL: 'controlled-provider-validation@harmoniarr.local',
    HARMONIARR_CONTACT_URL: 'https://harmoniarr.local/controlled-provider-validation',
    HARMONIARR_DOWNLOADS: directories.downloads,
    HARMONIARR_IMAGE: imageRef,
    HARMONIARR_MUSIC: directories.music,
    HARMONIARR_PORT: String(appPort),
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
  ].join('; ');
  await runCompose({ args: ['exec', '-T', 'harmoniarr', 'sh', '-ec', command], composeArgs, env, timeoutMs: 30_000 });
}

async function copyAndRunVerifier({ composeArgs, env }) {
  const [catalog, verifier] = await Promise.all([readFile(catalogPath), readFile(verifierPath)]);
  const files = [
    ['/tmp/controlled-provider-fixture-catalog.mjs', catalog],
    ['/tmp/controlled-provider-pipeline-verifier.mjs', verifier],
  ];
  for (const [targetPath, contents] of files) {
    const program = `import { writeFile } from 'node:fs/promises'; await writeFile('${targetPath}', Buffer.from('${contents.toString('base64')}', 'base64'), { mode: 0o600 });`;
    await runCompose({ args: ['exec', '-T', 'harmoniarr', 'node', '--input-type=module', '--eval', program], composeArgs, env, timeoutMs: 20_000 });
  }
  const result = await runCompose({ args: ['exec', '-T', 'harmoniarr', 'node', '/tmp/controlled-provider-pipeline-verifier.mjs'], composeArgs, env, timeoutMs: 90_000 });
  const payload = result.stdout.trim().split(/\r?\n/u).filter(Boolean).at(-1);
  if (!payload) throw new Error('Controlled-provider verifier did not produce a result');
  const parsed = JSON.parse(payload);
  if (parsed?.pipeline?.finalStatus !== 'applied' || parsed.catalogFixtures !== 15) throw new Error('Controlled-provider verifier returned incomplete evidence');
  return parsed;
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
  const directories = await createWorkspace(workspaceRoot);
  const appPort = await getAvailablePort();
  const vapidKeys = generateVapidKeyPair();
  const providerApiKey = randomBytes(32).toString('base64url');
  const effectiveImageRef = imageRef ?? `harmoniarr:controlled-provider-${projectName}`;
  const env = buildEnvironment({ appPort, directories, imageRef: effectiveImageRef, processEnv, providerApiKey, vapidKeys });
  const composeArgs = ['compose', '-f', composeFilePath, '-f', overlayFilePath, '-p', projectName];

  try {
    if (buildImage) {
      await runCompose({ args: ['build', ...(noCache ? ['--no-cache'] : []), 'harmoniarr'], composeArgs, env, timeoutMs: 300_000 });
    }
    await runCompose({ args: ['up', buildImage ? '--no-build' : '--no-build', '--detach', '--wait', '--wait-timeout', String(startupTimeoutSeconds)], composeArgs, env, timeoutMs: (startupTimeoutSeconds + 30) * 1000 });
    await waitForHealth({ port: appPort, timeoutMs: startupTimeoutSeconds * 1000 });
    await generateFixtureAudio({ composeArgs, env });
    const result = await copyAndRunVerifier({ composeArgs, env });
    return { ...result, projectName };
  } finally {
    try {
      await runCompose({ args: ['down', '--volumes', '--remove-orphans'], composeArgs, env, timeoutMs: 60_000 });
    } finally {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  }
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
