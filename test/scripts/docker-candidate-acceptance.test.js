import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateDockerCandidateAcceptance } from '../../scripts/docker-candidate-acceptance.js';
import { parseDockerCandidateOptions, runDockerCandidateCommand } from '../../scripts/validate-docker-candidate.js';

const candidateImageRef = `sha256:${'a'.repeat(64)}`;
const baselineImageRef = `sha256:${'b'.repeat(64)}`;
const candidateRevision = 'c'.repeat(40);
const baselineRevision = 'd'.repeat(40);
const inputs = { candidateImageRef, baselineImageRef, candidateRevision, baselineRevision, allowLocalImages: true };
const args = ['--candidate-image', candidateImageRef, '--baseline-image', baselineImageRef,
  '--candidate-revision', candidateRevision, '--baseline-revision', baselineRevision, '--allow-local-images'];

function acceptanceHarness({ cleanupFailure = false, missingProof = false, migrationsAdded = 1 } = {}) {
  const images = [];
  const options = {
    ...inputs,
    withFixtureFn: async ({ run }) => {
      const result = await run({ processEnv: {} });
      if (cleanupFailure) throw new Error('sensitive cleanup diagnostic');
      return result;
    },
    resolveImageFn: async ({ reference, revision }) => ({ reference, imageId: reference, revision, platform: 'linux/amd64', kind: 'local-image' }),
    verifyImageFn: async ({ expectedImage, phase }) => {
      images.push([phase, expectedImage.imageId]);
      return { imageId: expectedImage.imageId, containerImageId: expectedImage.imageId, imageVerified: true,
        hardeningVerified: true, loopbackBindingVerified: true };
    },
    createSchemaChecksFn: () => ({ checkPhase: async ({ phase }) => ({ migrationChecksumsVerified: true,
      migrationCount: phase === 'baseline' ? 97 : 98, indexesVerified: phase !== 'baseline',
      packagedToolsVerified: true, continuityVerified: ['upgraded', 'existing-data-restart'].includes(phase),
      requestContinuityVerified: phase === 'upgraded', migrationsAdded: phase === 'upgraded' ? migrationsAdded : 0 }) }),
    validateFreshFn: async (settings) => {
      assert.equal(settings.buildImage, false);
      assert.equal(settings.imageRef, candidateImageRef);
      assert.equal(settings.strictCleanup, true);
      return {
        freshInstall: await runtime(settings, 'fresh-install'),
        existingDataRestart: await runtime(settings, 'existing-data-restart'),
        cleanupVerified: true,
        backupRestoreFlow: { restoreApplyStatus: 'completed', blockedRestoreApplyCode: 'recovery_lock_conflict' },
        requestMusicFlow: { summaryScope: 'mine', listCount: 1, requestedForUsername: 'private-fixture-user' },
        embeddedPostgresPersistence: {}, startupFailure: { serviceStatus: 'exited' },
      };
    },
    validateUpgradeFn: async (settings) => {
      assert.equal(settings.buildCandidateImage, false);
      assert.equal(settings.baselineImageRef, baselineImageRef);
      assert.equal(settings.candidateImageRef, candidateImageRef);
      return { baselineRuntime: await runtime(settings, 'baseline'), upgradedRuntime: await runtime(settings, 'upgraded'),
        cleanupVerified: true, settingsPersistence: { persisted: !missingProof } };
    },
  };
  async function runtime(settings, phase) {
    return { healthBody: { pendingMigrations: 0 }, acceptance: await settings.verifyRuntimeFn({ phase }) };
  }
  return { options, images };
}

test('one resolved candidate is reused for fresh install, restart and upgrade with bounded evidence', async () => {
  const { options, images } = acceptanceHarness();
  const evidence = await validateDockerCandidateAcceptance(options);
  assert.deepEqual(images, [['fresh-install', candidateImageRef], ['existing-data-restart', candidateImageRef],
    ['baseline', baselineImageRef], ['upgraded', candidateImageRef]]);
  assert.equal(evidence.artifactScope, 'local-artifact-runtime');
  assert.equal(evidence.provenanceVerified, false);
  assert.equal(evidence.acceptedReleaseBaselineVerified, false);
  assert.equal(evidence.checks.upgraded.migrationsAdded, 1);
  assert.equal(evidence.cleanupVerified, true);
  assert.ok(!JSON.stringify(evidence).includes('private-fixture-user'));
});

test('cleanup or incomplete proof cannot produce a passed acceptance artifact', async () => {
  for (const scenario of [{ cleanupFailure: true }, { missingProof: true }]) {
    await assert.rejects(validateDockerCandidateAcceptance(acceptanceHarness(scenario).options),
      (error) => error.code === 'candidate_acceptance_failed' && !error.message.includes('sensitive'));
  }
});

test('patch release acceptance permits no new migration but rejects a shrinking ledger', async () => {
  const evidence = await validateDockerCandidateAcceptance(acceptanceHarness({ migrationsAdded: 0 }).options);
  assert.equal(evidence.checks.upgraded.migrationsAdded, 0);
  assert.equal(evidence.checks.upgraded.requestContinuityVerified, true);
  for (const migrationsAdded of [-1, null, '0']) {
    await assert.rejects(validateDockerCandidateAcceptance(acceptanceHarness({ migrationsAdded }).options),
      { code: 'candidate_acceptance_failed' });
  }
});

test('invalid candidate input fails before Docker or fixture allocation', async () => {
  let allocated = false;
  await assert.rejects(validateDockerCandidateAcceptance({ ...inputs, candidateImageRef: 'harmoniarr:latest',
    withFixtureFn: async () => { allocated = true; } }), /registry SHA-256/);
  assert.equal(allocated, false);
});

test('candidate CLI is strict and help performs no validation', async () => {
  assert.throws(() => parseDockerCandidateOptions([...args, '--evidence-path', 'out.json', '--database-url', 'secret']), /Unsupported/);
  assert.throws(() => parseDockerCandidateOptions([]), /required/);
  assert.deepEqual(await runDockerCandidateCommand({ args: ['--help'], validate: async () => { throw new Error('unexpected'); } }), { help: true });
});

test('candidate CLI reserves a new file, never overwrites old proof and leaves failed proof empty', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-candidate-cli-test-'));
  try {
    const evidencePath = join(directory, 'proof.json');
    await writeFile(evidencePath, 'old-proof');
    let ran = false;
    await assert.rejects(runDockerCandidateCommand({ args: [...args, '--evidence-path', evidencePath],
      validate: async () => { ran = true; } }), /new writable/);
    assert.equal(ran, false);
    assert.equal(await readFile(evidencePath, 'utf8'), 'old-proof');
    const failedPath = join(directory, 'failed.json');
    await assert.rejects(runDockerCandidateCommand({ args: [...args, '--evidence-path', failedPath],
      validate: async () => { throw new Error('private password'); } }), (error) => !error.message.includes('private'));
    assert.equal(await readFile(failedPath, 'utf8'), '');
    const passedPath = join(directory, 'passed.json');
    const evidence = await validateDockerCandidateAcceptance(acceptanceHarness().options);
    await runDockerCandidateCommand({ args: [...args, '--evidence-path', passedPath], validate: async () => evidence });
    assert.deepEqual(JSON.parse(await readFile(passedPath, 'utf8')), evidence);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
