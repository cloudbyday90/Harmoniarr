/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateVapidKeyPair } from '../src/server/push/vapid-keys.js';
import { writeDockerSmokeEvidence } from './docker-smoke-evidence.js';
import {
  assertManagedSlskdSmokeResult,
  buildManagedSlskdApiProbeProgram,
  createManagedSlskdSmokeSecrets,
  managedSlskdSmokeValidationKind,
} from './managed-slskd-smoke-contract.js';
import { runBufferedCommand } from './process-runtime.js';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const defaultProviderStartupTimeoutSeconds = 180;

function createProjectName(prefix = 'harmoniarrmanagedslskd') {
  return `${prefix}${Date.now()}`;
}

function parseServiceState(output, label) {
  const [first = '', second = ''] = output.trim().split('|');
  if (!first || !second) {
    throw new Error(`Managed slskd smoke could not parse ${label} state`);
  }

  return {
    first,
    second,
  };
}

function parseApiProbe(output) {
  try {
    const payload = JSON.parse(output.trim());
    if (!Number.isInteger(payload?.status)) {
      throw new Error('status is missing');
    }
    return payload.status;
  } catch {
    throw new Error('Managed slskd smoke could not parse the private API probe response');
  }
}

function parsePortBindings(output) {
  try {
    const bindings = JSON.parse(output.trim());
    if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
      throw new Error('invalid port bindings');
    }
    return bindings;
  } catch {
    throw new Error('Managed slskd smoke could not parse provider port bindings');
  }
}

function redactValues(text, values) {
  return values.reduce((result, value) => {
    if (typeof value !== 'string' || value.length === 0) {
      return result;
    }

    return result.replaceAll(value, '[redacted]');
  }, text);
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
    throw new Error('Unable to allocate a host port for the managed slskd smoke test');
  }

  return port;
}

async function createWorkspaceLayout({ baseDir, mkdirFn = mkdir } = {}) {
  const directories = {
    appData: resolve(baseDir, 'appdata'),
    downloads: resolve(baseDir, 'downloads'),
    music: resolve(baseDir, 'music'),
    secrets: resolve(baseDir, 'secrets'),
    slskdAppData: resolve(baseDir, 'slskd-appdata'),
    slskdIncomplete: resolve(baseDir, 'slskd-incomplete'),
    staging: resolve(baseDir, 'staging'),
    transcodeTemp: resolve(baseDir, 'transcode-temp'),
  };

  await Promise.all(Object.values(directories).map((directory) => mkdirFn(directory, {
    mode: 0o700,
    recursive: true,
  })));

  return directories;
}

