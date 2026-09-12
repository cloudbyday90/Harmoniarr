/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { withValidatedReleaseAssets } from '../../scripts/release-draft-lifecycle-assets.js';
import { normalizeReleaseDraftInputs } from '../../scripts/release-draft-lifecycle-policy.js';
import { defaultReleaseAssetNames } from '../../scripts/release-contract.js';
import { writeReleaseMetadataFiles } from '../../scripts/release-metadata.js';

const inputs = normalizeReleaseDraftInputs({ repository: 'cloudbyday90/Harmoniarr', releaseTag: 'v1.2.3-beta', revision: 'a'.repeat(40) });
const imageRef = `${inputs.imageName}@sha256:${'b'.repeat(64)}`;

async function createFiles(directory) {
  await writeReleaseMetadataFiles({ directory, digest: `sha256:${'b'.repeat(64)}`, imageName: inputs.imageName,
    releaseTag: inputs.releaseTag, repository: inputs.repository, version: inputs.version,
    tagsText: `${inputs.imageName}:${inputs.version}\n${inputs.imageName}:${inputs.releaseTag}` });
  await writeFile(join(directory, defaultReleaseAssetNames.sbom), JSON.stringify({ spdxVersion: 'SPDX-2.3', SPDXID: 'SPDXRef-DOCUMENT', packages: [] }));
}

test('all four validated release assets use private immutable snapshots and clean up afterward', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-release-assets-test-'));
  let paths;
  try {
    await createFiles(directory);
    await withValidatedReleaseAssets({ inputs, imageRef, assetDirectory: directory, run: async (assets) => {
      paths = assets.map((asset) => asset.path);
      assert.deepEqual(assets.map((asset) => asset.name), Object.values(defaultReleaseAssetNames));
      await writeFile(join(directory, defaultReleaseAssetNames.metadata), 'changed original file');
      for (const asset of assets) {
        const bytes = await readFile(asset.path);
        assert.equal(bytes.length, asset.size);
        assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
      }
    } });
    for (const path of paths) await assert.rejects(stat(path), { code: 'ENOENT' });
  } finally { await rm(directory, { force: true, recursive: true }); }
});

for (const [label, change] of [
  ['empty SBOM', async (directory) => writeFile(join(directory, defaultReleaseAssetNames.sbom), '')],
  ['invalid SPDX document', async (directory) => writeFile(join(directory, defaultReleaseAssetNames.sbom), '{}')],
  ['changed Compose image', async (directory) => writeFile(join(directory, defaultReleaseAssetNames.composeOverride), 'services: {}')],
  ['changed verification instructions', async (directory) => writeFile(join(directory, defaultReleaseAssetNames.verification), 'unverified instructions')],
  ['missing metadata', async (directory) => rm(join(directory, defaultReleaseAssetNames.metadata))],
]) {
  test(`release assets reject ${label} before any upload callback`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-release-assets-test-'));
    try {
      await createFiles(directory);
      await change(directory);
      await assert.rejects(withValidatedReleaseAssets({ inputs, imageRef, assetDirectory: directory,
        run: async () => { assert.fail('Invalid assets must not reach uploads'); } }));
    } finally { await rm(directory, { force: true, recursive: true }); }
  });
}

test('release metadata must match the expected immutable build digest', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-release-assets-test-'));
  try {
    await createFiles(directory);
    await assert.rejects(withValidatedReleaseAssets({ inputs, imageRef: `${inputs.imageName}@sha256:${'c'.repeat(64)}`,
      assetDirectory: directory, run: async () => { assert.fail('A substituted image must not be staged'); } }));
  } finally { await rm(directory, { force: true, recursive: true }); }
});
