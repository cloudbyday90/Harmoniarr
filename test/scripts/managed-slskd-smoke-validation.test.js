import assert from 'node:assert/strict';
import test from 'node:test';

import { createDockerSmokeEvidence } from '../../scripts/docker-smoke-evidence.js';
import {
  assertManagedSlskdSmokeResult,
  buildManagedSlskdApiProbeProgram,
  createManagedSlskdSmokeSecrets,
  managedSlskdSmokeValidationKind,
} from '../../scripts/managed-slskd-smoke-contract.js';
import {
  runManagedSlskdSmokeEvidence,
  validateManagedSlskdSmoke,
} from '../../scripts/managed-slskd-smoke-validation.js';
import {
  managedSlskdSmokeEvidencePathEnvVar,
  resolveManagedSlskdSmokeInputs,
} from '../../scripts/validate-managed-slskd-smoke.js';

function createSmokeResult(overrides = {}) {
  return {
    config: {
      fileMode: '600',
      remoteConfigurationDisabled: true,
      rendererExitCode: 0,
    },
    harmoniarr: {
      healthCheckOk: true,
    },
    projectName: 'managed-slskd-test',
    provider: {
      apiPortPublished: false,
      apiProbeStatus: 200,
      egressIsolated: true,
      healthStatus: 'healthy',
    },
    ...overrides,
  };
}

test('createManagedSlskdSmokeSecrets produces separate, valid disposable values', () => {
  let callCount = 0;
  const secrets = createManagedSlskdSmokeSecrets({
    randomBytesFn: () => Buffer.from(`smoke-secret-${String(++callCount).padStart(2, '0')}-0123456789abcdef`),
  });

  assert.equal(Object.keys(secrets).length, 6);
  assert.ok(secrets.slskd_api_key.length >= 16);
  assert.ok(secrets.slskd_jwt_key.length >= 16);
  assert.match(secrets.slskd_soulseek_username, /^harmoniarr-smoke-/u);
  assert.notEqual(secrets.slskd_api_key, secrets.slskd_jwt_key);
});

