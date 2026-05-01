import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRegistryMirrorCapabilities,
  getRegistryCapabilities,
  registryKeys,
} from '../../scripts/registry-capabilities.js';

test('getRegistryCapabilities returns canonical GHCR capabilities', () => {
  assert.deepEqual(getRegistryCapabilities(registryKeys.ghcr), {
    attestationSource: true,
    displayName: 'GHCR',
    key: 'ghcr',
    referrersDiscovery: 'same_registry',
    role: 'canonical',
    sbomDelivery: 'release_asset',
    verification: 'attestation_and_digest',
  });
});

test('createRegistryMirrorCapabilities returns Docker Hub mirror guidance', () => {
  assert.deepEqual(createRegistryMirrorCapabilities({
    imageName: 'cloudbyday90/harmoniarr',
    registryKey: registryKeys.dockerHub,
  }), {
    imageName: 'cloudbyday90/harmoniarr',
    promotionCandidate: 'oras_copy_recursive',
    promotionVerification: 'digest_and_referrers',
    referrerPolicy: 'not_mirrored',
    referrersDiscovery: 'oci_1_1_or_referrers_tag',
    trustMode: 'runtime_only',
    verification: 'digest_parity',
  });
});

test('createRegistryMirrorCapabilities rejects non-mirror profiles', () => {
  assert.throws(
    () => createRegistryMirrorCapabilities({
      imageName: 'ghcr.io/cloudbyday90/harmoniarr',
      registryKey: registryKeys.ghcr,
    }),
    /does not describe a mirror capability profile/,
  );
});