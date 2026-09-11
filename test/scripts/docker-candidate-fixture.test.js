import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { assertLocalDockerCandidateEngine, createDockerCandidateCompose,
  createDockerCandidateEnvironment, withDockerCandidateFixture } from '../../scripts/docker-candidate-fixture.js';

function baseline() {
  return { services: { harmoniarr: { init: true, read_only: true, deploy: { mode: 'replicated', replicas: 1 },
    cap_drop: ['ALL'], security_opt: ['no-new-privileges:true'], stop_grace_period: '1m0s',
    image: 'mutable:latest', build: { context: '/operator' }, env_file: ['/operator/.env'],
    environment: { PROVIDER_TOKEN: 'operator-private-value' }, volumes: [{ source: '/operator/music' }],
    ports: [{ host_ip: '0.0.0.0', published: '9999' }], privileged: true,
  } } };
}

test('candidate child environment drops operator application, database, dotenv, and execution overrides', () => {
  const result = createDockerCandidateEnvironment({ Path: 'system-path', SystemRoot: 'system-root', ProgramFiles: 'system-programs',
    HOME: 'docker-home', DOCKER_CONTEXT: 'desktop-linux', PGHOST: 'production', DATABASE_URL: 'private-url',
    HARMONIARR_IMAGE: 'mutable', HARMONIARR_APPDATA: '/production', NODE_OPTIONS: '--import=untrusted.js',
    COMPOSE_FILE: 'operator.yml', COMPOSE_ENV_FILES: 'operator.env', COMPOSE_PROFILES: 'live',
    VAPID_PRIVATE_KEY: 'operator-secret', AWS_SECRET_ACCESS_KEY: 'private',
  });
  assert.deepEqual(result, { Path: 'system-path', SystemRoot: 'system-root', ProgramFiles: 'system-programs', HOME: 'docker-home',
    DOCKER_CONTEXT: 'desktop-linux', COMPOSE_DISABLE_ENV_FILE: 'true', COMPOSE_ANSI: 'never', COMPOSE_PROGRESS: 'plain' });
});

test('candidate Compose preserves canonical hardening while replacing every operator input', () => {
  const result = createDockerCandidateCompose({ baselineConfiguration: baseline(), projectName: 'fixture-123' });
  const service = result.services.harmoniarr;
  assert.equal(service.build, undefined);
  assert.equal(service.env_file, undefined);
  assert.equal(service.privileged, undefined);
  assert.equal(service.pull_policy, 'never');
  assert.equal(service.restart, 'no');
  assert.equal(service.read_only, true);
  assert.equal(service.user, '1000:1000');
  assert.equal(service.ports.length, 1);
  assert.equal(service.ports[0].host_ip, '127.0.0.1');
  assert.equal(service.ports[0].target, 3000);
  assert.deepEqual(result.networks, { default: { driver: 'bridge' } });
  assert.equal(service.volumes.length, 5);
  assert.ok(service.volumes.every((entry) => entry.type === 'bind' && entry.bind.create_host_path === false));
  assert.ok(!JSON.stringify(result).includes('operator'));
  assert.throws(() => createDockerCandidateCompose({ baselineConfiguration: { services: {
    ...baseline().services, foreign: {},
  } }, projectName: 'fixture' }), /canonical Compose/);
  const weakened = baseline();
  weakened.services.harmoniarr.read_only = false;
  assert.throws(() => createDockerCandidateCompose({ baselineConfiguration: weakened, projectName: 'fixture' }), /canonical Compose/);
});

test('candidate fixture rejects remote Docker hosts and remote selected contexts before startup', async () => {
  let calls = 0;
  const runCommandFn = async () => { calls += 1; return { exitCode: 0, stdout: 'ssh://remote.invalid' }; };
  for (const DOCKER_HOST of ['tcp://127.0.0.1:2375', 'ssh://remote.invalid', 'https://remote.invalid']) {
    await assert.rejects(assertLocalDockerCandidateEngine({ env: { DOCKER_HOST }, runCommandFn }), /local Docker engine/);
  }
  assert.equal(calls, 0);
  await assert.rejects(assertLocalDockerCandidateEngine({
    env: createDockerCandidateEnvironment({ docker_host: 'tcp://remote.invalid:2375' }), runCommandFn,
  }), /local Docker engine/);
  assert.equal(calls, 0);
  await assert.rejects(assertLocalDockerCandidateEngine({ env: {}, runCommandFn }), /local Docker engine/);
  assert.equal(calls, 1);
  for (const endpoint of ['unix:///var/run/docker.sock', 'npipe:////./pipe/dockerDesktopLinuxEngine']) {
    await assertLocalDockerCandidateEngine({ env: { DOCKER_HOST: endpoint },
      runCommandFn: async () => ({ exitCode: 0, stdout: `${endpoint}\n` }) });
  }
});

