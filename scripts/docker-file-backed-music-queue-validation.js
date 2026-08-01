/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateVapidKeyPair } from '../src/server/push/vapid-keys.js';
import { runBufferedCommand } from './process-runtime.js';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const verifierPath = resolve(rootDir, 'testing/docker/file-backed-music-queue-verifier.mjs');
const verifierContainerPath = '/data/staging/file-backed-music-queue-verifier.mjs';
const defaultStartupTimeoutSeconds = 180;

function createProjectName(prefix = 'harmoniarrfilebacked') {
  return `${prefix}${Date.now()}`;
}

function parsePositiveInteger(value, fieldName, defaultValue) {
  if (value == null || String(value).trim() === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
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

  if (!Number.isInteger(port)) {
    throw new Error('Unable to allocate a host port for Docker file-backed validation');
  }
  return port;
}

async function createWorkspaceLayout(baseDir) {
  const directories = {
    appData: resolve(baseDir, 'appdata'),
    downloads: resolve(baseDir, 'downloads'),
    music: resolve(baseDir, 'music'),
    staging: resolve(baseDir, 'staging'),
    transcodeTemp: resolve(baseDir, 'transcode-temp'),
  };
  await Promise.all(Object.values(directories).map((directory) => mkdir(directory, {
    mode: 0o700,
    recursive: true,
  })));
  return directories;
}

async function runDocker({ args, env, timeoutMs }) {
  return runBufferedCommand({
    args,
    command: 'docker',
    cwd: rootDir,
    env,
    timeoutMs,
  });
}

async function runCompose({ args, composeArgs, env, timeoutMs }) {
  return runDocker({
    args: [...composeArgs, ...args],
    env,
    timeoutMs,
  });
}

function buildEnvironment({ appPort, directories, imageRef, processEnv, vapidKeys }) {
  const environment = { ...processEnv };
  delete environment.HARMONIARR_IMAGE;

  return {
    ...environment,
    APP_PORT: '3000',
    HARMONIARR_APPDATA: directories.appData,
    HARMONIARR_CONTACT_EMAIL: 'file-backed-validation@harmoniarr.local',
    HARMONIARR_CONTACT_URL: 'https://harmoniarr.local/file-backed-validation',
    HARMONIARR_DOWNLOADS: directories.downloads,
    HARMONIARR_IMAGE: imageRef,
    HARMONIARR_MUSIC: directories.music,
    HARMONIARR_PORT: String(appPort),
    HARMONIARR_STAGING: directories.staging,
    HARMONIARR_TRANSCODE_TEMP: directories.transcodeTemp,
    PGID: '1000',
    PUID: '1000',
    VAPID_CONTACT: 'mailto:file-backed-validation@harmoniarr.local',
    VAPID_PRIVATE_KEY: vapidKeys.privateKey,
    VAPID_PUBLIC_KEY: vapidKeys.publicKey,
  };
}

async function waitForHealth({ fetchFn, port, timeoutMs }) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetchFn(`http://127.0.0.1:${port}/healthz`);
      if (response.ok && (await response.json())?.ok === true) {
        return;
      }
      lastError = new Error(`Health endpoint returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveDelay) => {
      setTimeout(resolveDelay, 250);
    });
  }

  throw new Error(`Docker file-backed validation did not become healthy: ${lastError?.message ?? 'unknown error'}`);
}

function parseVerifierResult(stdout) {
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
  const payload = lines.at(-1);
  if (!payload) {
    throw new Error('Docker file-backed verifier did not produce a result');
  }

  try {
    const result = JSON.parse(payload);
    if (!result?.authentic?.candidateId
      || !result?.transcoded?.candidateId
      || !result?.collision?.candidateId
      || !result?.recovered?.candidateId
      || !result?.toolingRecovery?.candidateId) {
      throw new Error('candidate IDs are missing');
    }
    return result;
  } catch {
    throw new Error('Docker file-backed verifier returned invalid JSON');
  }
}

async function getContainerId({ composeArgs, env }) {
  const result = await runCompose({
    args: ['ps', '-q', '--all', 'harmoniarr'],
    composeArgs,
    env,
    timeoutMs: 20_000,
  });
  const containerId = result.stdout.trim();
  if (!containerId) {
    throw new Error('Docker file-backed validation could not resolve the Harmoniarr container');
  }
  return containerId;
}

async function generateFixtures({ composeArgs, env }) {
  const fixtureCommand = [
    'set -eu',
    'mkdir -p /data/downloads/docker-file-backed-authentic /data/downloads/docker-file-backed-transcoded /data/downloads/docker-file-backed-collision /data/downloads/docker-file-backed-tooling-recovery /data/downloads/complete/docker-file-backed-folder-recovery /data/downloads/complete/docker-file-backed-unrelated',
    "ffmpeg -y -f lavfi -i 'aevalsrc=0.2*sin(2*PI*21000*t)+0.2*sin(2*PI*1000*t):s=44100:d=5' -c:a flac /data/downloads/docker-file-backed-authentic/verified.flac >/dev/null 2>&1",
    'ffmpeg -y -i /data/downloads/docker-file-backed-authentic/verified.flac -c:a libmp3lame -b:a 128k /tmp/docker-file-backed-lossy.mp3 >/dev/null 2>&1',
    'ffmpeg -y -i /tmp/docker-file-backed-lossy.mp3 -c:a flac /data/downloads/docker-file-backed-transcoded/disguised.flac >/dev/null 2>&1',
    'cp /data/downloads/docker-file-backed-authentic/verified.flac /data/downloads/docker-file-backed-collision/collision.flac',
    'cp /data/downloads/docker-file-backed-authentic/verified.flac /data/downloads/docker-file-backed-tooling-recovery/tooling-recovery.flac',
    'cp /data/downloads/docker-file-backed-authentic/verified.flac /data/downloads/complete/docker-file-backed-folder-recovery/recovered.flac',
    'cp /data/downloads/docker-file-backed-authentic/verified.flac /data/downloads/complete/docker-file-backed-unrelated/unrelated.flac',
  ].join('; ');

  await runCompose({
    args: ['exec', '-T', 'harmoniarr', 'sh', '-ec', fixtureCommand],
    composeArgs,
    env,
    timeoutMs: 30_000,
  });
}

async function copyAndRunVerifier({ composeArgs, env }) {
  const containerId = await getContainerId({ composeArgs, env });
  await runDocker({
    args: ['cp', verifierPath, `${containerId}:${verifierContainerPath}`],
    env,
    timeoutMs: 20_000,
  });
  const result = await runCompose({
    args: ['exec', '-T', 'harmoniarr', 'node', verifierContainerPath],
    composeArgs,
    env,
    timeoutMs: 60_000,
  });
  return parseVerifierResult(result.stdout);
}

async function stopProject({ composeArgs, env }) {
  await runCompose({
    args: ['down', '--volumes', '--remove-orphans'],
    composeArgs,
    env,
    timeoutMs: 60_000,
  });
}

export async function runDockerFileBackedMusicQueueValidation({
  buildImage = true,
  composeFilePath = resolve(rootDir, 'compose.yaml'),
  fetchFn = fetch,
  imageRef = null,
  processEnv = process.env,
  projectName = createProjectName(),
  startupTimeoutSeconds = defaultStartupTimeoutSeconds,
} = {}) {
  const workspaceRoot = await mkdtemp(resolve(tmpdir(), 'harmoniarr-file-backed-validation-'));
  const directories = await createWorkspaceLayout(workspaceRoot);
  const appPort = await getAvailablePort();
  const vapidKeys = generateVapidKeyPair();
  const effectiveImageRef = imageRef ?? `harmoniarr:file-backed-${projectName}`;
  const env = buildEnvironment({
    appPort,
    directories,
    imageRef: effectiveImageRef,
    processEnv,
    vapidKeys,
  });
  const composeArgs = ['compose', '-f', composeFilePath, '-p', projectName];

  try {
    await runCompose({
      args: [
        'up',
        buildImage ? '--build' : '--no-build',
        '--detach',
        '--wait',
        '--wait-timeout',
        String(startupTimeoutSeconds),
      ],
      composeArgs,
      env,
      timeoutMs: (startupTimeoutSeconds + 30) * 1000,
    });
    await waitForHealth({
      fetchFn,
      port: appPort,
      timeoutMs: startupTimeoutSeconds * 1000,
    });
    await generateFixtures({ composeArgs, env });
    await getContainerId({ composeArgs, env });
    const result = await copyAndRunVerifier({ composeArgs, env });

    return {
      ...result,
      projectName,
      workspaceRoot,
    };
  } finally {
    try {
      await stopProject({ composeArgs, env });
    } finally {
      await rm(workspaceRoot, { force: true, recursive: true });
    }
  }
}

export function resolveDockerFileBackedMusicQueueValidationInputs({
  args = process.argv.slice(2),
  env = process.env,
} = {}) {
  const buildImage = !args.includes('--no-build');
  if (args.some((arg) => arg !== '--no-build')) {
    throw new Error('Usage: node scripts/validate-docker-file-backed-music-queue.js [--no-build]');
  }
  const imageRef = env.HARMONIARR_FILE_BACKED_VALIDATION_IMAGE ?? null;
  if (!buildImage && !imageRef) {
    throw new Error('--no-build requires HARMONIARR_FILE_BACKED_VALIDATION_IMAGE to name a locally available image');
  }

  return {
    buildImage,
    imageRef,
    startupTimeoutSeconds: parsePositiveInteger(
      env.HARMONIARR_FILE_BACKED_VALIDATION_STARTUP_TIMEOUT_SECONDS,
      'HARMONIARR_FILE_BACKED_VALIDATION_STARTUP_TIMEOUT_SECONDS',
      defaultStartupTimeoutSeconds,
    ),
  };
}
