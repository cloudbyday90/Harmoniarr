import assert from 'node:assert/strict';
import test from 'node:test';

import { validateDockerFreshInstall } from '../../scripts/docker-smoke-validation.js';

function createFetchResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function createRunCommandStub({
  failureComposeExitCode = 1,
  failureLogs = '[harmoniarr] startup failed: HARMONIARR_BOOTSTRAP_OWNER_CLAIM_CODE is required when HARMONIARR_BOOTSTRAP_OWNER_USERNAME or HARMONIARR_BOOTSTRAP_OWNER_EMAIL is configured.',
  failureServiceState = { ExitCode: 1, Status: 'exited' },
  ffmpegVersion = 'ffmpeg version 7.1.1',
  ffprobeVersion = 'ffprobe version 7.1.1',
  logs = '[harmoniarr-entrypoint] initializing embedded PostgreSQL cluster at /app/data/postgres/18/data\n[harmoniarr-entrypoint] starting embedded PostgreSQL on 127.0.0.1:5432\n[harmoniarr-entrypoint] preparing database state\n[harmoniarr] loaded schema snapshot from src/server/schema-snapshot.sql',
  migrationCheckOutput = 'No pending migrations remain.',
  postgresIdentity = 'harmoniarr|harmoniarr',
  postgresPersistenceCount = '1',
  postgresReadyMessage = '127.0.0.1:5432 - accepting connections',
  restartLogs = '[harmoniarr-entrypoint] starting embedded PostgreSQL on 127.0.0.1:5432\n[harmoniarr-entrypoint] preparing database state',
} = {}) {
  const calls = [];
  let successfulStartupCount = 0;

  async function runCommandFn({ args, command, cwd, env }) {
    calls.push({ args, command, cwd, env });

    if (command !== 'docker') {
      throw new Error(`Unexpected command: ${command}`);
    }

    const joinedArgs = args.join(' ');
    const isComposeCommand = args[0] === 'compose';

    if (isComposeCommand && args.includes('up')) {
      if (args.includes('--abort-on-container-failure')) {
        return { exitCode: failureComposeExitCode, stderr: '', stdout: '' };
      }

      successfulStartupCount += 1;

      return { exitCode: 0, stderr: '', stdout: '' };
    }

    if (isComposeCommand && args.includes('down')) {
      return { exitCode: 0, stderr: '', stdout: '' };
    }

    if (isComposeCommand && args.includes('ps') && (args.includes('-q') || args.includes('-aq')) && args.at(-1) === 'harmoniarr') {
      return { exitCode: 0, stderr: '', stdout: 'container-123\n' };
    }

    if (args[0] === 'inspect' && args.includes('{{json .HostConfig.ReadonlyRootfs}}')) {
      return { exitCode: 0, stderr: '', stdout: 'true\n' };
    }

    if (args[0] === 'inspect' && args.includes('{{json .State}}')) {
      return { exitCode: 0, stderr: '', stdout: `${JSON.stringify(failureServiceState)}\n` };
    }

    if (isComposeCommand && args.includes('ffmpeg') && args.includes('-version')) {
      return {
        exitCode: 0,
        stderr: '',
        stdout: ffmpegVersion ? `${ffmpegVersion}\nconfiguration: ...\n` : '',
      };
    }

    if (isComposeCommand && args.includes('ffprobe') && args.includes('-version')) {
      return {
        exitCode: 0,
        stderr: '',
        stdout: ffprobeVersion ? `${ffprobeVersion}\nconfiguration: ...\n` : '',
      };
    }

    if (isComposeCommand && args.includes('pg_isready')) {
      return {
        exitCode: 0,
        stderr: '',
        stdout: `${postgresReadyMessage}\n`,
      };
    }

    if (isComposeCommand && args.includes('psql')) {
      const sql = args.at(-1) ?? '';

      if (sql.includes("SELECT current_database() || '|' || current_user")) {
        return {
          exitCode: 0,
          stderr: '',
          stdout: `${postgresIdentity}\n`,
        };
      }

      if (sql.includes('CREATE TABLE IF NOT EXISTS docker_smoke_persistence_probe')) {
        return { exitCode: 0, stderr: '', stdout: '' };
      }

      if (sql.includes('SELECT COUNT(*) FROM docker_smoke_persistence_probe')) {
        return {
          exitCode: 0,
          stderr: '',
          stdout: `${postgresPersistenceCount}\n`,
        };
      }
    }

    if (isComposeCommand && args.includes('logs')) {
      return {
        exitCode: 0,
        stderr: '',
        stdout: env?.HARMONIARR_BOOTSTRAP_OWNER_USERNAME === 'docker-smoke-owner'
          ? failureLogs
          : (successfulStartupCount > 1 ? restartLogs : logs),
      };
    }

    if (isComposeCommand && args.includes('/app/server-dist/check-migrations.js')) {
      return { exitCode: 0, stderr: '', stdout: `${migrationCheckOutput}\n` };
    }

    throw new Error(`Unexpected docker invocation: docker ${joinedArgs}`);
  }

  return {
    calls,
    runCommandFn,
  };
}

