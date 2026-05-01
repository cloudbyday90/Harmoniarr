/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mirrorTrustModes } from './registry-capabilities.js';
import { createReleaseTrustPolicy } from './release-trust-policy.js';

export const defaultReleaseAssetNames = Object.freeze({
  composeOverride: 'harmoniarr-release-compose.override.yaml',
  metadata: 'harmoniarr-release-metadata.json',
  sbom: 'harmoniarr-release.spdx.json',
  verification: 'harmoniarr-release-verification.txt',
});

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function filterTagsForImageName(imageName, tags) {
  if (!isNonEmptyString(imageName) || !Array.isArray(tags)) {
    return [];
  }

  const normalizedPrefix = `${imageName.trim()}:`;
  return tags
    .filter((tag) => isNonEmptyString(tag) && tag.startsWith(normalizedPrefix))
    .map((tag) => tag.trim());
}

function createReleaseMirrorMetadata({
  digest,
  imageName,
  releaseTag,
  tags,
  version,
} = {}) {
  if (!isNonEmptyString(imageName)) {
    return null;
  }

  return {
    imageName: imageName.trim(),
    immutableImageRef: `${imageName.trim()}@${digest}`,
    releaseTag,
    tags: filterTagsForImageName(imageName, tags),
    version,
  };
}

