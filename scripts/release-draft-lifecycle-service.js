/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createReleaseDraftClient } from './release-draft-lifecycle-client.js';
import { withValidatedReleaseAssets } from './release-draft-lifecycle-assets.js';
import { assertOwnedRelease, assertReleaseAssetInventory, normalizeReleaseDraftInputs } from './release-draft-lifecycle-policy.js';

export function createReleaseDraftLifecycleService({ releaseClient = createReleaseDraftClient(), withAssetsFn = withValidatedReleaseAssets } = {}) {
  async function prepareRelease(options) {
    try {
      const inputs = normalizeReleaseDraftInputs(options);
      await releaseClient.assertImmutablePolicy(inputs);
      await releaseClient.resolveTag(inputs);
      const matches = await releaseClient.findReleases(inputs);
      if (matches.length > 1) throw new Error('Conflicting release drafts exist');
      const release = matches.length ? assertOwnedRelease(matches[0], inputs) : await releaseClient.createDraft(inputs);
      assertOwnedRelease(release, inputs);
      await releaseClient.resolveTag(inputs);
      assertOwnedRelease(await releaseClient.getRelease({ ...inputs, releaseId: release.id }), { ...inputs, releaseId: release.id });
      return { releaseId: release.id, draft: true, sourceRevision: inputs.revision, reusedDraft: matches.length === 1 };
    } catch {
      throw new Error('Release draft preparation failed; no release publication was authorized');
    }
  }
  async function finalizeRelease({ assetDirectory, imageRef, ...options }) {
    let stage = 'prepublication checks';
    try {
      const inputs = normalizeReleaseDraftInputs(options);
      if (inputs.releaseId === null) throw new Error('An owned release identifier is required');
      await releaseClient.assertImmutablePolicy(inputs);
      await releaseClient.resolveTag(inputs);
      let release = assertOwnedRelease(await releaseClient.getRelease(inputs), inputs);
      return await withAssetsFn({ assetDirectory, imageRef, inputs, run: async (assets) => {
        const initialAssets = await releaseClient.listAssets(inputs);
        const present = assertReleaseAssetInventory(initialAssets, assets);
        stage = 'draft asset staging';
        for (const asset of assets) {
          if (present.has(asset.name)) continue;
          await releaseClient.resolveTag(inputs);
          release = assertOwnedRelease(await releaseClient.getRelease(inputs), inputs);
          await releaseClient.uploadAsset({ ...inputs, release, asset });
          assertReleaseAssetInventory(await releaseClient.listAssets(inputs), assets);
        }
        stage = 'final publication checks';
        await releaseClient.assertImmutablePolicy(inputs);
        await releaseClient.resolveTag(inputs);
        assertOwnedRelease(await releaseClient.getRelease(inputs), inputs);
        assertReleaseAssetInventory(await releaseClient.listAssets(inputs), assets, { complete: true });
        stage = 'publication and immutable verification';
        assertOwnedRelease(await releaseClient.publishDraft(inputs), inputs, { published: true });
        const published = assertOwnedRelease(await releaseClient.getRelease(inputs), inputs, { published: true });
        await releaseClient.resolveTag(inputs);
        assertReleaseAssetInventory(await releaseClient.listAssets(inputs), assets, { complete: true });
        await releaseClient.verifyPublishedRelease(inputs);
        return { schemaVersion: 1, validationKind: 'immutable-release-publication', status: 'passed',
          releaseId: inputs.releaseId, repository: inputs.repository, releaseTag: inputs.releaseTag,
          sourceRevision: inputs.revision, imageRef, draft: false, published: true, immutable: true,
          releaseAttestationVerified: true, prerelease: inputs.isPrerelease, publishedAt: published.published_at,
          assets: assets.map(({ name, size, sha256 }) => ({ name, size, sha256 })) };
      } });
    } catch {
      throw new Error(`Release finalization failed during ${stage}; publication may require manual inspection and no success evidence was produced`);
    }
  }
  return { prepareRelease, finalizeRelease };
}
