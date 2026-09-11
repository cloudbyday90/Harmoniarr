/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const imageIdPattern = /^sha256:[a-f0-9]{64}$/;
const revisionPattern = /^[a-f0-9]{40}$/;
const registryReferencePattern = /^(?:[a-z0-9]+(?:[.-][a-z0-9]+)*(?::[0-9]{1,5})?\/)?[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,127})?@sha256:[a-f0-9]{64}$/;

export function parseCandidateImageReference(value, { allowLocalImages = false } = {}) {
  if (typeof value !== 'string' || value.length > 512) throw new Error('A full immutable image reference is required');
  if (allowLocalImages && imageIdPattern.test(value)) return { reference: value, kind: 'local-image' };
  if (registryReferencePattern.test(value)) return { reference: value, kind: 'registry-digest' };
  throw new Error('Use a registry SHA-256 digest reference, or explicitly allow full local image IDs');
}

export function assertCandidateRevision(value) {
  if (!revisionPattern.test(value ?? '')) throw new Error('A full lowercase source commit SHA is required for each image');
  return value;
}

export async function resolveCandidateImage({ reference, revision, allowLocalImages = false, runCommandFn, env } = {}) {
  const parsed = parseCandidateImageReference(reference, { allowLocalImages });
  assertCandidateRevision(revision);
  if (parsed.kind === 'registry-digest') {
    await runCommandFn({ command: 'docker', args: ['pull', reference], env, timeoutMs: 180_000 });
  }
  // Select fields explicitly: full Docker inspect includes environment secrets.
  const inspected = await runCommandFn({ command: 'docker', args: ['image', 'inspect', '--format',
    '{"imageId":{{json .Id}},"os":{{json .Os}},"architecture":{{json .Architecture}},"descriptor":{{json .Descriptor}},"revision":{{json (index .Config.Labels "org.opencontainers.image.revision")}}}', reference], env });
  let values;
  try { values = JSON.parse(inspected.stdout); }
  catch { throw new Error('Image identity inspection returned an invalid response'); }
  const { imageId, os, architecture, revision: observedRevision } = values ?? {};
  if (!imageIdPattern.test(imageId) || os !== 'linux' || !['amd64', 'arm64'].includes(architecture)) {
    throw new Error('Candidate acceptance requires an identified Linux amd64 or arm64 image');
  }
  if (parsed.kind === 'local-image' && imageId !== reference) throw new Error('The inspected local image ID did not match its input');
  if (observedRevision !== revision) throw new Error('The image source revision label does not match the expected commit');
  const platform = `${os}/${architecture}`;
  let platformManifestDigest = null;
  if (values.descriptor) {
    const selected = await runCommandFn({ command: 'docker', args: ['image', 'inspect', '--platform', platform,
      '--format', '{{json .Descriptor}}', imageId], env });
    let descriptor;
    try { descriptor = JSON.parse(selected.stdout); } catch { throw new Error('Invalid platform image descriptor'); }
    if (!imageIdPattern.test(descriptor?.digest)
      || !['application/vnd.oci.image.manifest.v1+json', 'application/vnd.docker.distribution.manifest.v2+json'].includes(descriptor.mediaType)) {
      throw new Error('The selected image must resolve to a platform manifest');
    }
    platformManifestDigest = descriptor.digest;
  }
  return { ...parsed, imageId, platform, platformManifestDigest, revision };
}

export function assertDistinctCandidateImages({ baseline, candidate }) {
  if (baseline.imageId === candidate.imageId) throw new Error('Upgrade acceptance requires distinct baseline and candidate images');
  if (baseline.revision === candidate.revision) throw new Error('Upgrade acceptance requires distinct source revisions');
  if (baseline.platform !== candidate.platform) throw new Error('Baseline and candidate must use the same platform');
}

export async function verifyCandidateContainerImage({ composeArgs, env, runCommandFn, expectedImage }) {
  const listed = await runCommandFn({ command: 'docker', args: [...composeArgs, 'ps', '-q', 'harmoniarr'], env });
  const containerId = listed.stdout.trim();
  if (!/^[a-f0-9]{64}$/.test(containerId)) throw new Error('Expected exactly one candidate application container');
  const inspected = await runCommandFn({ command: 'docker', args: ['container', 'inspect', '--format',
    '{"image":{{json .Image}},"descriptor":{{json .ImageManifestDescriptor}},"readOnly":{{json .HostConfig.ReadonlyRootfs}},"privileged":{{json .HostConfig.Privileged}},"capDrop":{{json .HostConfig.CapDrop}},"securityOpt":{{json .HostConfig.SecurityOpt}},"user":{{json .Config.User}},"ports":{{json .NetworkSettings.Ports}}}', containerId], env });
  let actual;
  try { actual = JSON.parse(inspected.stdout); } catch { throw new Error('Invalid container image descriptor'); }
  const matched = expectedImage.platformManifestDigest
    ? actual?.descriptor?.digest === expectedImage.platformManifestDigest
      && `${actual.descriptor.platform?.os}/${actual.descriptor.platform?.architecture}` === expectedImage.platform
    : actual?.image === expectedImage.imageId;
  if (!matched || !imageIdPattern.test(actual?.image)) throw new Error('The running container does not use the resolved immutable image');
  const bindings = actual.ports?.['3000/tcp'];
  if (actual.readOnly !== true || actual.privileged !== false || actual.user !== '1000:1000'
    || !actual.capDrop?.includes('ALL') || !actual.securityOpt?.includes('no-new-privileges:true')) {
    throw new Error('The running candidate does not satisfy fixture hardening');
  }
  if (Object.keys(actual.ports ?? {}).length !== 1 || !Array.isArray(bindings) || bindings.length !== 1
    || bindings[0].HostIp !== '127.0.0.1' || bindings[0].HostPort !== env?.HARMONIARR_PORT) {
    throw new Error('The running candidate must publish only the expected loopback HTTP port');
  }
  return { imageId: expectedImage.imageId, platform: expectedImage.platform,
    platformManifestDigest: expectedImage.platformManifestDigest ?? null, containerImageId: actual.image,
    imageVerified: true, hardeningVerified: true, loopbackBindingVerified: true };
}