test('validateDockerFreshInstall verifies ffmpeg and ffprobe in the running image', async () => {
  const { calls, runCommandFn } = createRunCommandStub({
    ffmpegVersion: 'ffmpeg version 7.2.0-static',
    ffprobeVersion: 'ffprobe version 7.2.0-static',
  });
  const removedDirectories = [];

  const result = await validateDockerFreshInstall({
    fetchFn: async () => createFetchResponse({
      ok: true,
      pendingMigrations: 0,
      service: 'ok',
    }),
    getAvailablePortFn: async () => 4300,
    makeDirectoryLayoutFn: async () => ({
      appData: '/tmp/appdata',
      downloads: '/tmp/downloads',
      music: '/tmp/music',
      staging: '/tmp/staging',
      transcodeTemp: '/tmp/transcode-temp',
    }),
    mkdtempFn: async () => '/tmp/harmoniarr-smoke',
    processEnv: {},
    projectName: 'harmoniarrsmoke-test',
    removeFn: async (path) => {
      removedDirectories.push(path);
    },
    runCommandFn,
    tempRootDir: '/tmp',
    verifyExistingDataRestart: true,
  });

  assert.deepEqual(result.existingDataRestart?.embeddedPostgres, {
    databaseName: 'harmoniarr',
    readyMessage: '127.0.0.1:5432 - accepting connections',
    user: 'harmoniarr',
  });
  assert.deepEqual(result.embeddedPostgresPersistence, {
    persisted: true,
    probeKey: 'probe_harmoniarrsmoke-test',
    rowCount: 1,
  });
  assert.deepEqual(result.freshInstall.mediaTooling, {
    ffmpegVersion: 'ffmpeg version 7.2.0-static',
    ffprobeVersion: 'ffprobe version 7.2.0-static',
  });
  assert.deepEqual(result.startupFailure, {
    composeExitCode: 1,
    expectedLogSnippet: 'HARMONIARR_BOOTSTRAP_OWNER_CLAIM_CODE is required when HARMONIARR_BOOTSTRAP_OWNER_USERNAME or HARMONIARR_BOOTSTRAP_OWNER_EMAIL is configured.',
    serviceExitCode: 1,
    serviceStatus: 'exited',
  });
  assert.equal(removedDirectories[0], '/tmp/harmoniarr-smoke');

  const execCalls = calls
    .filter(({ args }) => args.includes('exec'))
    .map(({ args }) => args.join(' '));

  assert.ok(execCalls.some((command) => command.includes(' ffmpeg -version')));
  assert.ok(execCalls.some((command) => command.includes(' ffprobe -version')));
  assert.ok(execCalls.filter((command) => command.includes(' pg_isready ')).length >= 2);
  assert.ok(execCalls.filter((command) => command.includes("SELECT current_database() || '|' || current_user")).length >= 2);
  assert.ok(execCalls.some((command) => command.includes('node /app/server-dist/check-migrations.js')));
  assert.ok(execCalls.some((command) => command.includes('CREATE TABLE IF NOT EXISTS docker_smoke_persistence_probe')));
  assert.ok(execCalls.some((command) => command.includes("SELECT COUNT(*) FROM docker_smoke_persistence_probe WHERE probe_key = 'probe_harmoniarrsmoke-test'")));

  assert.ok(calls.some(({ args }) => args.includes('--abort-on-container-failure')));
  assert.ok(calls.some(({ args }) => args.includes('{{json .State}}')));
});

