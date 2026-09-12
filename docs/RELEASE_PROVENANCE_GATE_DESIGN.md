# Release provenance gate design

Date: September 12, 2026. Platform: Harmoniarr, a Soulseek-native music library manager using Node 24 native ESM, Vue, and PostgreSQL.

## Decision

Make `verify-image-provenance` a mandatory job after publication/attestation and before any released-image startup, browser, or upgrade execution. Both runtime jobs depend directly on its successful completion. The final release-contract job explicitly requires its success even when an optional upgrade job is skipped.

The shared ESM verifier uses live GitHub cryptographic verification with the exact repository, release workflow, source SHA, signer SHA, SLSA provenance type, and hosted-runner restriction. Candidate identity comes from the published digest and `github.sha`, matching the checked-out build and signing revision. The gate cannot accept imported proof or skip verification. Registry credentials remain in the runner credential store; reports contain sanitized verification facts only.

Resolve optional baseline digest and full revision as a pair. If either dispatch input is supplied, require both; otherwise use the two repository variables. No pair means an explicitly skipped upgrade. A partial, mutable, foreign, or malformed pair fails the mandatory gate. Validate before writing GitHub outputs, then use those same outputs for verification and upgrade execution. Workflow expressions enter scripts through environment variables, not generated shell source.

Verification jobs receive only contents, packages, and attestations read permissions. The gate has no private-repository success bypass: unavailable attestation support blocks execution. Its passed artifact proves origin verification, not runtime success, baseline publication, or independent release approval. The full published-candidate acceptance command still owns publication/tag/metadata and isolated runtime checks.

## Official research

Sources discovered and opened through research tools on September 12, 2026:

- [GitHub CLI attestation verification](https://cli.github.com/manual/gh_attestation_verify): constrain repository/workflow and certificate-derived source/signer identity; predicate fields alone are not trustworthy identity.
- [GitHub job dependencies](https://docs.github.com/en/enterprise-cloud@latest/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs): `needs` orders jobs and propagates unsuccessful dependencies.
- [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax): scope token permissions to the job.
- [GitHub secure workflow use](https://docs.github.com/en/actions/reference/security/secure-use): intermediate environment variables avoid expression injection into shell source.
- [GitHub expressions](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions): explicit result checks matter when using status functions for aggregation.

The next lifecycle recommendation follows [GitHub immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases): prepare release assets in a draft before publishing, because publication locks protected assets and tags.

## Alternatives and recommendation

| Choice | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Mandatory shared provenance job | Blocks every runtime path before image execution; one identity policy | Registry and attestation outages block checks | Adopt |
| Repeat verification inside every runtime job | Independent runner verification | Repeated network calls and policy wiring | Reserve for separately reusable jobs |
| Post-runtime attestation check | Minimal workflow changes | Executes before origin is established | Remove |
| Paired baseline digest/revision | Prevents stale fallback identity | Operators must maintain both values | Adopt |
| Private-repository bypass | Allows unsupported configurations to continue | Converts missing trust into successful execution | Reject |

## W3C and security boundaries

This change adds no browser UI, DOM, ARIA roles, or focus behavior. Existing browser smoke remains a separate check after trust succeeds; provenance is not an accessibility conformance result. No application credentials, provider tokens, or raw attestation diagnostics are placed in product UI or evidence. Build provenance, runtime behavior, accessibility, and release approval remain independently reviewable facts.

See the separate [outcome](RELEASE_PROVENANCE_GATE_OUTCOME.md) for tests, limitations, PR disposition, and next priorities.
