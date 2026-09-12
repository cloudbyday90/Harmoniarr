/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createReleaseImageTagCommand } from '../../scripts/release-image-tag-command.js';
import { promoteReleaseImageTags } from '../../scripts/release-image-tag-service.js';
import { verifyReleaseImageManifestBytes } from '../../scripts/release-image-manifest-policy.js';

const raw = Buffer.from('{"schemaVersion":2,"mediaType":"application/vnd.oci.image.index.v1+json","manifests":[{"digest":"sha256:'
  + 'a'.repeat(64) + '","size":100}]}');
const digest = `sha256:${createHash('sha256').update(raw).digest('hex')}`;
const options = { repository: 'cloudbyday90/Harmoniarr', releaseTag: 'v1.2.3', revision: 'b'.repeat(40),
  imageRef: `ghcr.io/cloudbyday90/harmoniarr@${digest}`, dockerHubImageName: 'cloudbyday90/harmoniarr' };

test('promotion verifies every source first, carbon-copies accepted manifests and rechecks every alias', async () => {
  const calls = [];
  const env = { DOCKER_CONFIG: 'test-config' };
  const result = await promoteReleaseImageTags(options, { env, getNow: () => new Date('2026-09-12T15:00:00.000Z'),
    runCommandFn: async ({ args, env: childEnv }) => {
      assert.equal(childEnv, env);
      calls.push(args);
      return { exitCode: 0, stdout: args[2] === 'inspect' ? raw : Buffer.from('PRIVATE_DIAGNOSTIC_FIXTURE') };
    },
  });
  assert.deepEqual(calls.slice(0, 2).map((args) => args.at(-1)), [options.imageRef, `cloudbyday90/harmoniarr@${digest}`]);
  const writes = calls.filter((args) => args[2] === 'create');
  assert.equal(writes.length, 6);
  for (const args of writes) {
    assert.deepEqual(args.slice(0, 5), ['buildx', 'imagetools', 'create', '--prefer-index=false', '--tag']);
    assert.equal(args.length, 7);
    assert.equal(args[5].slice(0, args[5].lastIndexOf(':')), args[6].split('@')[0]);
    const index = calls.indexOf(args);
    assert.equal(calls[index + 1][2], 'inspect');
    assert.equal(calls[index + 1].at(-1), args[5]);
  }
  assert.deepEqual(calls.slice(-6).map((args) => args.at(-1)), writes.map((args) => args[5]));
  assert.equal(result.sourceDigestsVerified, true);
  assert.equal(result.aliasesVerified, true);
  assert.equal(JSON.stringify(result).includes('PRIVATE_'), false);
});

test('an absent or mismatched mirror stops promotion before any alias writes', async () => {
  for (const unavailable of [false, true]) {
    const calls = [];
    await assert.rejects(promoteReleaseImageTags(options, { runCommandFn: async ({ args }) => {
      calls.push(args);
      if (args.at(-1).startsWith('cloudbyday90/')) {
        if (unavailable) throw new Error('PRIVATE_AUTH_FAILURE');
        return { exitCode: 0, stdout: Buffer.concat([raw, Buffer.from('\n')]) };
      }
      return { exitCode: 0, stdout: raw };
    } }), /source verification/u);
    assert.equal(calls.some((args) => args[2] === 'create'), false);
  }
});

test('partial promotion failures produce no passed result and never delete or roll back tags', async () => {
  const calls = [];
  let writes = 0;
  await assert.rejects(promoteReleaseImageTags(options, { runCommandFn: async ({ args }) => {
    calls.push(args);
    if (args[2] === 'create' && ++writes === 2) throw new Error('PRIVATE_REGISTRY_FAILURE');
    return { exitCode: 0, stdout: raw };
  } }), (error) => error.message.includes('aliases may have changed') && !error.message.includes('PRIVATE_'));
  assert.equal(writes, 2);
  assert.ok(calls.every((args) => ['inspect', 'create'].includes(args[2])));
});

test('the final read detects alias drift after earlier per-tag checks passed', async () => {
  const counts = new Map();
  let writes = 0;
  await assert.rejects(promoteReleaseImageTags(options, { runCommandFn: async ({ args }) => {
    if (args[2] === 'create') writes += 1;
    const reference = args.at(-1);
    if (args[2] === 'inspect') counts.set(reference, (counts.get(reference) ?? 0) + 1);
    const changed = reference.endsWith(':1.2.3') && counts.get(reference) === 2;
    return { exitCode: 0, stdout: changed ? Buffer.concat([raw, Buffer.from('\n')]) : raw };
  } }), /final alias verification/u);
  assert.equal(writes, 6);
});

test('manifest verification hashes exact Buffer bytes without trimming or serializing', () => {
  assert.equal(verifyReleaseImageManifestBytes({ exitCode: 0, stdout: raw }, digest), digest);
  for (const stdout of [raw.toString(), Buffer.concat([raw, Buffer.from('\n')]), Buffer.from(JSON.stringify(JSON.parse(raw), null, 2))]) {
    assert.throws(() => verifyReleaseImageManifestBytes({ exitCode: 0, stdout }, digest));
  }
  assert.throws(() => verifyReleaseImageManifestBytes({ exitCode: 1, stdout: raw }, digest));
});

for (const mediaType of ['application/vnd.oci.image.manifest.v1+json', 'application/vnd.docker.distribution.manifest.v2+json']) {
  test(`manifest verification permits unchanged ${mediaType}`, () => {
    const bytes = Buffer.from(JSON.stringify({ schemaVersion: 2, mediaType, config: { digest: `sha256:${'c'.repeat(64)}` }, layers: [] }));
    const expected = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    assert.equal(verifyReleaseImageManifestBytes({ exitCode: 0, stdout: bytes }, expected), expected);
  });
}

test('manifest verification refuses unrelated artifact types and oversized buffers', () => {
  const bytes = Buffer.from('{"schemaVersion":2,"mediaType":"application/vnd.oci.artifact.manifest.v1+json"}');
  assert.throws(() => verifyReleaseImageManifestBytes({ exitCode: 0, stdout: bytes }, `sha256:${createHash('sha256').update(bytes).digest('hex')}`));
  assert.throws(() => verifyReleaseImageManifestBytes({ exitCode: 0, stdout: Buffer.alloc(4_194_305) }, digest));
});

test('native tag commands preserve raw buffers, hide windows and reject rewrite or rebuild flags', async () => {
  const run = createReleaseImageTagCommand({ execFileFn: async (command, args, execution) => {
    assert.equal(command, 'docker'); assert.equal(execution.encoding, 'buffer');
    assert.equal(execution.shell, false); assert.equal(execution.windowsHide, true);
    assert.equal(execution.maxBuffer, 4_194_304); assert.equal(execution.timeout, 120_000);
    return { stdout: raw, stderr: Buffer.from('PRIVATE_FIXTURE') };
  } });
  assert.deepEqual(await run({ args: ['buildx', 'imagetools', 'inspect', '--raw', options.imageRef] }), { exitCode: 0, stdout: raw });
  for (const args of [['build', '.'], ['buildx', 'imagetools', 'create', '--append', '--tag', 'target', 'source'],
    ['buildx', 'imagetools', 'create', '--prefer-index=false', '--tag', 'target', 'source', '--annotation', 'evil'],
    ['buildx', 'imagetools', 'inspect', '--format', '{{json .Manifest}}', 'source']]) {
    await assert.rejects(run({ args }), /Only bounded/u);
  }
});
