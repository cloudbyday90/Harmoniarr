import assert from 'node:assert/strict';
import test from 'node:test';

import { getRegistryCapabilities, registryKeys } from '../../scripts/registry-capabilities.js';
import {
  buildOrasCopyArgs,
  buildOrasDiscoverArgs,
  distributionSpecModes,
  resolveRegistryReferrersPlan,
} from '../../scripts/registry-referrers.js';

test('resolveRegistryReferrersPlan chooses API mode for canonical registries without fallback', () => {
  assert.deepEqual(resolveRegistryReferrersPlan({
    registryBinding: getRegistryCapabilities(registryKeys.ghcr),
  }), {
    distributionSpec: distributionSpecModes.referrersApi,
    fallbackDistributionSpec: null,
    hasFallbackDistributionSpec: false,
  });
});

test('resolveRegistryReferrersPlan chooses API mode with tag fallback for mirror registries', () => {
  assert.deepEqual(resolveRegistryReferrersPlan({
    registryBinding: getRegistryCapabilities(registryKeys.dockerHub),
  }), {
    distributionSpec: distributionSpecModes.referrersApi,
    fallbackDistributionSpec: distributionSpecModes.referrersTag,
    hasFallbackDistributionSpec: true,
  });
});

test('resolveRegistryReferrersPlan validates overrides', () => {
  assert.throws(
    () => resolveRegistryReferrersPlan({
      distributionSpec: distributionSpecModes.referrersApi,
      fallbackDistributionSpec: distributionSpecModes.referrersApi,
      registryBinding: getRegistryCapabilities(registryKeys.dockerHub),
    }),
    /fallbackDistributionSpec must differ/,
  );
});

test('buildOrasDiscoverArgs renders ORAS discover arguments', () => {
  assert.deepEqual(buildOrasDiscoverArgs(
    'ghcr.io/cloudbyday90/harmoniarr@sha256:abc',
    resolveRegistryReferrersPlan({
      registryBinding: getRegistryCapabilities(registryKeys.ghcr),
    }),
  ), [
    'discover',
    '--distribution-spec',
    distributionSpecModes.referrersApi,
    '--format',
    'json',
    'ghcr.io/cloudbyday90/harmoniarr@sha256:abc',
  ]);
});

test('buildOrasCopyArgs renders ORAS cp arguments with distribution-spec guidance', () => {
  assert.deepEqual(buildOrasCopyArgs({
    fromReference: 'ghcr.io/cloudbyday90/harmoniarr@sha256:abc',
    sourceReferrersPlan: resolveRegistryReferrersPlan({
      registryBinding: getRegistryCapabilities(registryKeys.ghcr),
    }),
    targetReferrersPlan: resolveRegistryReferrersPlan({
      registryBinding: getRegistryCapabilities(registryKeys.dockerHub),
    }),
    toReference: 'cloudbyday90/harmoniarr:0.1.0-beta',
  }), [
    'cp',
    '-r',
    '--from-distribution-spec',
    distributionSpecModes.referrersApi,
    '--to-distribution-spec',
    distributionSpecModes.referrersApi,
    'ghcr.io/cloudbyday90/harmoniarr@sha256:abc',
    'cloudbyday90/harmoniarr:0.1.0-beta',
  ]);
});