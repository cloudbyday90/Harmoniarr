/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createHash } from 'node:crypto';
import { createPublishedCandidateCommand } from './published-docker-candidate-command.js';
import { normalizePublishedCandidateInputs, parseVerifiedImageAttestations, publishedCandidatePredicateType,
  selectBaselineMetadataAsset, verifyBaselineMetadata } from './published-docker-candidate-policy.js';

export async function verifyPublishedCandidateTrust(options, {
  runTrustCommandFn = createPublishedCandidateCommand(), env = process.env,
} = {}) {
  const inputs = normalizePublishedCandidateInputs(options);
  async function run(args, timeoutMs) {
    const result = await runTrustCommandFn({ command: 'gh', args, env, timeoutMs });
    if (result?.exitCode !== 0 || typeof result.stdout !== 'string' || Buffer.byteLength(result.stdout) > 1_048_576) {
      throw new Error('Published candidate verification returned an invalid response');
    }
    return result.stdout;
  }
  async function get(path, { asset = false } = {}) {
    return run(['api', '--hostname', 'github.com', '--method', 'GET',
      '--header', `Accept: ${asset ? 'application/octet-stream' : 'application/vnd.github+json'}`,
      '--header', 'X-GitHub-Api-Version: 2022-11-28', path], 30_000);
  }
  async function verifyImage(reference, revision) {
    const output = await run(['attestation', 'verify', `oci://${reference}`,
      '--hostname', 'github.com', '--repo', inputs.repository,
      '--signer-workflow', inputs.signerWorkflow, '--source-digest', revision,
      '--signer-digest', revision,
      '--deny-self-hosted-runners', '--predicate-type', publishedCandidatePredicateType,
      '--limit', '10', '--format', 'json'], 90_000);
    return { ...parseVerifiedImageAttestations(output, { reference, imageName: inputs.imageName }), revision };
  }
  const candidate = await verifyImage(inputs.candidateImageRef, inputs.candidateRevision);
  const baseline = await verifyImage(inputs.baselineImageRef, inputs.baselineRevision);
  const release = JSON.parse(await get(`repos/${inputs.repository}/releases/tags/${encodeURIComponent(inputs.baselineReleaseTag)}`));
  const asset = selectBaselineMetadataAsset(release, inputs);
  const metadataText = await get(`repos/${inputs.repository}/releases/assets/${asset.id}`, { asset: true });
  if (Buffer.byteLength(metadataText) > 131_072) throw new Error('Baseline release metadata exceeds its bound');
  verifyBaselineMetadata(JSON.parse(metadataText), inputs);

  const ref = JSON.parse(await get(`repos/${inputs.repository}/git/ref/tags/${encodeURIComponent(inputs.baselineReleaseTag)}`));
  if (ref.ref !== `refs/tags/${inputs.baselineReleaseTag}`) throw new Error('Baseline tag resolution did not match the selected release');
  let object = ref.object;
  const seen = new Set();
  for (let depth = 0; object?.type === 'tag' && depth < 5; depth += 1) {
    if (!/^[a-f0-9]{40}$/.test(object.sha ?? '') || seen.has(object.sha)) throw new Error('Invalid baseline tag chain');
    seen.add(object.sha);
    const tag = JSON.parse(await get(`repos/${inputs.repository}/git/tags/${object.sha}`));
    if (tag.sha !== object.sha) throw new Error('Baseline tag object identity changed');
    object = tag.object;
  }
  if (object?.type !== 'commit' || object.sha !== inputs.baselineRevision) {
    throw new Error('Baseline release tag does not resolve to the verified source revision');
  }
  return {
    candidate, baseline, repository: inputs.repository, signerWorkflow: inputs.signerWorkflow,
    baselineRelease: { releaseId: release.id, tag: inputs.baselineReleaseTag, publishedAt: release.published_at,
      sourceRevision: object.sha, metadataAssetId: asset.id,
      metadataSha256: createHash('sha256').update(metadataText).digest('hex') },
  };
}
