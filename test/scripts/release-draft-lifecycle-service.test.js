/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultReleaseAssetNames } from '../../scripts/release-contract.js';
import { normalizeReleaseDraftInputs } from '../../scripts/release-draft-lifecycle-policy.js';
import { createReleaseDraftLifecycleService } from '../../scripts/release-draft-lifecycle-service.js';

const options = { repository: 'cloudbyday90/Harmoniarr', releaseTag: 'v0.1.0-beta', revision: 'a'.repeat(40) };
const finalizeOptions = { ...options, releaseId: 42, assetDirectory: 'assets',
  imageRef: `ghcr.io/cloudbyday90/harmoniarr@sha256:${'b'.repeat(64)}` };
const assets = Object.values(defaultReleaseAssetNames).map((name, index) => ({ name, size: 100 + index,
  sha256: String(index).repeat(64), path: `snapshot/${name}` }));
const remote = (asset, index = 0) => ({ id: index + 100, name: asset.name, state: 'uploaded', size: asset.size, digest: `sha256:${asset.sha256}` });

function fixture({ existing = false, changeRelease, initialAssets = [], failAt, failNth = null, afterPublish, invalidAssets = false } = {}) {
  const inputs = normalizeReleaseDraftInputs(options);
  const calls = [];
  const release = { id: 42, tag_name: options.releaseTag, target_commitish: options.revision,
    body: inputs.marker, draft: true, prerelease: true, immutable: false };
  changeRelease?.(release);
  let remoteAssets = initialAssets;
  const call = (name) => {
    calls.push(name);
    if (failAt === name && (failNth === null || calls.filter((entry) => entry === name).length === failNth)
      || failAt === 'postPublicationTag' && name === 'tag' && !release.draft) throw new Error('PRIVATE_FAULT_FIXTURE');
  };
  const releaseClient = {
    async assertImmutablePolicy() { call('policy'); },
    async resolveTag() { call('tag'); },
    async findReleases() { call('find'); return existing ? [release] : []; },
    async createDraft(input) { call('create'); assert.equal(input.isPrerelease, true); return release; },
    async getRelease() { call('get'); return release; },
    async listAssets() { call('listAssets'); return remoteAssets; },
    async uploadAsset({ asset }) { call('upload'); remoteAssets = [...remoteAssets, remote(asset, remoteAssets.length)]; },
    async publishDraft(input) {
      call('publish'); assert.equal(input.isPrerelease, true);
      release.draft = false; release.immutable = true; release.published_at = '2026-09-12T15:00:00Z';
      afterPublish?.(release);
      return release;
    },
    async verifyPublishedRelease() { call('verify'); },
  };
  const service = createReleaseDraftLifecycleService({ releaseClient,
    withAssetsFn: async ({ run }) => { call('validateAssets'); if (invalidAssets) throw new Error('Bad local assets'); return run(assets); },
  });
  return { service, calls, release };
}

test('draft preparation checks immutability and the pre-existing tag before creation', async () => {
  const current = fixture();
  assert.deepEqual(await current.service.prepareRelease(options), { releaseId: 42, draft: true,
    sourceRevision: options.revision, reusedDraft: false });
  assert.deepEqual(current.calls, ['policy', 'tag', 'find', 'create', 'tag', 'get']);
});

test('owned draft preparation resumes with preserved operator release notes', async () => {
  const current = fixture({ existing: true, changeRelease: (release) => { release.body = `Release notes\n\n${release.body}\nMore notes`; } });
  assert.equal((await current.service.prepareRelease(options)).reusedDraft, true);
  assert.equal(current.calls.includes('create'), false);
  assert.ok(current.release.body.includes('More notes'));
});

