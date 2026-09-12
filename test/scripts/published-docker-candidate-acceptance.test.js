/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createReleaseMetadata } from '../../scripts/release-contract.js';
import { validatePublishedDockerCandidateAcceptance } from '../../scripts/published-docker-candidate-acceptance.js';
import { normalizePublishedCandidateInputs, publishedCandidatePredicateType } from '../../scripts/published-docker-candidate-policy.js';
import { verifyPublishedCandidateTrust } from '../../scripts/published-docker-candidate-trust.js';

const imageName = 'ghcr.io/cloudbyday90/harmoniarr';
const inputs = Object.freeze({
  repository: 'cloudbyday90/Harmoniarr', candidateImageRef: `${imageName}@sha256:${'a'.repeat(64)}`,
  baselineImageRef: `${imageName}@sha256:${'b'.repeat(64)}`,
  candidateRevision: 'c'.repeat(40), baselineRevision: 'd'.repeat(40), baselineReleaseTag: 'v1.2.3',
});

function createFixture({ changeAttestations, changeRelease, changeMetadata, tagObject, changeTag, failCommand } = {}) {
  const calls = [];
  const metadata = createReleaseMetadata({ digest: `sha256:${'b'.repeat(64)}`, imageName,
    releaseTag: inputs.baselineReleaseTag, repository: inputs.repository,
    tags: [`${imageName}:1.2.3`, `${imageName}:v1.2.3`], version: '1.2.3' });
  changeMetadata?.(metadata);
  const release = { id: 42, draft: false, tag_name: inputs.baselineReleaseTag, published_at: '2026-09-01T12:00:00Z',
    assets: [{ name: 'harmoniarr-release-metadata.json', id: 99, size: 2000 }] };
  changeRelease?.(release);
  const runTrustCommandFn = async ({ command, args, env, timeoutMs }) => {
    assert.equal(command, 'gh');
    assert.ok(timeoutMs > 0 && timeoutMs <= 90_000);
    assert.equal(args[args.indexOf('--hostname') + 1], 'github.com');
    calls.push({ args, env });
    if (failCommand) throw new Error('private injected diagnostic');
    let result;
    if (args[0] === 'attestation') {
      const reference = args[2].slice(6);
      result = [{ verificationResult: { signature: { certificate: {} },
        statement: { predicateType: publishedCandidatePredicateType,
          subject: [{ name: imageName, digest: { sha256: reference.split('sha256:')[1] } }] } } }];
      changeAttestations?.(result, reference);
    } else {
      assert.equal(args[args.indexOf('--method') + 1], 'GET');
      const endpoint = args.at(-1);
      if (endpoint.endsWith(`/releases/tags/${inputs.baselineReleaseTag}`)) result = release;
      else if (endpoint.endsWith('/releases/assets/99')) result = metadata;
      else if (endpoint.includes('/git/ref/tags/')) result = { ref: `refs/tags/${inputs.baselineReleaseTag}`,
        object: tagObject ?? { type: 'commit', sha: inputs.baselineRevision } };
      else if (endpoint.includes('/git/tags/')) {
        result = { sha: endpoint.split('/').at(-1), object: { type: 'commit', sha: inputs.baselineRevision } };
        changeTag?.(result);
      } else assert.fail('Unexpected trust lookup');
    }
    return { exitCode: 0, stdout: JSON.stringify(result) };
  };
  const runtime = {
    status: 'passed', schemaVersion: 1, validationKind: 'immutable-candidate-acceptance',
    artifactScope: 'registry-digest-runtime', cleanupVerified: true,
    candidate: { kind: 'registry-digest', reference: inputs.candidateImageRef, revision: inputs.candidateRevision,
      imageId: `sha256:${'e'.repeat(64)}` },
    baseline: { kind: 'registry-digest', reference: inputs.baselineImageRef, revision: inputs.baselineRevision,
      imageId: `sha256:${'f'.repeat(64)}` },
    checks: { upgraded: { migrationsAdded: 0 } },
  };
  return { calls, runTrustCommandFn, runtime };
}

