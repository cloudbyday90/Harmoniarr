import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createReleaseTrustPolicy,
  defaultMirrorTrustSettings,
  defaultReleaseTrustSettings,
} from '../../scripts/release-trust-policy.js';
import { mirrorTrustModes } from '../../scripts/registry-capabilities.js';

test('createReleaseTrustPolicy requires canonical image inputs', () => {
  assert.throws(() => createReleaseTrustPolicy({ immutableImageRef: 'ghcr.io/a/b@sha256:123' }), /imageName is required/);
  assert.throws(() => createReleaseTrustPolicy({ imageName: 'ghcr.io/a/b' }), /immutableImageRef is required/);
});

test('createReleaseTrustPolicy records GHCR as canonical and Docker Hub as runtime-only mirror', () => {
  assert.deepEqual(createReleaseTrustPolicy({
    dockerHubImageName: 'cloudbyday90/harmoniarr',
    imageName: 'ghcr.io/cloudbyday90/harmoniarr',
    immutableImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:abc',
  }), {
    attestationSource: defaultReleaseTrustSettings.attestationSource,
    canonicalImageName: 'ghcr.io/cloudbyday90/harmoniarr',
    canonicalImmutableImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:abc',
    canonicalRegistry: defaultReleaseTrustSettings.canonicalRegistry,
    canonicalVerification: defaultReleaseTrustSettings.verification,
    mirrors: {
      dockerHub: {
        imageName: 'cloudbyday90/harmoniarr',
        promotionCandidate: 'oras_copy_recursive',
        promotionVerification: 'digest_and_referrers',
        rationale: defaultMirrorTrustSettings.runtimeOnlyRationale,
        referrerPolicy: 'not_mirrored',
        referrersDiscovery: 'oci_1_1_or_referrers_tag',
        trustMode: 'runtime_only',
        verification: 'digest_parity',
      },
    },
    referrersDiscovery: defaultReleaseTrustSettings.referrersDiscovery,
    sbomDelivery: defaultReleaseTrustSettings.sbomDelivery,
  });
});

test('createReleaseTrustPolicy records promoted trusted Docker Hub mirror mode', () => {
  const policy = createReleaseTrustPolicy({
    dockerHubImageName: 'cloudbyday90/harmoniarr',
    dockerHubTrustMode: mirrorTrustModes.trusted,
    imageName: 'ghcr.io/cloudbyday90/harmoniarr',
    immutableImageRef: 'ghcr.io/cloudbyday90/harmoniarr@sha256:abc',
  });

  assert.equal(policy.mirrors.dockerHub.trustMode, mirrorTrustModes.trusted);
  assert.equal(policy.mirrors.dockerHub.referrerPolicy, 'copied');
  assert.equal(policy.mirrors.dockerHub.verification, 'digest_and_referrers');
  assert.equal(policy.mirrors.dockerHub.rationale, defaultMirrorTrustSettings.trustedRationale);
});