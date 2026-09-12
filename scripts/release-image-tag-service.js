/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createReleaseImageTagCommand } from './release-image-tag-command.js';
import { createReleaseImagePromotionPlan, projectReleaseImagePromotion } from './release-image-tag-plan.js';
import { verifyReleaseImageManifestBytes } from './release-image-manifest-policy.js';

export async function promoteReleaseImageTags(options, {
  env = process.env, runCommandFn = createReleaseImageTagCommand(), getNow = () => new Date(),
} = {}) {
  let stage = 'source verification';
  try {
    const plan = createReleaseImagePromotionPlan(options);
    async function inspect(reference) {
      verifyReleaseImageManifestBytes(await runCommandFn({ env,
        args: ['buildx', 'imagetools', 'inspect', '--raw', reference] }), plan.digest);
    }
    // Preflight every registry first; a missing or mismatched mirror must not
    // cause a partially promoted canonical release before any writes begin.
    for (const source of plan.sources) await inspect(source.source);
    stage = 'alias promotion';
    for (const source of plan.sources) {
      for (const target of source.targets) {
        const result = await runCommandFn({ env,
          args: ['buildx', 'imagetools', 'create', '--prefer-index=false', '--tag', target, source.source] });
        if (result?.exitCode !== 0) throw new Error('Image tag promotion failed');
        await inspect(target);
      }
    }
    stage = 'final alias verification';
    for (const source of plan.sources) for (const target of source.targets) await inspect(target);
    return projectReleaseImagePromotion({ schemaVersion: 1, validationKind: 'release-image-tag-promotion', status: 'passed',
      repository: plan.repository, releaseTag: plan.releaseTag, sourceRevision: plan.sourceRevision,
      imageRef: plan.imageRef, digest: plan.digest, sourceDigestsVerified: true, aliasesVerified: true,
      registries: plan.sources.map((source) => ({ registry: source.registry, source: source.source,
        digest: plan.digest, targets: source.targets })), verifiedAt: getNow().toISOString() }, plan);
  } catch {
    throw new Error(`Image tag promotion failed during ${stage}; aliases may have changed and require inspection`);
  }
}
