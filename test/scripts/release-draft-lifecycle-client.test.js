/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createReleaseDraftClient } from '../../scripts/release-draft-lifecycle-client.js';
import { createReleaseDraftCommand } from '../../scripts/release-draft-lifecycle-command.js';
import { normalizeReleaseDraftInputs } from '../../scripts/release-draft-lifecycle-policy.js';

const inputs = normalizeReleaseDraftInputs({ repository: 'cloudbyday90/Harmoniarr', releaseTag: 'v1.2.3-beta', revision: 'a'.repeat(40), releaseId: 42 });

test('release client confines the policy token to the read-only settings probe and never clobbers assets', async () => {
  const calls = [];
  const client = createReleaseDraftClient({ env: { GH_TOKEN: 'WRITE_FIXTURE', GITHUB_TOKEN: 'FALLBACK_FIXTURE',
    HARMONIARR_RELEASE_POLICY_TOKEN: 'READ_POLICY_FIXTURE' }, runCommandFn: async (options) => {
    calls.push(options);
    return { exitCode: 0, stdout: JSON.stringify(options.args.at(-1).endsWith('immutable-releases') ? { enabled: true } : { verified: true }) };
  } });
  await client.assertImmutablePolicy(inputs);
  await client.createDraft(inputs);
  await client.publishDraft(inputs);
  await client.uploadAsset({ ...inputs, release: { upload_url: 'https://uploads.github.com/repos/cloudbyday90/Harmoniarr/releases/42/assets{?name,label}' },
    asset: { name: 'harmoniarr-release.spdx.json', path: 'snapshot/file.json' } });
  await client.verifyPublishedRelease(inputs);

  assert.equal(calls[0].env.GH_TOKEN, 'READ_POLICY_FIXTURE');
  assert.equal(Object.hasOwn(calls[0].env, 'GITHUB_TOKEN'), false);
  assert.equal(calls[0].args[calls[0].args.indexOf('--method') + 1], 'GET');
  for (const call of calls.slice(1)) {
    assert.equal(call.env.GH_TOKEN, 'WRITE_FIXTURE');
    assert.equal(Object.hasOwn(call.env, 'HARMONIARR_RELEASE_POLICY_TOKEN'), false);
    assert.equal(call.args.includes('--clobber'), false);
    assert.equal(call.args.includes('DELETE'), false);
  }
  assert.ok(calls[1].args.includes('draft=true'));
  assert.ok(calls[1].args.includes('prerelease=true'));
  assert.ok(calls[1].args.includes('make_latest=false'));
  assert.ok(calls[2].args.includes('draft=false'));
  assert.ok(calls[2].args.includes('make_latest=false'));
  assert.ok(calls[3].args.at(-1).endsWith('?name=harmoniarr-release.spdx.json'));
  assert.deepEqual(calls[4].args, ['release', 'verify', inputs.releaseTag, '--repo', 'github.com/cloudbyday90/Harmoniarr', '--format', 'json']);
});

test('release client rejects unavailable policy and untrusted upload endpoints', async () => {
  let calls = 0;
  const client = createReleaseDraftClient({ env: {}, runCommandFn: async () => { calls += 1; return { exitCode: 0, stdout: '{}' }; } });
  await assert.rejects(client.assertImmutablePolicy(inputs), /policy token/u);
  for (const upload_url of ['https://evil.example/assets{?name,label}',
    'https://uploads.github.com/repos/cloudbyday90/Harmoniarr/releases/43/assets{?name,label}']) {
    await assert.rejects(client.uploadAsset({ ...inputs, release: { upload_url }, asset: { name: 'file', path: 'file' } }), /endpoint/u);
  }
  assert.equal(calls, 0);
});

test('release client resolves annotated tags and bounds draft listings', async () => {
  let pages = 0;
  const client = createReleaseDraftClient({ env: {}, runCommandFn: async ({ args }) => {
    const path = args.at(-1);
    if (path.includes('/releases?')) pages += 1;
    const result = path.includes('/git/ref/') ? { ref: `refs/tags/${inputs.releaseTag}`, object: { type: 'tag', sha: 'b'.repeat(40) } }
      : path.includes('/git/tags/') ? { sha: 'b'.repeat(40), object: { type: 'commit', sha: inputs.revision } }
        : Array.from({ length: 100 }, (_, index) => ({ tag_name: `v${index}` }));
    return { exitCode: 0, stdout: JSON.stringify(result) };
  } });
  await client.resolveTag(inputs);
  await assert.rejects(client.findReleases(inputs), /bounded/u);
  assert.equal(pages, 5);
});

test('release subprocess failures are bounded, hidden and sanitized', async () => {
  const run = createReleaseDraftCommand({ execFileFn: async (command, args, options) => {
    assert.equal(command, 'gh'); assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
    assert.equal(options.timeout, 60_000); assert.equal(options.maxBuffer, 2_097_152);
    throw new Error('PRIVATE_TOKEN_FIXTURE');
  } });
  await assert.rejects(run({ args: ['api', '--method', 'GET', 'repos/example/repo'] }),
    (error) => !error.message.includes('PRIVATE_'));
});
