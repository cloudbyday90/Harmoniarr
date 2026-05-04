/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { once } from 'node:events';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBufferedCommand } from './process-runtime.js';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const schemaBootstrapLogSnippet = 'loaded schema snapshot from';
const harmoniarrServiceName = 'harmoniarr';
const defaultStartupValidationFailureScenario = Object.freeze({
  env: {
    HARMONIARR_BOOTSTRAP_OWNER_CLAIM_CODE: '',
    HARMONIARR_BOOTSTRAP_OWNER_EMAIL: '',
    HARMONIARR_BOOTSTRAP_OWNER_USERNAME: 'docker-smoke-owner',
  },
  expectedLogSnippet: 'HARMONIARR_BOOTSTRAP_OWNER_CLAIM_CODE is required when HARMONIARR_BOOTSTRAP_OWNER_USERNAME or HARMONIARR_BOOTSTRAP_OWNER_EMAIL is configured.',
});

function createProjectName(prefix = 'harmoniarrsmoke') {
  return `${prefix}${Date.now()}`;
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
    throw new Error('Unable to allocate an available host port for the Docker smoke test');
  }

  return port;
}

async function ensureDirectoryLayout({ baseDir, mkdirFn = mkdir } = {}) {
  const directories = {
    appData: resolve(baseDir, 'appdata'),
    downloads: resolve(baseDir, 'downloads'),
    music: resolve(baseDir, 'music'),
    staging: resolve(baseDir, 'staging'),
    transcodeTemp: resolve(baseDir, 'transcode-temp'),
  };

  await Promise.all(
    Object.values(directories).map((directory) => mkdirFn(directory, { recursive: true })),
  );

  return directories;
}

async function runCommand({
  args,
  command,
  cwd = rootDir,
  env,
  expectedExitCodes,
} = {}) {
  return runBufferedCommand({
    args,
    command,
    cwd,
    env,
    expectedExitCodes,
  });
}

async function runComposeCommand({
  composeArgs,
  env,
  args,
  expectedExitCodes,
  runCommandFn,
} = {}) {
  return runCommandFn({
    args: [...composeArgs, ...args],
    command: 'docker',
    env,
    expectedExitCodes,
  });
}

function buildComposeUpArgs({
  buildImage,
  detach = true,
  serviceName = harmoniarrServiceName,
} = {}) {
  const args = ['up'];

  if (buildImage) {
    args.push('--build');
  } else {
    args.push('--no-build');
  }

  if (detach) {
    args.push('--detach', '--wait', '--wait-timeout', '180');
    return args;
  }

  args.push('--abort-on-container-failure', '--exit-code-from', serviceName, '--no-color');
  return args;
}

async function startComposeProject({
  buildImage,
  composeArgs,
  env,
  runCommandFn,
} = {}) {
  await runComposeCommand({
    args: buildComposeUpArgs({
      buildImage,
      detach: true,
    }),
    composeArgs,
    env,
    runCommandFn,
  });
}

async function stopComposeProject({
  composeArgs,
  env,
  removeVolumes,
  runCommandFn,
} = {}) {
  const args = ['down'];

  if (removeVolumes) {
    args.push('--volumes');
  }

  args.push('--remove-orphans');

  await runComposeCommand({
    args,
    composeArgs,
    env,
    runCommandFn,
  });
}

async function getServiceContainerId({
  composeArgs,
  env,
  includeStopped = false,
  runCommandFn,
  serviceName = harmoniarrServiceName,
} = {}) {
  const containerResult = await runComposeCommand({
    args: ['ps', includeStopped ? '-aq' : '-q', serviceName],
    composeArgs,
    env,
    runCommandFn,
  });
  const containerId = containerResult.stdout.trim();

  if (!containerId) {
    throw new Error(`Docker smoke validation could not resolve the ${serviceName} container ID`);
  }

  return containerId;
}

async function assertReadonlyRootFilesystem({
  composeArgs,
  env,
  runCommandFn,
} = {}) {
  const containerId = await getServiceContainerId({
    composeArgs,
    env,
    runCommandFn,
  });

  const inspectResult = await runCommandFn({
    args: ['inspect', '--format', '{{json .HostConfig.ReadonlyRootfs}}', containerId],
    command: 'docker',
    env,
  });
  const readonlyRootfs = inspectResult.stdout.trim();

  if (readonlyRootfs !== 'true') {
    throw new Error(`Docker container ${containerId} is not running with a read-only root filesystem`);
  }
}

function getFirstNonEmptyLine(output = '') {
  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? '';
}

