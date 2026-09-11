/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createCandidateDockerCommand } from './docker-candidate-command.js';
import { withDockerCandidateFixture } from './docker-candidate-fixture.js';
import { assertCandidateRevision, assertDistinctCandidateImages, parseCandidateImageReference, resolveCandidateImage, verifyCandidateContainerImage } from './docker-candidate-identity.js';
import { createCandidateSchemaChecks } from './docker-candidate-schema-checks.js';
import { validateDockerFreshInstall, validateDockerUpgradePath } from './docker-smoke-validation.js';

function requireCheck(value) {
  if (!value) throw new Error('Candidate acceptance evidence is incomplete');
}

function summarizeRuntime(runtime, expectedImage, { continuity = false, candidate = true } = {}) {
  const image = runtime?.acceptance?.image;
  const schema = runtime?.acceptance?.schema;
  requireCheck(image?.imageVerified === true && image.imageId === expectedImage.imageId);
  requireCheck(image.hardeningVerified === true && image.loopbackBindingVerified === true);
  requireCheck(/^sha256:[a-f0-9]{64}$/.test(image.containerImageId));
  requireCheck(schema?.migrationChecksumsVerified === true && schema.packagedToolsVerified === true);
  requireCheck(Number.isSafeInteger(schema.migrationCount) && schema.migrationCount > 0);
  if (candidate) requireCheck(schema.indexesVerified === true);
  if (continuity) requireCheck(schema.continuityVerified === true);
  requireCheck(runtime.healthBody?.pendingMigrations === 0);
  return {
    imageId: image.imageId,
    containerImageId: image.containerImageId,
    platformManifestDigest: image.platformManifestDigest ?? null,
    imageVerified: true,
    hardeningVerified: true,
    loopbackBindingVerified: true,
    migrationCount: schema.migrationCount,
    migrationChecksumsVerified: true,
    indexesVerified: schema.indexesVerified === true,
    packagedToolsVerified: true,
    nodeVersion: schema.nodeVersion ?? null,
    postgresVersion: schema.postgresVersion ?? null,
    pgDumpVersion: schema.pgDumpVersion ?? null,
    pgRestoreVersion: schema.pgRestoreVersion ?? null,
    continuityVerified: schema.continuityVerified === true,
    requestContinuityVerified: schema.requestContinuityVerified === true,
    migrationsAdded: Number.isSafeInteger(schema.migrationsAdded) ? schema.migrationsAdded : 0,
    pendingMigrations: 0,
  };
}

export async function validateDockerCandidateAcceptance({
  candidateImageRef, baselineImageRef, candidateRevision, baselineRevision, allowLocalImages = false,
  env = process.env, onProgress = () => {},
  runCommandFn = createCandidateDockerCommand(),
  withFixtureFn = withDockerCandidateFixture,
  resolveImageFn = resolveCandidateImage,
  createSchemaChecksFn = createCandidateSchemaChecks,
  verifyImageFn = verifyCandidateContainerImage,
  validateFreshFn = validateDockerFreshInstall,
  validateUpgradeFn = validateDockerUpgradePath,
} = {}) {
  // Invalid inputs fail before even allocating a fixture or contacting Docker.
  parseCandidateImageReference(candidateImageRef, { allowLocalImages });
  parseCandidateImageReference(baselineImageRef, { allowLocalImages });
  assertCandidateRevision(candidateRevision);
  assertCandidateRevision(baselineRevision);
  let stage = 'fixture preparation';
  let result;
  try {
    result = await withFixtureFn({ env, runCommandFn, run: async (fixture) => {
      stage = 'image identity';
      onProgress(stage);
      const candidate = await resolveImageFn({ reference: candidateImageRef, revision: candidateRevision, allowLocalImages, runCommandFn, env: fixture.processEnv });
      const baseline = await resolveImageFn({ reference: baselineImageRef, revision: baselineRevision, allowLocalImages, runCommandFn, env: fixture.processEnv });
      assertDistinctCandidateImages({ baseline, candidate });
      const schemaChecks = createSchemaChecksFn({ runCommandFn });
      const verifyRuntimeFn = async (context) => {
        const expectedImage = context.phase === 'baseline' ? baseline : candidate;
        const image = await verifyImageFn({ ...context, expectedImage });
        const schema = await schemaChecks.checkPhase(context);
        return { image, schema };
      };
      const common = { ...fixture, runCommandFn, strictCleanup: true, verifyRuntimeFn };
      stage = 'fresh installation and restart';
      onProgress(stage);
      const fresh = await validateFreshFn({ ...common, buildImage: false, imageRef: candidate.imageId,
        verifyBackupRestoreFlow: true, verifyExistingDataRestart: true, verifyRequestMusicFlow: true });
      stage = 'baseline upgrade';
      onProgress(stage);
      const upgrade = await validateUpgradeFn({ ...common, baselineImageRef: baseline.imageId,
        buildCandidateImage: false, candidateImageRef: candidate.imageId });
      stage = 'evidence verification';
      onProgress(stage);
      requireCheck(fresh.cleanupVerified === true && upgrade.cleanupVerified === true);
      requireCheck(fresh.backupRestoreFlow?.restoreApplyStatus === 'completed');
      requireCheck(fresh.backupRestoreFlow.blockedRestoreApplyCode === 'recovery_lock_conflict');
      requireCheck(fresh.requestMusicFlow?.summaryScope === 'mine' && fresh.requestMusicFlow.listCount === 1);
      requireCheck(fresh.embeddedPostgresPersistence && fresh.startupFailure?.serviceStatus === 'exited');
      requireCheck(upgrade.settingsPersistence?.persisted === true);
      const upgraded = summarizeRuntime(upgrade.upgradedRuntime, candidate, { continuity: true });
      requireCheck(upgraded.migrationsAdded > 0 && upgraded.requestContinuityVerified);
      return {
        schemaVersion: 1,
        validationKind: 'immutable-candidate-acceptance',
        generatedAt: new Date().toISOString(),
        status: 'passed',
        artifactScope: candidate.kind === 'registry-digest' && baseline.kind === 'registry-digest' ? 'registry-digest-runtime' : 'local-artifact-runtime',
        provenanceVerified: false,
        acceptedReleaseBaselineVerified: false,
        candidate,
        baseline,
        checks: {
          freshInstall: summarizeRuntime(fresh.freshInstall, candidate),
          existingDataRestart: summarizeRuntime(fresh.existingDataRestart, candidate, { continuity: true }),
          baseline: summarizeRuntime(upgrade.baselineRuntime, baseline, { candidate: false }),
          upgraded,
          settingsPersistence: true,
          backupRestoreFlow: true,
          maintenanceConflictRefused: true,
          delegatedRequestScope: true,
          startupFailureRefused: true,
        },
      };
    } });
  } catch {
    throw Object.assign(new Error(`Immutable candidate acceptance failed during ${stage}; no passed evidence was produced`), {
      code: 'candidate_acceptance_failed',
    });
  }
  // The fixture returns only after its own cleanup, including resource absence.
  return { ...result, cleanupVerified: true };
}
