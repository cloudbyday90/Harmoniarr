/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { chmod, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateVapidKeyPair } from '../src/server/push/vapid-keys.js';
import { createCandidateDockerCommand } from './docker-candidate-command.js';
import { assertDockerProjectRemoved, removeOwnedDockerWorkspace } from './docker-smoke-cleanup.js';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const directoryNames = Object.freeze({ appData: 'appdata', downloads: 'downloads', music: 'music',
  staging: 'staging', transcodeTemp: 'transcode-temp' });
const mountEnvironment = Object.freeze({ appData: 'HARMONIARR_APPDATA', downloads: 'HARMONIARR_DOWNLOADS',
  music: 'HARMONIARR_MUSIC', staging: 'HARMONIARR_STAGING', transcodeTemp: 'HARMONIARR_TRANSCODE_TEMP' });
const mountTargets = Object.freeze({ appData: '/app/data', downloads: '/data/downloads', music: '/data/music',
  staging: '/data/staging', transcodeTemp: '/data/transcode-temp' });
const allowedEnvironment = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'HOME',
  'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMW6432',
  'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR',
  'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']);

function composeInput(name, required = true) {
  return '$' + '{' + name + (required ? ':?Disposable fixture input required' : ':-') + '}';
}

export function createDockerCandidateEnvironment(env = process.env) {
  return { ...Object.fromEntries(Object.entries(env).filter(([key, value]) =>
    allowedEnvironment.has(key.toUpperCase()) && typeof value === 'string')
    .map(([key, value]) => [key.toUpperCase().startsWith('DOCKER_') ? key.toUpperCase() : key, value])),
  COMPOSE_DISABLE_ENV_FILE: 'true', COMPOSE_ANSI: 'never', COMPOSE_PROGRESS: 'plain' };
}

export async function assertLocalDockerCandidateEngine({ env, runCommandFn }) {
  const local = (endpoint) => /^(?:unix:\/\/\/[^\r\n]+|npipe:\/\/\/\/\.\/pipe\/[^\r\n]+)$/.test(endpoint);
  if (env.DOCKER_HOST && !local(env.DOCKER_HOST)) {
    throw new Error('Candidate acceptance requires a local Docker engine');
  }
  const result = await runCommandFn({ command: 'docker',
    args: ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], env });
  if (result.exitCode !== 0 || !local(result.stdout.trim())) {
    throw new Error('Candidate acceptance requires a local Docker engine');
  }
}

export function createDockerCandidateCompose({ baselineConfiguration, projectName }) {
  const service = baselineConfiguration?.services?.harmoniarr;
  if (!service || Object.keys(baselineConfiguration.services).length !== 1
    || service.read_only !== true || service.init !== true || service.deploy?.replicas !== 1
    || !service.cap_drop?.includes('ALL') || !service.security_opt?.includes('no-new-privileges:true')) {
    throw new Error('The canonical Compose configuration no longer satisfies candidate fixture hardening');
  }
  return {
    name: projectName,
    services: {
      harmoniarr: {
        // Retain the canonical deployment controls; replace every input capable
        // of importing operator state, code, mounts, or network configuration.
        init: service.init, deploy: { mode: 'replicated', replicas: 1 },
        stop_grace_period: service.stop_grace_period,
        read_only: service.read_only, security_opt: ['no-new-privileges:true'], cap_drop: ['ALL'],
        image: composeInput('HARMONIARR_IMAGE'),
        pull_policy: 'never', restart: 'no', user: '1000:1000',
        environment: {
          TZ: 'UTC', UMASK: '0022', APP_PORT: '3000',
          HARMONIARR_BASE_URL: '', HARMONIARR_CONTACT_URL: 'https://example.invalid/harmoniarr-acceptance',
          HARMONIARR_CONTACT_EMAIL: '', HARMONIARR_LOG_LEVEL: 'info',
          HARMONIARR_BOOTSTRAP_OWNER_CLAIM_CODE: composeInput('HARMONIARR_BOOTSTRAP_OWNER_CLAIM_CODE', false),
          HARMONIARR_BOOTSTRAP_OWNER_EMAIL: composeInput('HARMONIARR_BOOTSTRAP_OWNER_EMAIL', false),
          HARMONIARR_BOOTSTRAP_OWNER_USERNAME: composeInput('HARMONIARR_BOOTSTRAP_OWNER_USERNAME', false),
          HARMONIARR_SECRET_ENCRYPTION_KEY: composeInput('HARMONIARR_SECRET_ENCRYPTION_KEY'),
          HARMONIARR_INSTANCE_ID: projectName,
          VAPID_CONTACT: 'mailto:acceptance@example.invalid',
          VAPID_PRIVATE_KEY: composeInput('VAPID_PRIVATE_KEY'),
          VAPID_PUBLIC_KEY: composeInput('VAPID_PUBLIC_KEY'),
        },
        ports: [{ target: 3000, published: composeInput('HARMONIARR_PORT'), host_ip: '127.0.0.1', protocol: 'tcp' }],
        volumes: Object.entries(mountTargets).map(([key, target]) => ({ type: 'bind',
          source: composeInput(mountEnvironment[key]), target,
          bind: { create_host_path: false } })),
        tmpfs: ['/tmp:size=256m,mode=1777', '/run/postgresql:size=32m,mode=0770,uid=1000,gid=1000'],
        networks: ['default'],
      },
    },
    // Docker Desktop does not publish host ports for an internal network.
    // Exercise the actual loopback HTTP interface on a dedicated bridge; this
    // fixture makes no outbound network isolation claim.
    networks: { default: { driver: 'bridge' } },
  };
}

