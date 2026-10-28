# Dependabot ORAS local implementation outcome

October 28, 2026. See the separate [design](DEPENDABOT_ORAS_DESIGN.md) and
[official research](APPLE_HTTP_RESEARCH_2026_10.md).

## Applied and tested

GitHub MCP returned two fresh mergeable Dependabot PRs, #59 and #60, both based
on starting main `09e549a7151e574188a4b9ef1f52c5697973b3b1`. A local cryptographic
random draw selected [#60](https://github.com/cloudbyday90/Harmoniarr/pull/60).
Its exact one-line setup-oras v2.0.0 → v2.0.2 full-SHA change was applied locally.
Upstream tag checkout and MCP action metadata agree on
`005458ad77f1c8facd38a094e4af2e69e5607ff4`. No PR was merged.

The action runs on Node 24 and still defaults to ORAS CLI 1.3.1. The actual
published bundle executed on Node 24.22.1 inside an isolated non-root container,
downloaded that CLI and reported successful embedded-checksum validation. The
installed binary passed local OCI-layout push, manifest fetch, recursive copy
and JSON discovery; the copied manifest matched. No registry credentials were
supplied and nothing was published to a registry. Bundle SHA-256:
`addc45a14de1e7fd8b8d5c6fca7aeec465d966d44fac5061be921aa98302a784`.

The full script/policy suite passed 703 tests alongside the application gate.
Workflow permissions, inputs, mirror conditions and manual release trigger are
unchanged. The release workflow was not dispatched; no release/tag was created.
This local installation/OCI proof does not certify a GitHub-hosted runner,
authenticated registry behavior, referrers, signing or release publication.

Two failed fixture candidates are retained: the first lacked the runner-created
GITHUB_PATH file; the second staged the executable on a noexec temporary mount.
Providing the expected path file and an executable fixture-only temporary
directory corrected those test-environment mismatches. No production mount or
workflow security policy was changed. All three exact containers were removed
and absence verified. Private logs are under `.tmp/apple-http-2026-10-28/`.

## Verified PR cleanup

Implementation commit `208c25bcd1f294090024e97d5fbdd4d8ccd13ac2` was pushed to
main. GitHub MCP then read the updated workflow from remote main and confirmed
the exact tested pin. A comment records the local application and validation;
PR #60 was closed as superseded at 09:53:40 UTC on October 28, 2026, with
`merged: false`. No PR merge or release dispatch occurred.

PR #59 remains fresh and mergeable; its independent Buildx update is retained.
It needed no stale/conflict rebase. No dependency ignore condition or bot-branch
force-push was used. This documentation follow-up changes no frozen source,
workflow, package or tested runtime bytes.