async function getBinaryVersion({
  binary,
  composeArgs,
  env,
  runCommandFn,
  serviceName = harmoniarrServiceName,
} = {}) {
  const versionResult = await runComposeCommand({
    args: ['exec', '-T', serviceName, binary, '-version'],
    composeArgs,
    env,
    runCommandFn,
  });
  const version = getFirstNonEmptyLine(versionResult.stdout);

  if (!version) {
    throw new Error(`Docker smoke validation could not read a version line from ${binary} -version`);
  }

  return version;
}

async function getMediaToolingSummary({
  composeArgs,
  env,
  runCommandFn,
} = {}) {
  const [ffmpegVersion, ffprobeVersion] = await Promise.all([
    getBinaryVersion({
      binary: 'ffmpeg',
      composeArgs,
      env,
      runCommandFn,
    }),
    getBinaryVersion({
      binary: 'ffprobe',
      composeArgs,
      env,
      runCommandFn,
    }),
  ]);

  return {
    ffmpegVersion,
    ffprobeVersion,
  };
}

async function getServiceState({
  composeArgs,
  env,
  runCommandFn,
  serviceName = harmoniarrServiceName,
} = {}) {
  const containerId = await getServiceContainerId({
    composeArgs,
    env,
    includeStopped: true,
    runCommandFn,
    serviceName,
  });
  const inspectResult = await runCommandFn({
    args: ['inspect', '--format', '{{json .State}}', containerId],
    command: 'docker',
    env,
  });

  let state;

  try {
    state = JSON.parse(inspectResult.stdout.trim());
  } catch {
    throw new Error(`Docker smoke validation could not parse state inspection for container ${containerId}`);
  }

  if (!state || typeof state.ExitCode !== 'number' || typeof state.Status !== 'string') {
    throw new Error(`Docker smoke validation could not read the exit state for container ${containerId}`);
  }

  return {
    containerId,
    exitCode: state.ExitCode,
    status: state.Status,
  };
}

async function getHealthSummary({ fetchFn, port } = {}) {
  const healthResponse = await fetchFn(`http://127.0.0.1:${port}/healthz`);
  if (!healthResponse.ok) {
    throw new Error(`Health check returned HTTP ${healthResponse.status}`);
  }

  return healthResponse.json();
}

async function getServiceLogs({
  composeArgs,
  env,
  serviceName = harmoniarrServiceName,
  runCommandFn,
} = {}) {
  const logResult = await runComposeCommand({
    args: ['logs', '--no-color', serviceName],
    composeArgs,
    env,
    runCommandFn,
  });

  return logResult.stdout;
}

async function runMigrationCheck({
  composeArgs,
  env,
  runCommandFn,
} = {}) {
  const migrationCheck = await runComposeCommand({
    args: ['exec', '-T', 'harmoniarr', 'node', '/app/server-dist/check-migrations.js'],
    composeArgs,
    env,
    runCommandFn,
  });

  return migrationCheck.stdout.trim();
}

async function validateRunningStack({
  composeArgs,
  env,
  expectBootstrapLog,
  fetchFn,
  port,
  runCommandFn,
} = {}) {
  await assertReadonlyRootFilesystem({
    composeArgs,
    env,
    runCommandFn,
  });

  const healthBody = await getHealthSummary({
    fetchFn,
    port,
  });
  const mediaTooling = await getMediaToolingSummary({
    composeArgs,
    env,
    runCommandFn,
  });
  const logs = await getServiceLogs({
    composeArgs,
    env,
    runCommandFn,
  });
  const sawBootstrapLog = logs.includes(schemaBootstrapLogSnippet);

  if (expectBootstrapLog && !sawBootstrapLog) {
    throw new Error('Fresh-install startup logs did not confirm schema snapshot bootstrap');
  }

  if (!expectBootstrapLog && sawBootstrapLog) {
    throw new Error('Existing-data restart unexpectedly reloaded the schema snapshot');
  }

  const migrationCheckOutput = await runMigrationCheck({
    composeArgs,
    env,
    runCommandFn,
  });

  return {
    healthBody,
    mediaTooling,
    migrationCheckOutput,
    sawBootstrapLog,
  };
}