test('validateDockerFreshInstall fails when a tooling version probe returns no version line', async () => {
  const { runCommandFn } = createRunCommandStub({
    ffprobeVersion: '',
  });

  await assert.rejects(
    () => validateDockerFreshInstall({
      fetchFn: async () => createFetchResponse({
        ok: true,
        pendingMigrations: 0,
        service: 'ok',
      }),
      getAvailablePortFn: async () => 4301,
      makeDirectoryLayoutFn: async () => ({
        appData: '/tmp/appdata',
        downloads: '/tmp/downloads',
        music: '/tmp/music',
        staging: '/tmp/staging',
        transcodeTemp: '/tmp/transcode-temp',
      }),
      mkdtempFn: async () => '/tmp/harmoniarr-smoke',
      processEnv: {},
      projectName: 'harmoniarrsmoke-test',
      removeFn: async () => {},
      runCommandFn,
      tempRootDir: '/tmp',
    }),
    /could not read a version line from ffprobe -version/,
  );
});

test('validateDockerFreshInstall fails when the existing-data restart reinitializes embedded PostgreSQL', async () => {
  const { runCommandFn } = createRunCommandStub({
    restartLogs: '[harmoniarr-entrypoint] initializing embedded PostgreSQL cluster at /app/data/postgres/18/data\n[harmoniarr-entrypoint] starting embedded PostgreSQL on 127.0.0.1:5432\n[harmoniarr-entrypoint] preparing database state',
  });

  await assert.rejects(
    () => validateDockerFreshInstall({
      fetchFn: async () => createFetchResponse({
        ok: true,
        pendingMigrations: 0,
        service: 'ok',
      }),
      getAvailablePortFn: async () => 4303,
      makeDirectoryLayoutFn: async () => ({
        appData: '/tmp/appdata',
        downloads: '/tmp/downloads',
        music: '/tmp/music',
        staging: '/tmp/staging',
        transcodeTemp: '/tmp/transcode-temp',
      }),
      mkdtempFn: async () => '/tmp/harmoniarr-smoke',
      processEnv: {},
      projectName: 'harmoniarrsmoke-test',
      removeFn: async () => {},
      runCommandFn,
      tempRootDir: '/tmp',
      verifyExistingDataRestart: true,
    }),
    /unexpectedly reinitialized the embedded PostgreSQL cluster/,
  );
});

test('validateDockerFreshInstall fails when the invalid-startup scenario does not emit the expected refusal log', async () => {
  const { runCommandFn } = createRunCommandStub({
    failureLogs: '[harmoniarr] startup failed: unexpected startup error',
  });

  await assert.rejects(
    () => validateDockerFreshInstall({
      fetchFn: async () => createFetchResponse({
        ok: true,
        pendingMigrations: 0,
        service: 'ok',
      }),
      getAvailablePortFn: async () => 4302,
      makeDirectoryLayoutFn: async () => ({
        appData: '/tmp/appdata',
        downloads: '/tmp/downloads',
        music: '/tmp/music',
        staging: '/tmp/staging',
        transcodeTemp: '/tmp/transcode-temp',
      }),
      mkdtempFn: async () => '/tmp/harmoniarr-smoke',
      processEnv: {},
      projectName: 'harmoniarrsmoke-test',
      removeFn: async () => {},
      runCommandFn,
      tempRootDir: '/tmp',
    }),
    /did not observe the expected startup-refusal log/,
  );
});