export async function withDockerCandidateFixture({
  run, env = process.env, runCommandFn = createCandidateDockerCommand(), tempRootDir = tmpdir(),
  baselineComposeFilePath = resolve(rootDir, 'compose.yaml'),
} = {}) {
  if (typeof run !== 'function') throw new Error('A Docker candidate fixture callback is required');
  const processEnv = createDockerCandidateEnvironment(env);
  await assertLocalDockerCandidateEngine({ env: processEnv, runCommandFn });
  const projectName = `harmoniarr-candidate-${randomUUID()}`;
  const workspaceRoot = await mkdtemp(resolve(tempRootDir, 'harmoniarr-candidate-'));
  let result;
  let failure;
  try {
    const emptyEnvironmentPath = resolve(workspaceRoot, 'empty.env');
    await writeFile(emptyEnvironmentPath, '', { mode: 0o600 });
    // The explicit empty env file also prevents Compose from loading the
    // caller's project .env when this script runs from an operator checkout.
    const rendered = await runCommandFn({ command: 'docker', cwd: workspaceRoot, env: processEnv,
      args: ['compose', '--env-file', emptyEnvironmentPath, '--project-directory', workspaceRoot,
        '-f', baselineComposeFilePath, 'config', '--no-interpolate', '--no-env-resolution', '--format', 'json'] });
    const composeFilePath = resolve(workspaceRoot, 'compose.json');
    const configuration = createDockerCandidateCompose({ baselineConfiguration: JSON.parse(rendered.stdout), projectName });
    await writeFile(composeFilePath, `${JSON.stringify(configuration, null, 2)}\n`, { mode: 0o600 });
    const vapid = generateVapidKeyPair();
    Object.assign(processEnv, { HARMONIARR_SECRET_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
      VAPID_PRIVATE_KEY: vapid.privateKey, VAPID_PUBLIC_KEY: vapid.publicKey });
    async function makeDirectoryLayoutFn({ baseDir }) {
      // All bind sources are children of this invocation's private temp root.
      if (!resolve(baseDir).startsWith(`${workspaceRoot}/`) && !resolve(baseDir).startsWith(`${workspaceRoot}\\`)) {
        throw new Error('Docker acceptance bind directory is outside its owned workspace');
      }
      const directories = Object.fromEntries(Object.entries(directoryNames).map(([key, name]) => [key, resolve(baseDir, name)]));
      for (const directory of Object.values(directories)) {
        await mkdir(directory, { recursive: true });
        // The parent temp directory is private (0700). Writable bind roots let
        // the unprivileged image UID work even when the host caller is root.
        await chmod(directory, 0o777);
      }
      return directories;
    }
    result = await run({ composeFilePath, processEnv, projectName, tempRootDir: workspaceRoot, makeDirectoryLayoutFn,
      smokeAdminCredentials: { username: 'smoke-admin', password: `${randomBytes(32).toString('base64url')}Aa1!` },
      smokeRequestTargetCredentials: { username: 'smoke-listener', role: 'requester', password: `${randomBytes(32).toString('base64url')}Aa1!` },
    });
  } catch (error) { failure = error; }
  try {
    await assertDockerProjectRemoved({ projectName, env: processEnv, runCommandFn });
    await removeOwnedDockerWorkspace({ workspaceRoot, tempRootDir, prefix: 'harmoniarr-candidate-' });
  } catch {
    throw new Error('Owned Docker candidate fixture cleanup could not be verified');
  }
  if (failure) throw failure;
  return result;
}
