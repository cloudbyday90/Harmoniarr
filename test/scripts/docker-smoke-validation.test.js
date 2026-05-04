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
  ffmpegVersion = 'ffmpeg version 7.1.1',
  ffprobeVersion = 'ffprobe version 7.1.1',
  logs = 'loaded schema snapshot from src/server/schema-snapshot.sql',
  migrationCheckOutput = 'No pending migrations remain.',
} = {}) {
  const calls = [];

  async function runCommandFn({ args, command, cwd, env }) {
    calls.push({ args, command, cwd, env });

    if (command !== 'docker') {
      throw new Error(`Unexpected command: ${command}`);
    }

    const joinedArgs = args.join(' ');
    const isComposeCommand = args[0] === 'compose';

    if (isComposeCommand && args.includes('up')) {
      return { exitCode: 0, stderr: '', stdout: '' };
    }

    if (isComposeCommand && args.includes('down')) {
      return { exitCode: 0, stderr: '', stdout: '' };
    }

    if (isComposeCommand && args.includes('ps') && args.includes('-q') && args.at(-1) === 'harmoniarr') {
      return { exitCode: 0, stderr: '', stdout: 'container-123\n' };
    }

    if (args[0] === 'inspect') {
      return { exitCode: 0, stderr: '', stdout: 'true\n' };
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

    if (isComposeCommand && args.includes('logs')) {
      return { exitCode: 0, stderr: '', stdout: logs };
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
  });

  assert.deepEqual(result.freshInstall.mediaTooling, {
    ffmpegVersion: 'ffmpeg version 7.2.0-static',
    ffprobeVersion: 'ffprobe version 7.2.0-static',
  });
  assert.equal(removedDirectories[0], '/tmp/harmoniarr-smoke');

  const execCommands = calls
    .filter(({ args }) => args.includes('exec'))
    .map(({ args }) => args.slice(-2).join(' '));

  assert.deepEqual(execCommands, [
    'ffmpeg -version',
    'ffprobe -version',
    'node /app/server-dist/check-migrations.js',
  ]);
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
