/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createPublishedCandidateCommand } from './published-docker-candidate-command.js';
import { normalizePublishedImageInputs, parseVerifiedImageAttestations, publishedImagePredicateType,
  projectPublishedImageProvenance } from './published-image-provenance-policy.js';

export async function verifyPublishedImageProvenance(options, {
  runTrustCommandFn = createPublishedCandidateCommand(), env = process.env, getNow = () => new Date(),
} = {}) {
  try {
    const inputs = normalizePublishedImageInputs(options);
    const result = await runTrustCommandFn({ command: 'gh', env, timeoutMs: 90_000,
      args: ['attestation', 'verify', `oci://${inputs.imageRef}`,
        '--hostname', 'github.com', '--repo', inputs.repository,
        '--signer-workflow', inputs.signerWorkflow, '--source-digest', inputs.revision,
        '--signer-digest', inputs.revision, '--deny-self-hosted-runners',
        '--predicate-type', publishedImagePredicateType, '--limit', '10', '--format', 'json'],
    });
    if (result?.exitCode !== 0 || typeof result.stdout !== 'string' || Buffer.byteLength(result.stdout) > 1_048_576) {
      throw new Error('Published image verification returned an invalid response');
    }
    const attestation = parseVerifiedImageAttestations(result.stdout, { reference: inputs.imageRef, imageName: inputs.imageName });
    return projectPublishedImageProvenance({
      schemaVersion: 1, verificationKind: 'published-image-provenance', status: 'passed', provenanceVerified: true,
      ...attestation, revision: inputs.revision, repository: inputs.repository,
      signerWorkflow: inputs.signerWorkflow, predicateType: publishedImagePredicateType, verifiedAt: getNow().toISOString(),
    }, inputs);
  } catch {
    throw Object.assign(new Error('Published image provenance verification failed; no verified image evidence was produced'), {
      code: 'published_image_provenance_failed',
    });
  }
}
