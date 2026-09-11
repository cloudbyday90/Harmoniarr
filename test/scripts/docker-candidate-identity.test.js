import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDistinctCandidateImages, parseCandidateImageReference, resolveCandidateImage, verifyCandidateContainerImage } from '../../scripts/docker-candidate-identity.js';
import { createCandidateDockerCommand } from '../../scripts/docker-candidate-command.js';

const imageId = `sha256:${'a'.repeat(64)}`;
const revision = 'b'.repeat(40);
const registryRef = `ghcr.io/cloudbyday90/harmoniarr@${imageId}`;
const identity = { imageId, os: 'linux', architecture: 'amd64', revision };
const hardened = { readOnly: true, privileged: false, user: '1000:1000', capDrop: ['ALL'],
  securityOpt: ['no-new-privileges:true'], ports: { '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: '31000' }] } };
const fixtureEnv = { HARMONIARR_PORT: '31000' };

test('strict candidate inputs reject mutable tags, ambiguous IDs and unsafe references', () => {
  for (const reference of ['harmoniarr:latest', 'sha256:abcd', imageId, ` ${registryRef}`, `${registryRef}\n`, `https://${registryRef}`, '--help', `repo@sha256:${'A'.repeat(64)}`]) {
    assert.throws(() => parseCandidateImageReference(reference));
  }
  assert.equal(parseCandidateImageReference(registryRef).kind, 'registry-digest');
  assert.equal(parseCandidateImageReference(imageId, { allowLocalImages: true }).kind, 'local-image');
});

test('registry identity is pulled once and resolved to an inspected platform and revision', async () => {
  const calls = [];
  const resolved = await resolveCandidateImage({ reference: registryRef, revision,
    runCommandFn: async (input) => { calls.push(input); return { stdout: JSON.stringify(identity) }; } });
  assert.deepEqual(calls[0].args, ['pull', registryRef]);
  assert.equal(calls[1].args.at(-1), registryRef);
  assert.deepEqual(resolved, { reference: registryRef, kind: 'registry-digest', imageId, platform: 'linux/amd64', platformManifestDigest: null, revision });
});

test('local identities never pull and mismatched labels, IDs or unsupported platforms fail', async () => {
  for (const observed of [{ ...identity, revision: null }, { ...identity, revision: 'c'.repeat(40) },
    { ...identity, imageId: `sha256:${'d'.repeat(64)}` }, { ...identity, architecture: '386' }, { ...identity, os: 'windows' }]) {
    const calls = [];
    await assert.rejects(resolveCandidateImage({ reference: imageId, revision, allowLocalImages: true,
      runCommandFn: async ({ args }) => { calls.push(args); return { stdout: JSON.stringify(observed) }; } }));
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'image');
  }
  await assert.rejects(resolveCandidateImage({ reference: imageId, revision: 'main', allowLocalImages: true }), /commit SHA/);
});

test('upgrade identity requires distinct artifacts and commits on the same platform', () => {
  const baseline = { imageId, platform: 'linux/amd64', revision };
  const candidate = { ...baseline, imageId: `sha256:${'c'.repeat(64)}`, revision: 'd'.repeat(40) };
  assert.doesNotThrow(() => assertDistinctCandidateImages({ baseline, candidate }));
  for (const invalid of [baseline, { ...candidate, revision }, { ...candidate, platform: 'linux/arm64' }]) {
    assert.throws(() => assertDistinctCandidateImages({ baseline, candidate: invalid }));
  }
});

test('runtime identity binds the actual container to the resolved artifact', async () => {
  const expectedImage = { imageId, platform: 'linux/amd64' };
  const run = (actual, hardening = hardened) => verifyCandidateContainerImage({ composeArgs: ['compose'], expectedImage, env: fixtureEnv,
    runCommandFn: async ({ args }) => ({ stdout: args[0] === 'compose' ? 'c'.repeat(64) : JSON.stringify({ image: actual, ...hardening }) }) });
  assert.equal((await run(imageId)).imageVerified, true);
  await assert.rejects(run(`sha256:${'d'.repeat(64)}`), /running container/);
  for (const override of [{ readOnly: false }, { privileged: true }, { user: '0:0' }, { capDrop: [] }, { securityOpt: [] }]) {
    await assert.rejects(run(imageId, { ...hardened, ...override }), /hardening/);
  }
  for (const ports of [{ '3000/tcp': [] }, { '3000/tcp': [{ HostIp: '0.0.0.0', HostPort: '31000' }] },
    { ...hardened.ports, '5432/tcp': [] }, { '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: '31001' }] }]) {
    await assert.rejects(run(imageId, { ...hardened, ports }), /loopback/);
  }
  await assert.rejects(verifyCandidateContainerImage({ composeArgs: ['compose'], expectedImage,
    runCommandFn: async () => ({ stdout: `${'c'.repeat(64)}\n${'d'.repeat(64)}` }) }), /exactly one/);
});

test('containerd index, platform manifest and configuration IDs remain distinct', async () => {
  const manifest = `sha256:${'c'.repeat(64)}`;
  const configuration = `sha256:${'d'.repeat(64)}`;
  const descriptor = { digest: manifest, mediaType: 'application/vnd.oci.image.manifest.v1+json',
    platform: { os: 'linux', architecture: 'amd64' } };
  const resolved = await resolveCandidateImage({ reference: imageId, revision, allowLocalImages: true,
    runCommandFn: async ({ args }) => ({ stdout: JSON.stringify(args.includes('--platform') ? descriptor :
      { ...identity, descriptor: { digest: imageId, mediaType: 'application/vnd.oci.image.index.v1+json' } }) }) });
  assert.equal(resolved.imageId, imageId);
  assert.equal(resolved.platformManifestDigest, manifest);
  const verify = (actualDescriptor) => verifyCandidateContainerImage({ composeArgs: ['compose'], expectedImage: resolved, env: fixtureEnv,
    runCommandFn: async ({ args }) => ({ stdout: args[0] === 'compose' ? 'e'.repeat(64) :
      JSON.stringify({ image: configuration, descriptor: actualDescriptor, ...hardened }) }) });
  assert.equal((await verify(descriptor)).containerImageId, configuration);
  await assert.rejects(verify({ ...descriptor, digest: imageId }), /resolved immutable/);
  await assert.rejects(verify({ ...descriptor, platform: { os: 'linux', architecture: 'arm64' } }), /resolved immutable/);
  await assert.rejects(verify(null), /resolved immutable/);
});

test('candidate commands bound execution and redact failed process output', async () => {
  const secret = 'fixture-password-must-never-escape';
  const runCommand = createCandidateDockerCommand({ execFileFn: async (_file, _args, options) => {
    assert.equal(options.shell, false);
    assert.equal(options.windowsHide, true);
    assert.equal(options.maxBuffer, 4_194_304);
    assert.ok(options.timeout > 0);
    throw Object.assign(new Error(secret), { code: 2, stdout: secret, stderr: secret });
  } });
  await assert.rejects(runCommand({ command: 'docker', args: ['compose', secret] }), (error) => !error.message.includes(secret));
  const expected = await runCommand({ command: 'docker', args: ['compose'], expectedExitCodes: [2] });
  assert.equal(expected.exitCode, 2);
  await assert.rejects(runCommand({ command: 'sh', args: [] }), /only executes Docker/);
});