async function validateStartupRefusal({
  buildImage,
  composeArgs,
  env,
  runCommandFn,
  startupValidationFailureScenario,
  serviceName = harmoniarrServiceName,
} = {}) {
  const failureEnv = {
    ...env,
    ...startupValidationFailureScenario.env,
  };
  const composeResult = await runComposeCommand({
    args: buildComposeUpArgs({
      buildImage,
      detach: false,
      serviceName,
    }),
    composeArgs,
    env: failureEnv,
    expectedExitCodes: [1],
    runCommandFn,
  });
  const serviceState = await getServiceState({
    composeArgs,
    env: failureEnv,
    runCommandFn,
    serviceName,
  });

  if (serviceState.status !== 'exited') {
    throw new Error(`Docker smoke validation expected ${serviceName} to exit during invalid startup validation, but container ${serviceState.containerId} is ${serviceState.status}`);
  }

  if (serviceState.exitCode !== 1) {
    throw new Error(`Docker smoke validation expected ${serviceName} to exit with code 1 during invalid startup validation, but container ${serviceState.containerId} exited with ${serviceState.exitCode}`);
  }

  const logs = await getServiceLogs({
    composeArgs,
    env: failureEnv,
    serviceName,
    runCommandFn,
  });

  if (!logs.includes(startupValidationFailureScenario.expectedLogSnippet)) {
    throw new Error('Docker smoke validation did not observe the expected startup-refusal log for the invalid configuration scenario');
  }

  return {
    composeExitCode: composeResult.exitCode,
    expectedLogSnippet: startupValidationFailureScenario.expectedLogSnippet,
    serviceExitCode: serviceState.exitCode,
    serviceStatus: serviceState.status,
  };
}

function buildValidationEnvironment({
  directories,
  imageRef,
  port,
  processEnv = process.env,
} = {}) {
  return {
    ...processEnv,
    APP_PORT: '3000',
    HARMONIARR_APPDATA: directories.appData,
    HARMONIARR_CONTACT_EMAIL: processEnv.HARMONIARR_CONTACT_EMAIL ?? '',
    HARMONIARR_CONTACT_URL: processEnv.HARMONIARR_CONTACT_URL ?? 'https://github.com/cloudbyday90/harmoniarr',
    HARMONIARR_DOWNLOADS: directories.downloads,
    ...(imageRef ? { HARMONIARR_IMAGE: imageRef } : {}),
    HARMONIARR_MUSIC: directories.music,
    HARMONIARR_PORT: String(port),
    HARMONIARR_STAGING: directories.staging,
    HARMONIARR_TRANSCODE_TEMP: directories.transcodeTemp,
  };
}

export async function validateDockerFreshInstall({
  buildImage = true,
  composeFilePath = resolve(rootDir, 'compose.yaml'),
  fetchFn = fetch,
  getAvailablePortFn = getAvailablePort,
  imageRef,
  makeDirectoryLayoutFn = ensureDirectoryLayout,
  mkdtempFn = mkdtemp,
  processEnv = process.env,
  projectName = createProjectName(),
  removeFn = rm,
  runCommandFn = runCommand,
  startupValidationFailureScenario = defaultStartupValidationFailureScenario,
  tempRootDir = tmpdir(),
  verifyExistingDataRestart = false,
} = {}) {
  const workspaceRoot = await mkdtempFn(resolve(tempRootDir, 'harmoniarr-docker-smoke-'));
  const port = await getAvailablePortFn();
  const directories = await makeDirectoryLayoutFn({ baseDir: workspaceRoot });
  const composeArgs = ['compose', '-f', composeFilePath, '-p', projectName];
  const env = buildValidationEnvironment({
    directories,
    imageRef,
    port,
    processEnv,
  });

  try {
    await startComposeProject({
      buildImage,
      composeArgs,
      env,
      runCommandFn,
    });

    const freshInstall = await validateRunningStack({
      composeArgs,
      env,
      expectBootstrapLog: true,
      fetchFn,
      port,
      runCommandFn,
    });

    let existingDataRestart = null;
    let startupFailure = null;

    if (verifyExistingDataRestart) {
      await stopComposeProject({
        composeArgs,
        env,
        removeVolumes: false,
        runCommandFn,
      });

      await startComposeProject({
        buildImage: false,
        composeArgs,
        env,
        runCommandFn,
      });

      existingDataRestart = await validateRunningStack({
        composeArgs,
        env,
        expectBootstrapLog: false,
        fetchFn,
        port,
        runCommandFn,
      });
    }

    if (startupValidationFailureScenario) {
      await stopComposeProject({
        composeArgs,
        env,
        removeVolumes: false,
        runCommandFn,
      });

      startupFailure = await validateStartupRefusal({
        buildImage: false,
        composeArgs,
        env,
        runCommandFn,
        startupValidationFailureScenario,
      });
    }

    return {
      existingDataRestart,
      freshInstall,
      imageRef: imageRef ?? null,
      port,
      projectName,
      startupFailure,
      workspaceRoot,
    };
  } finally {
    try {
      await stopComposeProject({
        composeArgs,
        env,
        removeVolumes: true,
        runCommandFn,
      });
    } catch {
      // Best-effort cleanup keeps the validation idempotent without masking the original failure.
    }

    await removeFn(workspaceRoot, { force: true, recursive: true });
  }
}