export function toTagList(tagsText = '') {
  return tagsText
    .split(/\r?\n/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function createReleaseMetadata({
  digest,
  dockerHubImageName = null,
  dockerHubTrustMode = mirrorTrustModes.runtimeOnly,
  imageName,
  releaseTag,
  repository,
  tags,
  version,
  sbomAssetName = defaultReleaseAssetNames.sbom,
  verificationAssetName = defaultReleaseAssetNames.verification,
  metadataAssetName = defaultReleaseAssetNames.metadata,
  composeOverrideAssetName = defaultReleaseAssetNames.composeOverride,
} = {}) {
  if (!releaseTag || !version || !imageName || !digest) {
    throw new Error('releaseTag, version, imageName, and digest are required');
  }

  const immutableImageRef = `${imageName}@${digest}`;

  return {
    assets: {
      composeOverride: composeOverrideAssetName,
      metadata: metadataAssetName,
      sbom: sbomAssetName,
      verification: verificationAssetName,
    },
    attestation: {
      containerVerifyCommand: `gh attestation verify oci://${immutableImageRef} -R ${repository}`,
    },
    digest,
    imageName,
    immutableImageRef,
    mirrors: {
      ...(isNonEmptyString(dockerHubImageName)
        ? {
            dockerHub: createReleaseMirrorMetadata({
              digest,
              imageName: dockerHubImageName,
              releaseTag,
              tags,
              version,
            }),
          }
        : {}),
    },
    releaseTag,
    repository,
    tags,
    trust: createReleaseTrustPolicy({
      dockerHubImageName,
      dockerHubTrustMode,
      imageName,
      immutableImageRef,
    }),
    version,
  };
}

export function renderReleaseVerificationNote(metadata) {
  return [
    'Harmoniarr release verification',
    '==============================',
    '',
    `Release tag: ${metadata.releaseTag}`,
    `Published version tag: ${metadata.version}`,
    `Container image: ${metadata.imageName}`,
    `Immutable image reference: ${metadata.immutableImageRef}`,
    ...(metadata.mirrors?.dockerHub
      ? [
          `Docker Hub mirror: ${metadata.mirrors.dockerHub.imageName}`,
          `Docker Hub immutable mirror reference: ${metadata.mirrors.dockerHub.immutableImageRef}`,
        ]
      : []),
    '',
    'Suggested deployment reference:',
    `- ${metadata.immutableImageRef}`,
    ...(metadata.mirrors?.dockerHub
      ? [
          '- Docker Hub mirror tags are recorded in the machine-readable release manifest when mirror publication is enabled.',
          ...(metadata.trust?.mirrors?.dockerHub?.trustMode === mirrorTrustModes.trusted
            ? [
                '- GHCR remains the canonical provenance and attestation source; Docker Hub is promoted as a verified trusted mirror for copied referrers and digest parity.',
                '- The trusted mirror flow copies OCI referrers with ORAS recursive copy and verifies the discovered referrer graph against GHCR.',
              ]
            : [
                '- GHCR remains the canonical provenance and attestation source; Docker Hub is verified for digest parity only.',
                '- OCI referrers such as signatures and attestations are not mirrored automatically to Docker Hub.',
              ]),
        ]
      : []),
    '',
    'Verify the container provenance attestation:',
    '1. docker login ghcr.io',
    `2. ${metadata.attestation.containerVerifyCommand}`,
    '',
    'Download the release SBOM asset and inspect it:',
    `1. gh release download ${metadata.releaseTag} -R ${metadata.repository} -p ${metadata.assets.sbom} -D .`,
    `2. open ${metadata.assets.sbom} in your preferred SPDX tooling`,
    '',
    'Download the machine-readable release manifest and Compose override when you need canonical deployment inputs:',
    `1. gh release download ${metadata.releaseTag} -R ${metadata.repository} -p ${metadata.assets.metadata} -p ${metadata.assets.composeOverride} -D .`,
    `2. inspect ${metadata.assets.metadata} for the immutable image reference and asset names`,
    `3. use ${metadata.assets.composeOverride} as the immutable-image override for Compose deployments`,
    '',
    'If you want the attested SPDX predicate from GitHub, inspect it with:',
    `${metadata.attestation.containerVerifyCommand} --format json`,
    '',
  ].join('\n');
}

export function renderReleaseComposeOverride(metadata) {
  return [
    'services:',
    '  harmoniarr:',
    `    image: "${metadata.immutableImageRef}"`,
    '',
  ].join('\n');
}

export function listReleaseAssetNames(releaseView) {
  if (!releaseView || typeof releaseView !== 'object') {
    return [];
  }

  if (!Array.isArray(releaseView.assets)) {
    return [];
  }

  return releaseView.assets
    .map((asset) => asset?.name)
    .filter(isNonEmptyString)
    .map((name) => name.trim());
}

function validateMetadataShape(metadata, errors) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    errors.push('release metadata must be a JSON object');
    return;
  }

  for (const fieldName of ['digest', 'imageName', 'immutableImageRef', 'releaseTag', 'repository', 'version']) {
    if (!isNonEmptyString(metadata[fieldName])) {
      errors.push(`release metadata field ${fieldName} must be a non-empty string`);
    }
  }

  if (!Array.isArray(metadata.tags)) {
    errors.push('release metadata field tags must be an array');
  }

  if (!metadata.assets || typeof metadata.assets !== 'object' || Array.isArray(metadata.assets)) {
    errors.push('release metadata field assets must be an object');
  } else {
    for (const [assetKey, assetName] of Object.entries(defaultReleaseAssetNames)) {
      if (!isNonEmptyString(metadata.assets[assetKey])) {
        errors.push(`release metadata asset ${assetKey} must be a non-empty string`);
        continue;
      }

      if (metadata.assets[assetKey] !== assetName) {
        errors.push(`release metadata asset ${assetKey} must equal ${assetName}`);
      }
    }
  }

  if (!metadata.attestation || typeof metadata.attestation !== 'object' || Array.isArray(metadata.attestation)) {
    errors.push('release metadata field attestation must be an object');
    return;
  }

  if (!isNonEmptyString(metadata.attestation.containerVerifyCommand)) {
    errors.push('release metadata attestation.containerVerifyCommand must be a non-empty string');
  }

  if (metadata.mirrors != null && (typeof metadata.mirrors !== 'object' || Array.isArray(metadata.mirrors))) {
    errors.push('release metadata field mirrors must be an object when present');
  }

  if (!metadata.trust || typeof metadata.trust !== 'object' || Array.isArray(metadata.trust)) {
    errors.push('release metadata field trust must be an object');
  }
}

function validateMirrorShape(mirrorName, mirror, errors) {
  if (!mirror || typeof mirror !== 'object' || Array.isArray(mirror)) {
    errors.push(`release metadata mirror ${mirrorName} must be an object`);
    return;
  }

  for (const fieldName of ['imageName', 'immutableImageRef', 'releaseTag', 'version']) {
    if (!isNonEmptyString(mirror[fieldName])) {
      errors.push(`release metadata mirror ${mirrorName}.${fieldName} must be a non-empty string`);
    }
  }

  if (!Array.isArray(mirror.tags)) {
    errors.push(`release metadata mirror ${mirrorName}.tags must be an array`);
  }
}

