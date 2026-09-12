# Published candidate trust design

Design date: September 12, 2026. Harmoniarr is a Docker-first music library manager using Node 24 native ESM, PostgreSQL 18, and Vue. This extends [immutable runtime acceptance](IMMUTABLE_CANDIDATE_ACCEPTANCE_DESIGN.md) without treating local image labels as provenance.

## Decision and trust boundary

Add a separate published-candidate command that verifies both immutable GHCR inputs before allocating a Docker fixture or executing either image. Split command execution, input/trust policy, live release lookup, orchestration, and the CLI into narrow ESM modules. Reuse the existing isolated fresh-install, restart, upgrade, recovery, and cleanup harness.

Run the installed GitHub CLI with shell execution disabled, bounded time/output, a fixed GitHub hostname, and explicit repository, signer-workflow, source commit, signer commit, SLSA provenance type, and hosted-runner restrictions. Require successful cryptographic verification and a nonempty verified statement whose subject matches the requested digest. Never accept user-supplied verification JSON, a success boolean, an OCI label, or the presence of provenance metadata as proof. Raw CLI diagnostics and attestations do not belong in the result artifact.

For the explicitly selected baseline tag, read the published GitHub release, resolve its tag commit, and fetch the named release metadata asset through its API asset identifier. Require publication, exact tag/repository/revision agreement, and the same immutable digest used for cryptographic verification and runtime execution. Do not execute commands or follow arbitrary download URLs from release metadata.

Publication is distinct from acceptance. A published release and matching asset prove the selected baseline's publication relationship, not independent historical release approval or every CI gate. Record `publishedBaselineVerified: true` only after live checks; retain `acceptedReleaseBaselineVerified: false`. An accepted baseline still needs a reviewed acceptance record. The existing mutable release-asset workflow does not establish GitHub immutable-release protection.

Bind the runtime result back to the verified candidate and baseline references/revisions. Only produce passed runtime evidence after fresh/restart/upgrade checks and owned-resource cleanup succeed. Reserve a new output file; reject stale/overwritten evidence and provide no trust-skipping or local-image flag in this command.

Patch releases may retain the same schema. Permit zero added migrations while preserving existing ledger checksums, required candidate indexes, request continuity, distinct images/revisions, and all other runtime checks. Negative migration counts or altered retained records still fail.

## Official research and alternatives

URLs were discovered through web search/MCP and opened September 12, 2026. Local `gh 2.95.0` help also confirms the required verification flags.

GitHub recommends constraining the attesting repository and signer workflow. Its source/signer digest flags enforce certificate-derived origin; arbitrary predicate fields are not equivalent to trusted certificate claims. [GitHub attestation verification](https://cli.github.com/manual/gh_attestation_verify).

Docker stores attestations alongside platform manifests in image indexes. An image digest fixes bytes but does not itself prove origin, and index, platform-manifest, and local configuration identities must remain distinct. [Docker attestations](https://docs.docker.com/build/metadata/attestations/).

GitHub immutable releases protect tags and assets after publication, while release notes remain editable. The recommended lifecycle is draft, attach assets, then publish. The current repository uploads assets after publication, so immutable-release publishing needs separate work. [GitHub immutable releases](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases).

Follow-up: the publishing lifecycle described above has now been replaced by the [draft-first release design](DRAFT_RELEASE_LIFECYCLE_DESIGN.md). Actual immutable publication still requires a successful live run; this source change alone does not establish release approval.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Verify origin before runtime execution | Rejects wrong repository/workflow/source before running image code | Requires working GitHub and registry access | Recommended |
| Trust labels or supplied verification reports | Convenient offline handoff | Neither establishes live cryptographic verification | Reject |
| Repository-only verification after smoke | Existing publishing workflow behavior | Broad identity policy; image already ran before origin verification | Replace in a separate publishing follow-up |
| Published release metadata plus verified image | Connects selected tag, commit, and digest | Mutable metadata is not historical release approval | Record publication only |
| Immutable GitHub release lifecycle | Stronger tag/asset integrity after publish | Requires restructuring draft/asset/publish order | Next publishing design |

## Validation, W3C, and limitations

Test malformed references, wrong source/workflow/digest, failed or empty verification, draft/missing/mismatched releases, incomplete runtime evidence, trust failure before Docker, timeouts, secret-safe errors, and new-file evidence handling. Preserve the existing registry/local runtime evidence distinction. Test unchanged-schema upgrades without weakening retained-data verification.

This is operator CLI tooling; no browser controls, focus, or ARIA roles change. Existing native application status and session/CSRF behavior remain in the runtime harness. Provenance does not replace accessibility or functional evidence.

No release is created or published by this command. It does not infer an accepted baseline from the absence of a previous release, manufacture a first-release history, or substitute local-image proof when registry access fails. See the separate [outcome](PUBLISHED_CANDIDATE_TRUST_OUTCOME.md) for actual availability and validation.