test('candidate fixture renders without dotenv, generates private credentials, and removes only its verified disposable directory', async (t) => {
  const tempRootDir = await mkdtemp(resolve(tmpdir(), 'candidate-fixture-test-'));
  t.after(() => rm(tempRootDir, { recursive: true, force: true }));
  const calls = [];
  let fixtureRoot;
  const runCommandFn = async (request) => {
    calls.push(request);
    if (request.args[0] === 'context') return { exitCode: 0, stdout: 'unix:///var/run/docker.sock\n' };
    if (request.args[0] === 'compose') return { exitCode: 0, stdout: JSON.stringify(baseline()) };
    return { exitCode: 0, stdout: '' };
  };
  const result = await withDockerCandidateFixture({ env: { PGHOST: 'production', VAPID_PRIVATE_KEY: 'private-operator' },
    tempRootDir, runCommandFn, run: async (context) => {
      fixtureRoot = context.tempRootDir;
      assert.equal(context.processEnv.PGHOST, undefined);
      assert.notEqual(context.processEnv.VAPID_PRIVATE_KEY, 'private-operator');
      assert.match(context.processEnv.HARMONIARR_SECRET_ENCRYPTION_KEY, /^[a-f0-9]{64}$/);
      assert.notEqual(context.smokeAdminCredentials.password, context.smokeRequestTargetCredentials.password);
      assert.ok(context.smokeAdminCredentials.password.length >= 40);
      const composeText = await readFile(context.composeFilePath, 'utf8');
      assert.ok(!composeText.includes(context.processEnv.VAPID_PRIVATE_KEY));
      assert.ok(!composeText.includes(context.processEnv.HARMONIARR_SECRET_ENCRYPTION_KEY));
      assert.ok(!composeText.includes(context.smokeAdminCredentials.password));
      const child = await mkdtemp(resolve(context.tempRootDir, 'harmoniarr-docker-smoke-'));
      const directories = await context.makeDirectoryLayoutFn({ baseDir: child });
      for (const directory of Object.values(directories)) assert.ok((await stat(directory)).isDirectory());
      await assert.rejects(context.makeDirectoryLayoutFn({ baseDir: tempRootDir }), /outside its owned workspace/);
      return { verified: true };
    } });
  assert.deepEqual(result, { verified: true });
  await assert.rejects(stat(fixtureRoot), { code: 'ENOENT' });
  const render = calls.find((call) => call.args[0] === 'compose');
  assert.ok(render.args.includes('--env-file') && render.args.includes('--no-interpolate') && render.args.includes('--no-env-resolution'));
  assert.equal(render.cwd, fixtureRoot);
  assert.deepEqual(calls.slice(-3).map((call) => call.args[0]), ['container', 'network', 'volume']);
  assert.deepEqual(await readdir(tempRootDir), []);
});

test('candidate fixture fails and retains owned files if resource absence cannot be verified', async (t) => {
  const tempRootDir = await mkdtemp(resolve(tmpdir(), 'candidate-fixture-test-'));
  t.after(() => rm(tempRootDir, { recursive: true, force: true }));
  let fixtureRoot;
  await assert.rejects(withDockerCandidateFixture({ env: {}, tempRootDir,
    runCommandFn: async ({ args }) => ({ exitCode: 0, stdout: args[0] === 'context' ? 'unix:///var/run/docker.sock'
      : args[0] === 'compose' ? JSON.stringify(baseline()) : 'owned-container' }),
    run: async ({ tempRootDir: owned }) => { fixtureRoot = owned; return { verified: true }; },
  }), /cleanup could not be verified/);
  assert.ok((await stat(fixtureRoot)).isDirectory());
});