function validateDerivedFields(metadata, errors) {
  if (!isNonEmptyString(metadata.imageName) || !isNonEmptyString(metadata.digest)) {
    return;
  }

  const expectedImmutableImageRef = `${metadata.imageName}@${metadata.digest}`;
  if (metadata.immutableImageRef !== expectedImmutableImageRef) {
    errors.push(`release metadata immutableImageRef must equal ${expectedImmutableImageRef}`);
  }

  if (Array.isArray(metadata.tags)) {
    const requiredTags = [
      `${metadata.imageName}:${metadata.version}`,
      `${metadata.imageName}:${metadata.releaseTag}`,
    ];

    for (const requiredTag of requiredTags) {
      if (!metadata.tags.includes(requiredTag)) {
        errors.push(`release metadata tags must include ${requiredTag}`);
      }
    }
  }

  if (metadata.repository && metadata.attestation?.containerVerifyCommand) {
    const expectedVerifyCommand = `gh attestation verify oci://${expectedImmutableImageRef} -R ${metadata.repository}`;
    if (metadata.attestation.containerVerifyCommand !== expectedVerifyCommand) {
      errors.push(`release metadata attestation.containerVerifyCommand must equal ${expectedVerifyCommand}`);
    }
  }

  if (hasOwn(metadata.mirrors ?? {}, 'dockerHub')) {
    const dockerHubMirror = metadata.mirrors.dockerHub;
    validateMirrorShape('dockerHub', dockerHubMirror, errors);

    if (dockerHubMirror && !Array.isArray(dockerHubMirror.tags)) {
      return;
    }

    if (dockerHubMirror?.imageName && dockerHubMirror?.immutableImageRef) {
      const expectedMirrorImmutableImageRef = `${dockerHubMirror.imageName}@${metadata.digest}`;
      if (dockerHubMirror.immutableImageRef !== expectedMirrorImmutableImageRef) {
        errors.push(`release metadata mirror dockerHub.immutableImageRef must equal ${expectedMirrorImmutableImageRef}`);
      }
    }

    if (dockerHubMirror?.releaseTag && dockerHubMirror.releaseTag !== metadata.releaseTag) {
      errors.push(`release metadata mirror dockerHub.releaseTag must equal ${metadata.releaseTag}`);
    }

    if (dockerHubMirror?.version && dockerHubMirror.version !== metadata.version) {
      errors.push(`release metadata mirror dockerHub.version must equal ${metadata.version}`);
    }

    if (dockerHubMirror?.imageName && Array.isArray(dockerHubMirror.tags)) {
      const requiredMirrorTags = [
        `${dockerHubMirror.imageName}:${metadata.version}`,
        `${dockerHubMirror.imageName}:${metadata.releaseTag}`,
      ];

      for (const requiredTag of requiredMirrorTags) {
        if (!dockerHubMirror.tags.includes(requiredTag)) {
          errors.push(`release metadata mirror dockerHub.tags must include ${requiredTag}`);
        }
      }
    }
  }

  if (metadata.trust && typeof metadata.trust === 'object' && !Array.isArray(metadata.trust)) {
    try {
      const expectedTrustPolicy = createReleaseTrustPolicy({
        dockerHubImageName: metadata.mirrors?.dockerHub?.imageName ?? null,
        dockerHubTrustMode: metadata.trust?.mirrors?.dockerHub?.trustMode ?? mirrorTrustModes.runtimeOnly,
        imageName: metadata.imageName,
        immutableImageRef: metadata.immutableImageRef,
      });

      if (JSON.stringify(metadata.trust) !== JSON.stringify(expectedTrustPolicy)) {
        errors.push(`release metadata trust policy must equal ${JSON.stringify(expectedTrustPolicy)}`);
      }
    } catch (error) {
      errors.push(`release metadata trust policy is invalid: ${error.message}`);
    }
  }
}