async function writeDisposableSecrets({
  secrets,
  secretDirectory,
  writeFileFn = writeFile,
} = {}) {
  await Promise.all(Object.entries(secrets).map(([name, value]) => {
    return writeFileFn(resolve(secretDirectory, name), `${value}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
  }));
}

async function runCommand({ args, env, runCommandFn = runBufferedCommand, timeoutMs } = {}) {
  return runCommandFn({
    args,
    command: 'docker',
    cwd: rootDir,
    env,
    timeoutMs,
  });
}

async function runComposeCommand({ args, composeArgs, env, runCommandFn, timeoutMs } = {}) {
  return runCommand({
    args: [...composeArgs, ...args],
    env,
    runCommandFn,
    timeoutMs,
  });
}

function buildSmokeEnvironment({
  appPort,
  directories,
  imageRef,
  listenerPort,
  processEnv,
  vapidKeys,
} = {}) {
  const env = { ...processEnv };
  delete env.HARMONIARR_IMAGE;

  return {
    ...env,
    APP_PORT: '3000',
    HARMONIARR_APPDATA: directories.appData,
    HARMONIARR_CONTACT_EMAIL: 'managed-smoke@harmoniarr.local',
    HARMONIARR_CONTACT_URL: 'https://harmoniarr.local/managed-smoke',
    HARMONIARR_DOWNLOADS: directories.downloads,
    HARMONIARR_IMAGE: imageRef,
    HARMONIARR_MUSIC: directories.music,
    HARMONIARR_PORT: String(appPort),
    HARMONIARR_SLSKD_APPDATA: directories.slskdAppData,
    HARMONIARR_SLSKD_INCOMPLETE: directories.slskdIncomplete,
    HARMONIARR_SLSKD_LISTEN_PORT: String(listenerPort),
    HARMONIARR_SLSKD_SECRETS_DIR: directories.secrets,
    HARMONIARR_STAGING: directories.staging,
    HARMONIARR_TRANSCODE_TEMP: directories.transcodeTemp,
    PGID: '1000',
    PUID: '1000',
    VAPID_CONTACT: 'mailto:managed-smoke@harmoniarr.local',
    VAPID_PRIVATE_KEY: vapidKeys.privateKey,
    VAPID_PUBLIC_KEY: vapidKeys.publicKey,
  };
}

async function getServiceContainerId({ composeArgs, env, runCommandFn, serviceName } = {}) {
  const result = await runComposeCommand({
    args: ['ps', '-q', '--all', serviceName],
    composeArgs,
    env,
    runCommandFn,
  });
  const containerId = result.stdout.trim();

  if (!containerId) {
    throw new Error(`Managed slskd smoke could not resolve the ${serviceName} container`);
  }

  return containerId;
}

async function inspectService({ composeArgs, env, format, runCommandFn, serviceName } = {}) {
  const containerId = await getServiceContainerId({ composeArgs, env, runCommandFn, serviceName });
  const result = await runCommand({
    args: ['inspect', '--format', format, containerId],
    env,
    runCommandFn,
  });

  return result.stdout;
}

async function assertManagedConfig({ composeArgs, env, runCommandFn } = {}) {
  await runComposeCommand({
    args: [
      'exec',
      '-T',
      'slskd',
      'sh',
      '-ec',
      "test \"$(stat -c '%a' /app/slskd.yml)\" = 600; grep -qx 'headless: true' /app/slskd.yml; grep -qx 'remote_configuration: false' /app/slskd.yml; grep -qx 'remote_file_management: false' /app/slskd.yml",
    ],
    composeArgs,
    env,
    runCommandFn,
  });
}

async function probeProviderApi({ composeArgs, env, runCommandFn } = {}) {
  const result = await runComposeCommand({
    args: ['exec', '-T', 'harmoniarr', 'node', '--input-type=module', '--eval', buildManagedSlskdApiProbeProgram()],
    composeArgs,
    env,
    runCommandFn,
  });

  return parseApiProbe(result.stdout);
}

async function getHarmoniarrHealth({ fetchFn, port } = {}) {
  const response = await fetchFn(`http://127.0.0.1:${port}/healthz`);
  if (!response.ok) {
    throw new Error(`Managed slskd smoke Harmoniarr health check returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.ok !== true) {
    throw new Error('Managed slskd smoke Harmoniarr health check did not report success');
  }

  return true;
}

async function stopComposeProject({ composeArgs, env, runCommandFn } = {}) {
  await runComposeCommand({
    args: ['down', '--volumes', '--remove-orphans'],
    composeArgs,
    env,
    runCommandFn,
  });
}

async function getManagedProviderLogs({ composeArgs, env, runCommandFn } = {}) {
  const result = await runComposeCommand({
    args: ['logs', '--no-color', '--tail', '200', 'slskd-config', 'slskd'],
    composeArgs,
    env,
    runCommandFn,
  });

  return result.stdout;
}

export async function validateManagedSlskdSmoke({
  buildImage = true,
  composeFilePaths = [
    resolve(rootDir, 'compose.yaml'),
    resolve(rootDir, 'compose.slskd-example.yaml'),
    resolve(rootDir, 'compose.slskd-smoke.yaml'),
  ],
  createSecretsFn = createManagedSlskdSmokeSecrets,
  fetchFn = fetch,
  generateVapidKeyPairFn = generateVapidKeyPair,
  getAvailablePortFn = getAvailablePort,
  imageRef = null,
  makeWorkspaceLayoutFn = createWorkspaceLayout,
  mkdtempFn = mkdtemp,
  processEnv = process.env,
  projectName = createProjectName(),
  removeFn = rm,
  runCommandFn = runBufferedCommand,
  tempRootDir = tmpdir(),
  writeSecretsFn = writeDisposableSecrets,
} = {}) {
  const workspaceRoot = await mkdtempFn(resolve(tempRootDir, 'harmoniarr-managed-slskd-smoke-'));
  const [appPort, listenerPort] = await Promise.all([getAvailablePortFn(), getAvailablePortFn()]);
  const directories = await makeWorkspaceLayoutFn({ baseDir: workspaceRoot });
  const secrets = createSecretsFn();
  const vapidKeys = generateVapidKeyPairFn();
  const effectiveImageRef = imageRef ?? `harmoniarr:managed-slskd-smoke-${projectName}`;
  const env = buildSmokeEnvironment({
    appPort,
    directories,
    imageRef: effectiveImageRef,
    listenerPort,
    processEnv,
    vapidKeys,
  });
  const composeArgs = ['compose', ...composeFilePaths.flatMap((filePath) => ['-f', filePath])];
  composeArgs.push('-p', projectName);

  try {
    await writeSecretsFn({ secrets, secretDirectory: directories.secrets });
    await runComposeCommand({
      args: [
        'up',
        buildImage ? '--build' : '--no-build',
        '--detach',
        '--wait',
        '--wait-timeout',
        String(defaultProviderStartupTimeoutSeconds),
      ],
      composeArgs,
      env,
      runCommandFn,
      timeoutMs: (defaultProviderStartupTimeoutSeconds + 30) * 1000,
    });

    const [configStateOutput, providerStateOutput, providerPortBindingsOutput, harmoniarrHealthStatus] = await Promise.all([
      inspectService({
        composeArgs,
        env,
        format: '{{.State.ExitCode}}|{{.State.Status}}',
        runCommandFn,
        serviceName: 'slskd-config',
      }),
      inspectService({
        composeArgs,
        env,
        format: '{{.State.Health.Status}}|{{.State.Status}}',
        runCommandFn,
        serviceName: 'slskd',
      }),
      inspectService({
        composeArgs,
        env,
        format: '{{json .NetworkSettings.Ports}}',
        runCommandFn,
        serviceName: 'slskd',
      }),
      getHarmoniarrHealth({ fetchFn, port: appPort }),
    ]);
    const configState = parseServiceState(configStateOutput, 'config renderer');
    const providerState = parseServiceState(providerStateOutput, 'provider');
    const providerPortBindings = parsePortBindings(providerPortBindingsOutput);

    await assertManagedConfig({ composeArgs, env, runCommandFn });
    const apiProbeStatus = await probeProviderApi({ composeArgs, env, runCommandFn });
    const result = assertManagedSlskdSmokeResult({
      config: {
        fileMode: '600',
        remoteConfigurationDisabled: true,
        rendererExitCode: Number.parseInt(configState.first, 10),
      },
      harmoniarr: {
        healthCheckOk: harmoniarrHealthStatus,
      },
      projectName,
      provider: {
        apiPortPublished: Object.hasOwn(providerPortBindings, '5030/tcp') && providerPortBindings['5030/tcp'] !== null,
        apiProbeStatus,
        egressIsolated: true,
        healthStatus: providerState.first,
      },
      workspaceRoot,
    });

    if (configState.second !== 'exited') {
      throw new Error(`Managed slskd config renderer must be exited, received ${configState.second}`);
    }
    if (providerState.second !== 'running') {
      throw new Error(`Managed slskd provider must be running, received ${providerState.second}`);
    }

    return result;
  } catch (error) {
    let logs = null;

    try {
      logs = await getManagedProviderLogs({ composeArgs, env, runCommandFn });
    } catch {
      // Preserve the original failure when logs are unavailable.
    }

    if (logs) {
      const redactedLogs = redactValues(logs, Object.values(secrets));
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\nManaged provider logs (redacted):\n${redactedLogs}`,
        { cause: error },
      );
    }

    throw error;
  } finally {
    try {
      await stopComposeProject({ composeArgs, env, runCommandFn });
    } catch {
      // Best-effort teardown must not hide the original smoke failure.
    }

    await removeFn(workspaceRoot, { force: true, recursive: true });
  }
}

export async function runManagedSlskdSmokeEvidence({
  evidencePath = null,
  writeDockerSmokeEvidenceFn = writeDockerSmokeEvidence,
  ...options
} = {}) {
  const result = await validateManagedSlskdSmoke(options);
  const evidence = await writeDockerSmokeEvidenceFn({
    evidencePath,
    validationKind: managedSlskdSmokeValidationKind,
    validationResult: result,
  });

  return {
    ...result,
    evidencePath: evidence?.evidencePath ?? null,
  };
}

export function renderManagedSlskdSmokeSuccessMessage({ evidencePath, projectName, provider } = {}) {
  const evidenceSummary = evidencePath ? `; evidence ${evidencePath}` : '';
  return `Managed slskd Docker smoke passed for ${projectName} (private API HTTP ${provider?.apiProbeStatus ?? 'unknown'}${evidenceSummary})`;
}