for (const [label, overrides] of [
  ['disabled or inaccessible immutability', { failAt: 'policy' }],
  ['missing or changed pre-existing tag', { failAt: 'tag' }],
  ['published release', { existing: true, changeRelease: (release) => { release.draft = false; } }],
  ['foreign draft', { existing: true, changeRelease: (release) => { release.body = 'unowned'; } }],
  ['duplicate ownership markers', { existing: true, changeRelease: (release) => { release.body += release.body; } }],
  ['wrong source identity', { existing: true, changeRelease: (release) => { release.target_commitish = 'main'; } }],
]) {
  test(`preparation refuses ${label} before any release write`, async () => {
    const current = fixture(overrides);
    await assert.rejects(current.service.prepareRelease(options), /preparation failed/u);
    assert.equal(current.calls.includes('create'), false);
    assert.equal(current.calls.includes('publish'), false);
  });
}

test('finalization validates all assets, stages exact bytes, and verifies immutable publication', async () => {
  const current = fixture();
  const result = await current.service.finalizeRelease(finalizeOptions);
  assert.equal(result.immutable, true);
  assert.equal(result.releaseAttestationVerified, true);
  assert.equal(result.prerelease, true);
  assert.equal(result.imageRef, finalizeOptions.imageRef);
  assert.equal(result.assets.length, 4);
  assert.equal(current.calls.filter((name) => name === 'upload').length, 4);
  assert.ok(current.calls.indexOf('validateAssets') < current.calls.indexOf('upload'));
  assert.equal(current.calls.filter((name) => name === 'policy').length, 2);
  assert.ok(current.calls.lastIndexOf('upload') < current.calls.indexOf('publish'));
  assert.ok(current.calls.lastIndexOf('tag') > current.calls.indexOf('publish'));
  assert.equal(current.calls.at(-1), 'verify');
  assert.equal(JSON.stringify(result).includes('snapshot/'), false);
});

test('finalization resumes only identical staged assets and never reuploads them', async () => {
  const current = fixture({ initialAssets: assets.slice(0, 2).map(remote) });
  await current.service.finalizeRelease(finalizeOptions);
  assert.equal(current.calls.filter((name) => name === 'upload').length, 2);
});

for (const [label, entry] of [
  ['different bytes', { ...remote(assets[0]), digest: `sha256:${'f'.repeat(64)}` }],
  ['unknown digest', { ...remote(assets[0]), digest: null }],
  ['unfinished upload', { ...remote(assets[0]), state: 'starter' }],
  ['unexpected file', { ...remote(assets[0]), name: 'extra.txt' }],
]) {
  test(`finalization refuses ${label} without uploading or publishing`, async () => {
    const current = fixture({ initialAssets: [entry] });
    await assert.rejects(current.service.finalizeRelease(finalizeOptions), /finalization failed/u);
    assert.equal(current.calls.includes('upload'), false);
    assert.equal(current.calls.includes('publish'), false);
  });
}

test('invalid local assets and failed upload retain an unpublished draft', async () => {
  for (const overrides of [{ invalidAssets: true }, { failAt: 'upload' }]) {
    const current = fixture(overrides);
    await assert.rejects(current.service.finalizeRelease(finalizeOptions), (error) => !error.message.includes('PRIVATE_'));
    assert.equal(current.release.draft, true);
    assert.equal(current.calls.includes('publish'), false);
  }
});

for (const [label, failAt, failNth] of [['disabled immutable setting', 'policy', 2], ['changed release tag', 'tag', 6]]) {
  test(`finalization refuses ${label} after staging and leaves all assets unpublished`, async () => {
    const current = fixture({ failAt, failNth });
    await assert.rejects(current.service.finalizeRelease(finalizeOptions), /final publication checks/u);
    assert.equal(current.calls.filter((name) => name === 'upload').length, 4);
    assert.equal(current.calls.includes('publish'), false);
    assert.equal(current.release.draft, true);
  });
}

for (const [label, overrides] of [
  ['mutable publication response', { afterPublish: (release) => { release.immutable = false; } }],
  ['postpublication tag drift', { failAt: 'postPublicationTag' }],
  ['release attestation failure', { failAt: 'verify' }],
]) {
  test(`finalization reports ${label} as a failure requiring inspection`, async () => {
    const current = fixture(overrides);
    await assert.rejects(current.service.finalizeRelease(finalizeOptions), /manual inspection/u);
    assert.equal(current.calls.includes('publish'), true);
  });
}
