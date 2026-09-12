# Published candidate trust outcome

Recorded September 12, 2026. The separate [design document](PUBLISHED_CANDIDATE_TRUST_DESIGN.md) contains official-source research and policy tradeoffs.

## Implemented tooling

`npm run validate:published-candidate` now provides a strict published-artifact path. Small native ESM modules own input policy, bounded read-only GitHub execution, provenance/release lookup, orchestration, and CLI evidence handling. Both candidate and baseline must use canonical repository GHCR digest references and distinct full source revisions.

Before Docker fixture allocation, the command invokes live `gh attestation verify` for each digest with the exact repository, checked-in release workflow, source SHA, signer SHA, SLSA predicate, GitHub hostname, and hosted-runner restriction. It requires a matching verified subject and does not accept imported verification reports or skip flags. API release/tag/asset lookups verify the selected published baseline's metadata and source relationship. Annotated tag chains and command outputs are bounded; metadata URLs or suggested commands are never executed.

Only completed runtime checks, matching verified identities, and successful cleanup produce passed runtime evidence. The result distinguishes `provenanceVerified` and `publishedBaselineVerified` from `acceptedReleaseBaselineVerified`, which remains false. Publication and explicit selection are not independent historical baseline approval.

The existing runtime harness now accepts patch upgrades with zero added migrations while still checking every retained ledger checksum, required indexes, request continuity, distinct image/revision identities, recovery tools, and cleanup. A missing, malformed, or negative migration count cannot masquerade as zero.

## Actual availability and remaining gate

No live published-candidate acceptance was completed. No passed runtime/provenance artifact was produced, no candidate or baseline image was executed, and no release or workflow was published/dispatched in this slice.

- GitHub MCP returned zero releases and zero retained release-event runs. The inspected 20 manual runs were browser workflows, not release-image publishing runs. This does not establish that no historical artifact ever existed.
- Local `gh 2.95.0` supports the verification flags. A direct release-list retry returned HTTP 401, `Bad credentials`; an earlier GraphQL attempt timed out during TLS setup. The new bounded command wrapper also failed the live read-only release lookup with its sanitized error code.
- Read-only `docker buildx imagetools inspect ghcr.io/cloudbyday90/harmoniarr:0.1.0-beta` returned HTTP 403. Registry access was unavailable; package absence was not proven.
- A local image bearing that registry tag has Compose build labels and no expected source revision label. It was not substituted for a verified published artifact.
- No distinct published candidate digest and reviewed accepted-baseline record could be established from the available evidence. Existing local 97-to-98 migration evidence remains local evidence and does not cover this release gate.

Starting commit `a4b4182` had successful Repository Validation, Browser Validation, Security, and Supply Chain runs when inspected through GitHub MCP. That source CI result does not establish published image provenance or baseline acceptance.

## Validation

- The trust/command modules passed 32 focused tests, including rejection before runtime, wrong or absent digest proof, source/signer flag enforcement, bad release metadata, annotated tag handling, timeout/error containment, and runtime identity mismatch.
- The CLI and existing runtime/schema focused group passed 15 tests; the final runtime regression also rejects malformed/missing migration counts. CLI `--help` executed successfully.
- The actual bounded GitHub release preflight failed safely with `published_candidate_trust_command_failed`; this is failure-path evidence, not a passed cryptographic verification.
- `npm run validate` passed repository policies, lint, all 8,168 tests (3,426 server, 4,205 client, 414 script, 123 integration; zero failures or skips), and client/server production builds.
- `npm run validate:security` passed image/topology policies and npm audit with zero reported vulnerabilities.

No schema, browser UI, dependency, or deployment configuration changed. The command retains existing native application behavior exercised by the runtime harness; source/unit verification here is not new accessibility or live Docker evidence.

## Open PR disposition

All current open PR heads and complete patches were reviewed through GitHub MCP. None was applicable, and none was applied locally or merged.

| PR | Reviewed head | Finding |
| --- | --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Node 26 fixture conflicts with retained Node 24 LTS. |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Build/push 7.2 is superseded by local 7.3. |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Metadata 6.1 is superseded by local 6.2. |

## Next five priorities and recommendation stack

| Priority | Recommendation | Pros | Cons / prerequisite |
| --- | --- | --- | --- |
| 1 | Move strict origin verification before image execution in the publishing workflow. | Applies the new policy automatically to candidate and baseline execution. | Requires explicit baseline revision/approval inputs and a policy for the first release. |
| 2 | Establish a reviewed baseline record and run the new command with accessible published digests. | Closes the missing published runtime/provenance evidence. | Requires valid GitHub/registry access and actual artifacts; no local fallback can close it. |
| 3 | Design draft â†’ attach assets â†’ publish handling for immutable GitHub releases. | Protects tag/assets after release publication. | Current post-publication asset upload sequence must change. |
| 4 | Complete live provider and operator recovery acceptance against the final candidate. | Verifies external access and recoverability in the shipped runtime. | Requires eligible saved connections and isolated recovery rehearsal. |
| 5 | Add supported-platform execution and representative load evidence. | Exposes architecture-specific and scale regressions. | Requires suitable runners and explicit performance budgets. |

Retain Node 24 native ESM, small policy/orchestration/command modules, canonical GHCR digests, live GitHub certificate-policy verification, isolated Docker runtime checks, and sanitized evidence written after cleanup. Keep publication, provenance, runtime success, and independent release approval as separate facts. The next code item is moving the publishing workflow's existing repository-only, post-smoke provenance check before execution with the stricter identity policy; the live release gate remains blocked by artifact/access/baseline prerequisites.

## Follow-up implementation

The first recommendation is implemented in the [release provenance gate outcome](RELEASE_PROVENANCE_GATE_OUTCOME.md). Live published acceptance and baseline approval remain separate outstanding gates.
