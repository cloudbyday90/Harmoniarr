# Published acceptance readiness design

Research date: September 13, 2026. Harmoniarr's next release gate is the existing published-candidate verifier, not another application refactor. The prior local image rehearsal proves notification continuity through 104 migrations but does not prove published origin or baseline acceptance.

## Design and source basis

Retain the existing native ESM provenance verifier, exact GHCR digest inputs, source and signer revision restrictions, repository/workflow identity, hosted-runner requirement, bounded output, baseline release metadata and tag resolution, and immutable Docker runtime acceptance. Successful GitHub CLI verification can restrict source digest, signer digest and workflow, and returns verified attestations as JSON. [GitHub CLI attestation verification](https://cli.github.com/manual/gh_attestation_verify).

Registry access and GitHub CLI authentication are separate from MCP repository access and Git push access. Public GHCR images allow anonymous pulls; private package access requires appropriate registry authorization. A 403 alone does not establish whether an image exists or whether it is private. Keep credentials in configured authentication stores and out of docs, command output, fixture arguments, and build arguments. [GitHub Container registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry), [GitHub Packages permissions](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages).

Inspect actual published release metadata and immutable image references before running acceptance. Do not substitute a mutable tag or local image ID for unavailable published inputs. Selecting a published baseline is distinct from recording that a release owner has accepted it. No release publication or tag creation follows implicitly from an acceptance request.

## Bounded change

Independent code review found no demonstrated production gap: published acceptance already calls the current immutable runtime verifier, including the notification schema and restart/upgrade continuity checks. Its wrapper test fixture predates those evidence fields, however. Update only that fixture and its assertions to prove current phase evidence survives the publication overlay unchanged. Keep provenance verification, published-baseline verification, and accepted-baseline status separate.

Use realistic fresh, restart, baseline, and upgraded summaries. Assert four-notification/one-subscription counts; current candidate schema verification; restart and upgrade continuity; unchanged phase evidence; provenance and publication status true only after the existing trust path; acceptedReleaseBaselineVerified remains false. Do not duplicate runtime validation in the wrapper or introduce a bypass for unavailable credentials.

## Alternatives and recommendation stack

| Option | Benefit | Cost and decision |
| --- | --- | --- |
| Execute existing published gate with verified inputs | Establishes real artifact provenance plus runtime behavior | Requires accessible digests, valid authentication, and a selected published baseline; preferred |
| Substitute local proof or relax verification | Lets a run complete | Misstates release assurance; reject |
| Add another verifier or refactor working runtime code | Creates another implementation | No demonstrated gap justifies added risk; reject |
| Improve wrapper evidence coverage and record readiness blockers | Prevents regression while preserving the gate | Does not itself complete live acceptance; selected bounded work |

Final stack: existing ESM trust verifier, authenticated registry access where required, immutable digest and revision binding, published metadata/tag verification, existing Docker acceptance, explicit evidence separation, and focused wrapper regression coverage.

No HTML, focus, keyboard, or browser notification behavior changes. Database fixture preservation is distinct from W3C delivery/display semantics; the prior [packaged continuity design](PACKAGED_NOTIFICATION_CONTINUITY_DESIGN.md) records those boundaries. This test-only change supplies no new browser delivery evidence.

## Validation plan

Run the focused published acceptance/provenance tests and script suite with script/test lint. Record exact external access results, actual discoverable releases, PR disposition, and executed validation in a separate outcome document. A blocked published run must remain blocked; do not generate a passed artifact without all inputs and checks.