test('buildManagedSlskdApiProbeProgram reads the mounted key without emitting it', () => {
  const source = buildManagedSlskdApiProbeProgram();

  assert.match(source, /readFile\('\/run\/secrets\/slskd_api_key'/u);
  assert.match(source, /http:\/\/slskd:5030\/api\/v0\/application/u);
  assert.match(source, /'X-API-Key': apiKey/u);
  assert.doesNotMatch(source, /process\.stdout\.write\(apiKey/u);
});

test('assertManagedSlskdSmokeResult rejects a public provider API port', () => {
  assert.throws(
    () => assertManagedSlskdSmokeResult(createSmokeResult({
      provider: {
        ...createSmokeResult().provider,
        apiPortPublished: true,
      },
    })),
    /API port must not be host-published/u,
  );
});

test('resolveManagedSlskdSmokeInputs defaults to a source build and supports evidence paths', () => {
  const inputs = resolveManagedSlskdSmokeInputs({
    args: [],
    env: {
      [managedSlskdSmokeEvidencePathEnvVar]: 'artifacts/managed-slskd-smoke.json',
    },
  });

  assert.deepEqual(inputs, {
    buildImage: true,
    evidencePath: 'artifacts/managed-slskd-smoke.json',
    imageRef: null,
  });
  assert.deepEqual(resolveManagedSlskdSmokeInputs({
    args: ['--image', 'harmoniarr:test', '--no-build'],
    env: {},
  }), {
    buildImage: false,
    evidencePath: null,
    imageRef: 'harmoniarr:test',
  });
});

test('validateManagedSlskdSmoke proves the private, generated-config provider contract and cleans up', async () => {
  const commands = [];
  const cleanup = [];
  const ports = [48100, 48101];
  const writtenSecrets = [];

  const result = await validateManagedSlskdSmoke({
    buildImage: false,
    composeFilePaths: ['compose.yaml', 'compose.slskd-example.yaml', 'compose.slskd-smoke.yaml'],
    createSecretsFn: () => ({
      slskd_api_key: 'managed-api-key-12345',
      slskd_jwt_key: 'managed-jwt-key-12345',
      slskd_soulseek_password: 'soulseek-password',
      slskd_soulseek_username: 'smoke-user',
      slskd_web_password: 'web-password',
      slskd_web_username: 'harmoniarr-smoke',
    }),
    fetchFn: async () => ({
      json: async () => ({ ok: true }),
      ok: true,
      status: 200,
    }),
    generateVapidKeyPairFn: () => ({ privateKey: 'private-vapid-key', publicKey: 'public-vapid-key' }),
    getAvailablePortFn: async () => ports.shift(),
    imageRef: 'harmoniarr:managed-smoke-test',
    makeWorkspaceLayoutFn: async () => ({
      appData: '/tmp/appdata',
      downloads: '/tmp/downloads',
      music: '/tmp/music',
      secrets: '/tmp/secrets',
      slskdAppData: '/tmp/slskd-appdata',
      slskdIncomplete: '/tmp/slskd-incomplete',
      staging: '/tmp/staging',
      transcodeTemp: '/tmp/transcode-temp',
    }),
    mkdtempFn: async () => '/tmp/managed-slskd-smoke',
    processEnv: {},
    projectName: 'managed-smoke-test',
    removeFn: async (path, options) => cleanup.push({ options, path }),
    runCommandFn: async ({ args }) => {
      commands.push(args);
      const serviceName = args.at(-1);

      if (args.includes('up')) return { stdout: '' };
      if (args.includes('down')) return { stdout: '' };
      if (args.includes('ps')) {
        return { stdout: serviceName === 'slskd-config' ? 'config-container\n' : 'provider-container\n' };
      }
      if (args[0] === 'inspect') {
        const containerId = args.at(-1);
        if (containerId === 'config-container') return { stdout: '0|exited\n' };
        if (args.includes('{{json .NetworkSettings.Ports}}')) return { stdout: '{"50300/tcp":[{"HostPort":"48101"}]}\n' };
        return { stdout: 'healthy|running\n' };
      }
      if (args.includes('exec') && args.includes('harmoniarr')) return { stdout: '{"status":200}\n' };
      return { stdout: '' };
    },
    writeSecretsFn: async ({ secretDirectory, secrets }) => writtenSecrets.push({ secretDirectory, secrets }),
  });

  assert.deepEqual(result.config, createSmokeResult().config);
  assert.deepEqual(result.harmoniarr, createSmokeResult().harmoniarr);
  assert.deepEqual(result.provider, createSmokeResult().provider);
  assert.equal(writtenSecrets.length, 1);
  assert.equal(writtenSecrets[0].secrets.slskd_api_key, 'managed-api-key-12345');
  assert.equal(commands.some((args) => args.includes('--wait')), true);
  assert.equal(commands.some((args) => args.includes('--no-build')), true);
  assert.deepEqual(cleanup, [{
    options: { force: true, recursive: true },
    path: '/tmp/managed-slskd-smoke',
  }]);
});

test('runManagedSlskdSmokeEvidence writes a redacted managed-provider evidence record', async () => {
  const result = await runManagedSlskdSmokeEvidence({
    evidencePath: 'artifacts/managed-slskd-smoke.json',
    writeDockerSmokeEvidenceFn: async (options) => {
      const evidence = createDockerSmokeEvidence(options);
      assert.equal(evidence.validationKind, managedSlskdSmokeValidationKind);
      assert.equal('workspaceRoot' in evidence.validationResult, false);
      return { evidencePath: 'C:/repo/artifacts/managed-slskd-smoke.json' };
    },
    fetchFn: async () => ({ json: async () => ({ ok: true }), ok: true, status: 200 }),
    generateVapidKeyPairFn: () => ({ privateKey: 'private-vapid-key', publicKey: 'public-vapid-key' }),
    getAvailablePortFn: async () => 48100,
    makeWorkspaceLayoutFn: async () => ({
      appData: '/tmp/appdata', downloads: '/tmp/downloads', music: '/tmp/music', secrets: '/tmp/secrets', slskdAppData: '/tmp/slskd-appdata', slskdIncomplete: '/tmp/slskd-incomplete', staging: '/tmp/staging', transcodeTemp: '/tmp/transcode-temp',
    }),
    mkdtempFn: async () => '/tmp/managed-slskd-smoke',
    processEnv: {},
    projectName: 'managed-smoke-evidence',
    removeFn: async () => {},
    runCommandFn: async ({ args }) => {
      if (args.includes('ps')) return { stdout: args.at(-1) === 'slskd-config' ? 'config-container\n' : 'provider-container\n' };
      if (args[0] === 'inspect') {
        if (args.at(-1) === 'config-container') return { stdout: '0|exited\n' };
        if (args.includes('{{json .NetworkSettings.Ports}}')) return { stdout: '{"50300/tcp":null}\n' };
        return { stdout: 'healthy|running\n' };
      }
      if (args.includes('exec') && args.includes('harmoniarr')) return { stdout: '{"status":200}\n' };
      return { stdout: '' };
    },
    writeSecretsFn: async () => {},
  });

  assert.equal(result.evidencePath, 'C:/repo/artifacts/managed-slskd-smoke.json');
});
