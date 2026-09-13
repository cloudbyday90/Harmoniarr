# Immutable candidate acceptance outcome

Completed: 2026-09-11. Design, official-source research, and tradeoffs are in the separate [design document](IMMUTABLE_CANDIDATE_ACCEPTANCE_DESIGN.md). Operator instructions are in [release.md](../release.md#strict-candidate-acceptance).

## Delivered

`npm run validate:docker-candidate` now verifies a single immutable candidate through fresh installation, retained-data restart, and upgrade from an earlier immutable image. Native ESM modules separate image identity, bounded Docker commands, disposable fixture configuration, packaged schema probes, orchestration, and evidence writing. Existing smoke scenarios receive narrow verification hooks and strict cleanup rather than another large embedded subsystem.

The command rejects tag-only inputs, partial IDs, mismatched source labels, identical baseline/candidate artifacts, and different platforms. Registry digest references are pulled and resolved once. Full local image IDs require `--allow-local-images`; every subsequent scenario starts the resolved identity without rebuilding or pulling a replacement. Containerd platform-manifest checks account for image index and container-reported identifiers differing.

Actual container checks cover the image manifest, read-only root filesystem, unprivileged UID/GID, dropped capabilities, no privilege escalation, and exactly one HTTP port bound to the expected loopback address. The fixture uses generated credentials and owned temporary bind directories, excludes operator `.env` and application/database/provider variables, and verifies that its containers, networks, volumes, and temporary directories are gone before returning a pass. Evidence uses fixed fields and excludes credentials, private fixture content, raw logs, and host paths. Each run reserves a new output file.

Packaged checks read the image's own migration manifest and live ledger, verify both pagination indexes, run the included `pg_dump`, `pg_restore`, and `harmoniarrctl`, and preserve a generated disabled requester and review-pending request across the upgrade. Candidate runtimes require Node 24 and PostgreSQL 18.6 or newer within major 18. Baselines may use earlier PostgreSQL 18 minors. The current transition deliberately requires the baseline to predate the pagination migration.

The legacy smoke evidence contract also now recognizes `upgrade-path`, the name emitted by the deployment wrapper; previously that spelling bypassed the required upgrade sections.

## Executed image proof

The application candidate was built from runtime source commit `24d9dfb3415a9246d19068779d63d7111095c4bd`; the baseline was built from a detached checkout of `17bbd386423127a2710eacbca84af87b28edc651`. Each build carried its full source revision label. These are local builds of known source revisions, not published releases or verified attestations. The new acceptance tooling runs on the host against those packaged application revisions.

| Artifact | Immutable local identity | Linux/amd64 platform manifest |
| --- | --- | --- |
| Candidate | `sha256:38634ac85f9615a8511566d57aa17c2beb4e6b86b134748801c215f2d65f5ad6` | `sha256:0bf1baefc31efd3c950b5c3a9bc836ba35abdb5ba514a63decfe09bb75691406` |
| Baseline | `sha256:f571fd67b614227a5bf3632c82513ff3aab96880e91dda70dfa7a648e55d537f` | `sha256:f0b4a11eecbe6c7d00767fcba80f3d7dbf60c78dce5668365471aaf6db2e7bb8` |

The successful command was:

```powershell
node scripts/validate-docker-candidate.js `
  --candidate-image sha256:38634ac85f9615a8511566d57aa17c2beb4e6b86b134748801c215f2d65f5ad6 `
  --baseline-image sha256:f571fd67b614227a5bf3632c82513ff3aab96880e91dda70dfa7a648e55d537f `
  --candidate-revision 24d9dfb3415a9246d19068779d63d7111095c4bd `
  --baseline-revision 17bbd386423127a2710eacbca84af87b28edc651 `
  --allow-local-images `
  --evidence-path .tmp/immutable-candidate-acceptance-3.json
```

Evidence timestamp: `2026-09-11T11:12:20.090Z`. SHA-256 of that JSON: `13e3b507ec846b5db0464c7358f93c8a05e244b9e0a49adafe992ae634056440`. The artifact records `local-artifact-runtime`, `provenanceVerified:false`, `acceptedReleaseBaselineVerified:false`, and `cleanupVerified:true`. Docker Engine was 29.7.2, API 1.55.

| Check | Result |
| --- | --- |
| Candidate fresh installation | 98 applied migrations, matching packaged checksums, zero pending |
| Existing-data restart | Same 98 migration records and persisted database probe; no snapshot reload or cluster reinitialization |
| Baseline startup | 97 applied migrations, matching packaged checksums, zero pending |
| Upgrade | All old migration IDs/keys/checksums/status retained; one new migration, 98 total |
| Pagination indexes | Both exact definitions present, valid, and ready after fresh installation and upgrade |
| Generated request continuity | Request content, recipient ownership, disabled requester, and timestamps preserved |
| Packaged runtime/tools | Node 24.19.0; PostgreSQL, pg_dump, and pg_restore 18.6; application CLI help executed |
| Existing functional smoke flows | Backup/restore routes, maintenance conflict refusal, delegated requester scope, persisted settings, and invalid-startup refusal passed |
| Isolation and cleanup | Generated fixture resources removed; existing deployments were not operated on |

Two failed setup attempts produced empty reserved evidence files. The first exposed a Windows Compose-plugin discovery dependency on the OS ProgramFiles path; that path is now retained in the otherwise restricted child environment. The second exposed Docker Desktop suppressing host publishing on an internal network. A disposable comparison proved zero published bindings on the internal network and a working loopback binding on bridge networking. The final fixture uses a dedicated bridge and makes **no outbound network isolation claim**. Provider integrations are not configured from operator state.

## Validation

| Command | Result |
| --- | --- |
| `npm run validate` | Passed: 8,084 Node tests, zero failures or skips, repository policies, both builds |
| `npm run test:scripts` after final script edits | Passed: 378 tests |
| `npm run lint:scripts` and `npm run lint:test` after final script edits | Passed |
| `npm run validate:security` | Passed: zero reported dependency vulnerabilities |
| Direct candidate CLI, above | Passed all fresh/restart/upgrade phases and cleanup |
| Direct CLI `--help` | Passed without allocating a fixture |
| `git diff --check` | Passed |

The full suite comprises 3,405 server, 4,204 client, 378 script, and 97 integration tests. Logs and sanitized evidence remain under ignored `.tmp/`; generated fixture data and the detached baseline checkout were removed. No Vue behavior changed, so this slice uses the existing browser/accessibility proof rather than claiming a new visual audit.

The prior source commit's hosted [Repository Validation run](https://github.com/cloudbyday90/Harmoniarr/actions/runs/34590695878) failed during Docker Hub authentication timeout while starting a PostgreSQL test fixture, before its application assertion. Its schema, migration, and dedicated recovery jobs passed; [Browser Validation](https://github.com/cloudbyday90/Harmoniarr/actions/runs/34590695974), Security, and Supply Chain also passed. Local full validation succeeded here. Future CI remains a separate observation.

## PR review and limits

GitHub MCP refreshed all open PRs and their complete patches. None was applicable, so none was applied or merged:

- [PR #40](https://github.com/cloudbyday90/Harmoniarr/pull/40), head `649659f1e199d48d55cc8d5cccf9f079dc235d86`, changes only the controlled fixture to Node 26; the supported application remains Node 24 LTS.
- [PR #24](https://github.com/cloudbyday90/Harmoniarr/pull/24), head `40cf4d117b69bd55b9a0a7353361838216e1e952`, requests an action version superseded by the newer local pin.
- [PR #23](https://github.com/cloudbyday90/Harmoniarr/pull/23), head `ae651337286216e92be7ae977e39fcedc14de7f9`, is likewise superseded locally.

MCP release discovery returned no published releases, and inspection of the checked-in GHCR tag returned an anonymous access 403. No accepted published baseline was established. A local revision label does not prove trusted origin; release acceptance still needs registry digest references, verified provenance, and an operator-accepted baseline. Only Linux/amd64 was executed. Image vulnerability scanning, ARM64 execution, live provider entitlement, operator media/key recovery, and a production cutover are not established by this rehearsal. PostgreSQL recovery-tool availability is distinct from the separately completed full dump/restore rehearsal.

## Recommendations and final stack

| Priority | Change | Pros | Cons / prerequisite |
| --- | --- | --- | --- |
| 1 | Capture published candidate acceptance with verified provenance and an accepted baseline | Closes the remaining artifact-delivery trust gate using the new executable checks | Requires actual publication/registry access and release ownership; local labels are insufficient |
| 2 | Restore cancellation and reassignment Activity events | Fixes a confirmed operator-observability gap with a bounded code change | Must align registry, database constraint, safe household-visible presentation, and real feed tests |
| 3 | Capture live multi-page provider access | Proves current account entitlement and real response behavior | Requires eligible enabled saved connections; a popular public playlist alone is insufficient |
| 4 | Rehearse operator recovery cutover and external-state reconciliation | Extends generated database proof to keys, roles, media, sessions, and worker fencing | Requires operator recovery objectives and a controlled environment |
| 5 | Measure retained candidate history/search and stabilize external CI fixture setup | Targets remaining scale and release-validation reliability costs | Needs representative history; infrastructure failures must remain visible rather than being skipped |

Recommended stack: Node 24 LTS, small native ESM factories, PostgreSQL 18 with immutable migration history, source-identified container artifacts, separate provenance verification, protected provider credentials, Vue Composition API, and native HTML controls with W3C focus/status semantics. Keep package acceptance, provider access, acquisition completion, and operational recovery as distinct claims.

The next implementable code slice is **cancellation/reassignment Activity event continuity** from the [pagination findings](MUSIC_QUEUE_PAGINATION_OUTCOME.md). Preserve household privacy: do not add private notes, cancellation reasons, provider URLs, or old/new recipient identities to the household feed by default. Published-image and live-provider acceptance remain release gates alongside that code work.

September 12 follow-up: [request lifecycle Activity](REQUEST_LIFECYCLE_ACTIVITY_OUTCOME.md) restores these two event types with a shared public projection, safe native navigation, and real database/route coverage. Its migration increases the source schema to 99; the immutable image evidence above remains tied to its recorded 98-migration candidate.

September 13 follow-up: [packaged notification continuity](PACKAGED_NOTIFICATION_CONTINUITY_OUTCOME.md) refreshes local immutable runtime acceptance to 104 migrations and verifies generated notification/subscription data across restart and upgrade. Published provenance and baseline acceptance remain separate gates.
