# Candidate staging and release tag promotion design

Date: September 12, 2026. Harmoniarr is a Soulseek-native music library manager using Node 24 native ESM, Vue, and PostgreSQL.

## Decision

Build each release candidate under a run-specific tag containing the full source SHA, run ID, and attempt. Stage the same multi-architecture image in GHCR and the optional Docker Hub mirror. Neither the build nor the trusted-mirror referrer copy may write version, release, or latest aliases before acceptance.

Retain the existing release metadata schema: its tag list describes the intended final aliases. Before promotion, verification checks immutable digest references, not aliases that do not exist yet. The trusted-mirror copy receives an explicit candidate-only destination; its normal standalone release-tag behavior remains available outside this workflow.

Add a separate promotion job after provenance, startup/browser, optional upgrade, and release/mirror contract checks succeed. GitHub draft finalization depends on successful promotion and its evidence upload. Derive all targets from the validated release/repository plan; no arbitrary target list, rebuild, platform filter, annotation change, imported success report, or skip flag is accepted.

## Digest-preserving promotion

Use the existing Docker Buildx dependency. Inspect raw manifest bytes for every enabled registry's immutable source before any tag write, validate the document, and require its SHA-256 to match the accepted top-level digest. Preserve bytes unchanged when hashing; trimming or serializing JSON again would change the identity.

Promote one same-repository source with `docker buildx imagetools create --prefer-index=false --tag <planned-alias> <repository@digest>`. The flag avoids wrapping a single-platform manifest in a new index. Do not append sources or add platform/annotation options. Reinspect and hash every alias immediately after its write and again in a final complete sweep. Only a fully matching result produces passed sanitized evidence in a new file.

The ordinary prerelease rule remains: version and release-tag aliases are promoted, with latest only for stable releases. Deduplicate aliases when version and release tag coincide. The CLI validates dispatch repository/source context, but its evidence proves digest/tag binding; provenance and runtime acceptance come from the preceding workflow gates.

## Security and recovery

Use native ESM modules for plan policy, bounded shell-free command execution, promotion orchestration, and CLI evidence. Registry credentials stay in the runner's login store; diagnostics and credentials are not serialized into evidence. The promotion job needs contents read and packages write, with optional Docker Hub login. It does not need release write or attestation-signing permissions.

These aliases remain mutable for compatibility with the existing publishing behavior. Promotion intentionally sets the planned aliases to the accepted digest; it does not promise to refuse every previously occupied version alias or prevent an older stable release from moving latest. Stricter version-conflict and channel-ordering policy needs an explicit design and reliable registry state handling.

This portable primitive has no multi-tag or cross-registry transaction or compare-and-swap guarantee. Workflow concurrency serializes this workflow, not external writers. A failed promotion can leave some aliases changed. Stop without automatic rollback or deletion, retain the accepted digest, and inspect registry state before recovery. Never infer that a tag is absent from an authentication or network error. Candidate tags are retained; garbage collection is a separate policy.

## Official research

Sources discovered and opened through research tools on September 12, 2026:

- [Buildx imagetools create](https://docs.docker.com/reference/cli/docker/buildx/imagetools/create/): single-source copying, index preference, and tagging behavior.
- [Buildx imagetools inspect](https://docs.docker.com/reference/cli/docker/buildx/imagetools/inspect/): raw manifest inspection.
- [Buildx raw printer implementation](https://github.com/docker/buildx/blob/master/util/imagetools/printers.go): raw output writes the original bytes without appending a newline.
- [ORAS tag](https://oras.land/docs/commands/oras_tag/) and [manifest fetch](https://oras.land/docs/commands/oras_manifest_fetch/): alternative same-repository tagging and descriptor inspection.
- [OCI distribution specification](https://github.com/opencontainers/distribution-spec/blob/main/spec.md): manifest bytes, digests, and registry semantics. This implementation does not use optional registry-specific conditional writes.

## Alternatives and recommended stack

| Option | Pro | Con | Decision |
| --- | --- | --- | --- |
| Existing Buildx, one digest source | Reuses installed tooling; preserves multi-architecture content | Must disable index wrapping and verify exact bytes | Adopt |
| ORAS tag for all aliases | Direct same-repository tagging primitive | Adds mandatory ORAS setup beyond optional mirror support | Keep as an alternative |
| Direct OCI manifest PUT | Exact byte control | New authentication, media-type, and error handling | Defer |
| Rebuild after acceptance | Simple familiar build operation | Tests and published image can differ | Reject |
| Candidate-only mirror copy | Keeps referrer verification before public aliases move | Adds explicit staging destination and digest-only checks | Adopt |

Retain Node 24 native ESM, modular services, canonical GHCR digests, existing Buildx, bounded raw-byte verification, candidate-only staging, gated alias promotion, and draft-first immutable GitHub publication. Keep content identity, provenance, runtime acceptance, mutable aliases, and release approval independently reviewable.

## W3C boundary

No application UI, DOM semantics, ARIA, or focus behavior changes. Browser smoke remains a distinct acceptance gate, not an accessibility conformance claim from the registry tooling. Operator documentation distinguishes staged candidates, verified promotion, partial failures, and immutable GitHub publication.

See the separate [outcome](RELEASE_TAG_PROMOTION_OUTCOME.md) for validation, PR dispositions, and next priorities.