test('published acceptance executes pinned live verification before runtime and accepts same-schema upgrade evidence', async () => {
  const fixture = createFixture();
  const env = { GH_TOKEN: 'test-token' };
  const result = await validatePublishedDockerCandidateAcceptance({ ...inputs, env,
    runTrustCommandFn: fixture.runTrustCommandFn,
    validateRuntimeFn: async (options) => {
      assert.equal(fixture.calls.length, 5);
      assert.equal(options.allowLocalImages, false);
      assert.equal(options.env, env);
      assert.equal(options.candidateImageRef, inputs.candidateImageRef);
      return fixture.runtime;
    },
  });

  assert.equal(result.validationKind, 'published-candidate-acceptance');
  assert.equal(result.provenanceVerified, true);
  assert.equal(result.publishedBaselineVerified, true);
  assert.equal(result.acceptedReleaseBaselineVerified, false);
  assert.equal(result.baselinePolicy, 'operator-selected-published-release');
  assert.equal(result.trust.baselineRelease.sourceRevision, inputs.baselineRevision);
  assert.match(result.trust.baselineRelease.metadataSha256, /^[a-f0-9]{64}$/u);
  for (const [index, revision] of [[0, inputs.candidateRevision], [1, inputs.baselineRevision]]) {
    const { args, env: actualEnv } = fixture.calls[index];
    assert.equal(actualEnv, env);
    assert.equal(args[args.indexOf('--source-digest') + 1], revision);
    assert.equal(args[args.indexOf('--signer-digest') + 1], revision);
    assert.equal(args[args.indexOf('--signer-workflow') + 1], `${inputs.repository}/.github/workflows/release-image.yml`);
    assert.equal(args[args.indexOf('--repo') + 1], inputs.repository);
    assert.equal(args[args.indexOf('--predicate-type') + 1], publishedCandidatePredicateType);
    assert.ok(args.includes('--deny-self-hosted-runners'));
    assert.equal(args[args.indexOf('--limit') + 1], '10');
  }
  assert.equal(JSON.stringify(result).includes('test-token'), false);
});

for (const [label, override] of [
  ['mutable candidate tag', { candidateImageRef: `${imageName}:latest` }],
  ['local image', { candidateImageRef: `sha256:${'a'.repeat(64)}` }],
  ['another registry', { candidateImageRef: inputs.candidateImageRef.replace('ghcr.io', 'example.test') }],
  ['missing selected release', { baselineReleaseTag: undefined }],
  ['identical source revisions', { candidateRevision: inputs.baselineRevision }],
  ['invalid repository', { repository: 'cloudbyday90/Harmoniarr/extra' }],
]) {
  test(`published acceptance rejects ${label} before external commands or runtime`, async () => {
    await assert.rejects(validatePublishedDockerCandidateAcceptance({ ...inputs, ...override,
      runTrustCommandFn: async () => { assert.fail('No trust command is expected'); },
      validateRuntimeFn: async () => { assert.fail('No runtime fixture is expected'); },
    }), { code: 'published_candidate_acceptance_failed' });
  });
}