function validateExpectations(metadata, expectations, errors) {
  const expectationMap = {
    digest: expectations.expectedDigest,
    dockerHubImageName: expectations.expectedDockerHubImageName,
    dockerHubTrustMode: expectations.expectedDockerHubTrustMode,
    imageName: expectations.expectedImageName,
    releaseTag: expectations.expectedReleaseTag,
    repository: expectations.expectedRepository,
    version: expectations.expectedVersion,
  };

  for (const [fieldName, expectedValue] of Object.entries(expectationMap)) {
    if (!isNonEmptyString(expectedValue)) {
      continue;
    }

    if (fieldName === 'dockerHubImageName') {
      if (metadata.mirrors?.dockerHub?.imageName !== expectedValue) {
        errors.push(`release metadata mirror dockerHub.imageName must equal ${expectedValue}`);
      }
      continue;
    }

    if (fieldName === 'dockerHubTrustMode') {
      if (metadata.trust?.mirrors?.dockerHub?.trustMode !== expectedValue) {
        errors.push(`release metadata trust.mirrors.dockerHub.trustMode must equal ${expectedValue}`);
      }
      continue;
    }

    if (metadata[fieldName] !== expectedValue) {
      errors.push(`release metadata ${fieldName} must equal ${expectedValue}`);
    }
  }
}

function validateReleaseAssets(metadata, releaseAssetNames, errors) {
  if (!Array.isArray(releaseAssetNames) || releaseAssetNames.length === 0) {
    return;
  }

  const assetSet = new Set(releaseAssetNames);
  for (const assetName of Object.values(metadata.assets)) {
    if (!assetSet.has(assetName)) {
      errors.push(`release assets must include ${assetName}`);
    }
  }
}

function validateComposeOverride(metadata, composeOverrideText, errors) {
  if (!isNonEmptyString(composeOverrideText)) {
    return;
  }

  const expectedText = renderReleaseComposeOverride(metadata);
  if (composeOverrideText !== expectedText) {
    errors.push(`release Compose override must exactly match:\n${expectedText}`);
  }
}

export function verifyReleaseContract(metadata, {
  composeOverrideText,
  expectedDigest,
  expectedDockerHubImageName,
  expectedDockerHubTrustMode,
  expectedImageName,
  expectedReleaseTag,
  expectedRepository,
  expectedVersion,
  releaseAssetNames,
} = {}) {
  const errors = [];
  validateMetadataShape(metadata, errors);

  if (errors.length > 0) {
    throw new Error(`Release contract verification failed:\n- ${errors.join('\n- ')}`);
  }

  validateDerivedFields(metadata, errors);
  validateExpectations(metadata, {
    expectedDigest,
    expectedDockerHubImageName,
    expectedDockerHubTrustMode,
    expectedImageName,
    expectedReleaseTag,
    expectedRepository,
    expectedVersion,
  }, errors);
  validateReleaseAssets(metadata, releaseAssetNames, errors);
  validateComposeOverride(metadata, composeOverrideText, errors);

  if (errors.length > 0) {
    throw new Error(`Release contract verification failed:\n- ${errors.join('\n- ')}`);
  }

  return {
    assetCount: releaseAssetNames?.length ?? 0,
    composeOverrideAssetName: metadata.assets.composeOverride,
    immutableImageRef: metadata.immutableImageRef,
    releaseTag: metadata.releaseTag,
  };
}

export function parseReleaseMetadata(text) {
  const metadata = JSON.parse(text);

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('release metadata must be a JSON object');
  }

  return metadata;
}

export function parseReleaseView(text) {
  const releaseView = JSON.parse(text);

  if (!releaseView || typeof releaseView !== 'object' || Array.isArray(releaseView)) {
    throw new Error('release view payload must be a JSON object');
  }

  return releaseView;
}

export function getReleaseMirror(metadata, mirrorName) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('release metadata must be a JSON object');
  }

  if (!isNonEmptyString(mirrorName)) {
    throw new Error('mirrorName is required');
  }

  const mirror = metadata.mirrors?.[mirrorName.trim()];
  if (!mirror || typeof mirror !== 'object' || Array.isArray(mirror)) {
    throw new Error(`release metadata mirror ${mirrorName} is not configured`);
  }

  return mirror;
}

export function listReleaseMirrorReferences(metadata, mirrorName) {
  const mirror = getReleaseMirror(metadata, mirrorName);
  const references = [];

  if (isNonEmptyString(mirror.immutableImageRef)) {
    references.push(mirror.immutableImageRef.trim());
  }

  if (Array.isArray(mirror.tags)) {
    for (const tag of mirror.tags) {
      if (isNonEmptyString(tag)) {
        references.push(tag.trim());
      }
    }
  }

  return [...new Set(references)];
}