import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createReleaseMetadata,
  defaultReleaseAssetNames,
  getReleaseMirror,
  listReleaseMirrorReferences,
  parseReleaseMetadata,
  parseReleaseView,
  renderReleaseComposeOverride,
  toTagList,
  verifyReleaseContract,
} from '../../scripts/release-contract.js';

function createMetadata({ dockerHubTrustMode } = {}) {
  return createReleaseMetadata({
    digest: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    dockerHubImageName: 'cloudbyday90/harmoniarr',
    dockerHubTrustMode,
    imageName: 'ghcr.io/cloudbyday90/harmoniarr',
    releaseTag: 'v0.1.0-beta',
    repository: 'cloudbyday90/Harmoniarr',
    tags: toTagList([
      'ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta',
      'ghcr.io/cloudbyday90/harmoniarr:v0.1.0-beta',
      'cloudbyday90/harmoniarr:0.1.0-beta',
      'cloudbyday90/harmoniarr:v0.1.0-beta',
    ].join('\n')),
    version: '0.1.0-beta',
  });
}

test('createReleaseMetadata includes the expected release asset names', () => {
  const metadata = createMetadata();

  assert.deepEqual(metadata.assets, defaultReleaseAssetNames);
  assert.deepEqual(metadata.mirrors.dockerHub, {
    imageName: 'cloudbyday90/harmoniarr',
    immutableImageRef: 'cloudbyday90/harmoniarr@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    releaseTag: 'v0.1.0-beta',
    tags: [
      'cloudbyday90/harmoniarr:0.1.0-beta',
      'cloudbyday90/harmoniarr:v0.1.0-beta',
    ],
    version: '0.1.0-beta',
  });
  assert.deepEqual(metadata.trust, {
    attestationSource: 'ghcr',
    canonicalImageName: 'ghcr.io/cloudbyday90/harmoniarr',
    canonicalImmutableImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    canonicalRegistry: 'ghcr',
    canonicalVerification: 'attestation_and_digest',
    mirrors: {
      dockerHub: {
        imageName: 'cloudbyday90/harmoniarr',
        promotionCandidate: 'oras_copy_recursive',
        promotionVerification: 'digest_and_referrers',
        rationale: 'oci_referrers_not_mirrored_automatically',
        referrerPolicy: 'not_mirrored',
        referrersDiscovery: 'oci_1_1_or_referrers_tag',
        trustMode: 'runtime_only',
        verification: 'digest_parity',
      },
    },
    referrersDiscovery: 'same_registry',
    sbomDelivery: 'release_asset',
  });
});

test('verifyReleaseContract rejects a tampered trust policy', () => {
  const metadata = createMetadata();
  metadata.trust.attestationSource = 'dockerhub';

  assert.throws(
    () => verifyReleaseContract(metadata),
    /release metadata trust policy must equal/,
  );
});

test('renderReleaseComposeOverride renders an immutable image override', () => {
  const metadata = createMetadata();

  assert.equal(
    renderReleaseComposeOverride(metadata),
    [
      'services:',
      '  harmoniarr:',
      `    image: "${metadata.immutableImageRef}"`,
      '',
    ].join('\n'),
  );
});

test('verifyReleaseContract accepts a matching metadata, release view, and compose override set', () => {
  const metadata = createMetadata();
  const result = verifyReleaseContract(metadata, {
    composeOverrideText: renderReleaseComposeOverride(metadata),
    expectedDigest: metadata.digest,
    expectedDockerHubImageName: metadata.mirrors.dockerHub.imageName,
    expectedImageName: metadata.imageName,
    expectedReleaseTag: metadata.releaseTag,
    expectedRepository: metadata.repository,
    expectedVersion: metadata.version,
    releaseAssetNames: Object.values(defaultReleaseAssetNames),
  });

  assert.equal(result.releaseTag, metadata.releaseTag);
  assert.equal(result.immutableImageRef, metadata.immutableImageRef);
});

test('verifyReleaseContract rejects a mismatched Docker Hub mirror image name', () => {
  const metadata = createMetadata();

  assert.throws(
    () => verifyReleaseContract(metadata, {
      expectedDockerHubImageName: 'other/harmoniarr',
    }),
    /release metadata mirror dockerHub\.imageName must equal other\/harmoniarr/,
  );
});

test('verifyReleaseContract accepts a trusted Docker Hub mirror mode expectation', () => {
  const metadata = createMetadata({ dockerHubTrustMode: 'trusted' });

  assert.equal(metadata.trust.mirrors.dockerHub.referrerPolicy, 'copied');
  assert.equal(metadata.trust.mirrors.dockerHub.verification, 'digest_and_referrers');
  assert.doesNotThrow(() => verifyReleaseContract(metadata, {
    expectedDockerHubTrustMode: 'trusted',
  }));
});

test('getReleaseMirror and listReleaseMirrorReferences return Docker Hub mirror details', () => {
  const metadata = createMetadata();

  assert.equal(getReleaseMirror(metadata, 'dockerHub').imageName, 'cloudbyday90/harmoniarr');
  assert.deepEqual(listReleaseMirrorReferences(metadata, 'dockerHub'), [
    'cloudbyday90/harmoniarr@sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    'cloudbyday90/harmoniarr:0.1.0-beta',
    'cloudbyday90/harmoniarr:v0.1.0-beta',
  ]);
});

test('verifyReleaseContract rejects a missing release asset', () => {
  const metadata = createMetadata();

  assert.throws(
    () => verifyReleaseContract(metadata, {
      composeOverrideText: renderReleaseComposeOverride(metadata),
      releaseAssetNames: [
        defaultReleaseAssetNames.metadata,
        defaultReleaseAssetNames.sbom,
        defaultReleaseAssetNames.verification,
      ],
    }),
    /release assets must include harmoniarr-release-compose\.override\.yaml/,
  );
});

test('verifyReleaseContract rejects a compose override that does not match the immutable ref', () => {
  const metadata = createMetadata();

  assert.throws(
    () => verifyReleaseContract(metadata, {
      composeOverrideText: 'services:\n  harmoniarr:\n    image: "ghcr.io/cloudbyday90/harmoniarr:latest"\n',
    }),
    /release Compose override must exactly match/,
  );
});

test('parseReleaseMetadata and parseReleaseView require JSON objects', () => {
  assert.deepEqual(parseReleaseMetadata('{"releaseTag":"v0.1.0-beta"}'), { releaseTag: 'v0.1.0-beta' });
  assert.deepEqual(parseReleaseView('{"assets":[]}'), { assets: [] });
  assert.throws(() => parseReleaseMetadata('[]'), /JSON object/);
  assert.throws(() => parseReleaseView('[]'), /JSON object/);
});