for (const [label, options] of [
  ['unverified status claim', { changeAttestations: (records) => { records[0] = { verified: true }; } }],
  ['missing verifier certificate', { changeAttestations: (records) => { delete records[0].verificationResult.signature; } }],
  ['empty attestation results', { changeAttestations: (records) => { records.length = 0; } }],
  ['wrong attested subject', { changeAttestations: (records) => { records[0].verificationResult.statement.subject[0].digest.sha256 = '0'.repeat(64); } }],
  ['wrong attested image name', { changeAttestations: (records) => { records[0].verificationResult.statement.subject[0].name = 'ghcr.io/other/image'; } }],
  ['wrong predicate', { changeAttestations: (records) => { records[0].verificationResult.statement.predicateType = 'other'; } }],
  ['draft release', { changeRelease: (release) => { release.draft = true; } }],
  ['unpublished release', { changeRelease: (release) => { release.published_at = null; } }],
  ['wrong release tag', { changeRelease: (release) => { release.tag_name = 'v2'; } }],
  ['duplicate metadata asset', { changeRelease: (release) => { release.assets.push({ ...release.assets[0] }); } }],
  ['oversized metadata asset', { changeRelease: (release) => { release.assets[0].size = 131_073; } }],
  ['metadata digest mismatch', { changeMetadata: (metadata) => { metadata.digest = `sha256:${'a'.repeat(64)}`; } }],
  ['metadata repository mismatch', { changeMetadata: (metadata) => { metadata.repository = 'other/repository'; } }],
  ['tag commit mismatch', { tagObject: { type: 'commit', sha: '0'.repeat(40) } }],
  ['tag object cycle', { tagObject: { type: 'tag', sha: '0'.repeat(40) }, changeTag: (tag) => { tag.object = { type: 'tag', sha: tag.sha }; } }],
  ['CLI verification failure', { failCommand: true }],
]) {
  test(`published acceptance rejects ${label} without starting runtime or exposing diagnostics`, async () => {
    const fixture = createFixture(options);
    await assert.rejects(validatePublishedDockerCandidateAcceptance({ ...inputs,
      runTrustCommandFn: fixture.runTrustCommandFn,
      validateRuntimeFn: async () => { assert.fail('Trust rejection must precede runtime'); },
    }), (error) => error.code === 'published_candidate_acceptance_failed' && !error.message.includes('private injected'));
  });
}

test('baseline annotated tags resolve through bounded GitHub tag objects', async () => {
  const fixture = createFixture({ tagObject: { type: 'tag', sha: '0'.repeat(40) } });
  const result = await verifyPublishedCandidateTrust(inputs, { runTrustCommandFn: fixture.runTrustCommandFn });
  assert.equal(result.baselineRelease.sourceRevision, inputs.baselineRevision);
  assert.equal(fixture.calls.length, 6);
});

test('published acceptance rejects unsuccessful or malformed live command output', async () => {
  for (const result of [{ exitCode: 1, stdout: '[{"verified":true}]' }, { exitCode: 0, stdout: 'invalid-json' }]) {
    await assert.rejects(validatePublishedDockerCandidateAcceptance({ ...inputs,
      runTrustCommandFn: async () => result,
      validateRuntimeFn: async () => { assert.fail('Invalid trust output must precede runtime'); },
    }), { code: 'published_candidate_acceptance_failed' });
  }
});

test('published acceptance rejects an exhausted annotated-tag chain', async () => {
  const fixture = createFixture({ tagObject: { type: 'tag', sha: '0'.repeat(40) },
    changeTag: (tag) => { tag.object = { type: 'tag', sha: String(Number(tag.sha[0]) + 1).repeat(40) }; } });
  await assert.rejects(verifyPublishedCandidateTrust(inputs, { runTrustCommandFn: fixture.runTrustCommandFn }),
    /does not resolve/u);
  assert.equal(fixture.calls.length, 10);
});

for (const key of ['candidate', 'baseline']) {
  test(`published acceptance rejects a substituted ${key} runtime image`, async () => {
    const fixture = createFixture();
    fixture.runtime[key].reference = `${imageName}@sha256:${'0'.repeat(64)}`;
    await assert.rejects(validatePublishedDockerCandidateAcceptance({ ...inputs,
      runTrustCommandFn: fixture.runTrustCommandFn, validateRuntimeFn: async () => fixture.runtime,
    }), { code: 'published_candidate_acceptance_failed' });
  });
}

test('published trust input normalization never accepts caller-provided provenance flags', () => {
  const result = normalizePublishedCandidateInputs({ ...inputs, provenanceVerified: true, acceptedReleaseBaselineVerified: true });
  assert.equal(Object.hasOwn(result, 'provenanceVerified'), false);
  assert.equal(Object.hasOwn(result, 'acceptedReleaseBaselineVerified'), false);
});
