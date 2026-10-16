# Integration capability preflight outcome

Date: 2026-10-15. Design and official research are separate companion documents:
[design](INTEGRATION_PREFLIGHT_DESIGN.md) and
[research](INTEGRATION_PREFLIGHT_RESEARCH_2026_10.md).

## Delivered behavior

Three narrow ESM modules own capability policy, disposable tool probes and
preflight orchestration. The coordinator invokes them after complete discovery
and before any PostgreSQL/file admission. The CLI publishes approved image IDs
and parsed versions. The default integration command and canonical native cases
remain unchanged. No production runtime, SQL, dependencies or resource/deadline
policy changed.

Media and reader inputs must be explicit local immutable IDs. PostgreSQL must
retain the existing reviewed PostgreSQL 18 Alpine reference; its actual digest
reference is resolved and checked against local image identity. Probes explicitly
refuse image pulls. Each executes one fixed version command with no socket/host
bind or network, as non-root with a read-only root, dropped capabilities and
no-new-privileges. A bounded tmpfs covers PostgreSQL's declared image volume.

Current-owner inspection owns stop/removal. A failed CLI or an acknowledged stop
does not prove remote quiescence. Cleanup awaits actual command closure and
verified retirement, ignores the cancelled work signal and preserves first
Error/null. Final-removal cancellation cannot return a successful capability.
Unknown/changed owners remain refusals, never inferred cleanup targets.

## Validation

All 10,439 fast cases pass: 5,397 server, 4,384 client and 658 script cases;
zero failures, cancellations or skips. Both builds and the fast gate's static
checks pass in 123.389 seconds. Its 225 Vue warnings match the prior collection.
Changed-file ESLint also passes after the final explicit no-pull guard. Focused
planner/coordinator/preflight scope contains 67 passing checks in that final
script collection. Repository testing/standards and installed standards skill
structural validators pass.

The code freeze covers seven changed/new JS files. The complete native run
uses all 3,005 source files with SHA-256
`b6351d94a9f229b735ae7ade4abfefda3ccc8a93681cacafa6625d921774b2d8`.
The new source fingerprint includes all unignored code, excluding Markdown and
private evidence. Keep native source-before/after equality and exact inventory
checks before reporting a full pass.

One fresh actual `scripts/run-integration-tests.js` invocation passed all 127
files and 561 native cases, with zero failures, cancellations, skips or TODOs.
Its process exited zero without a signal. The seven-file shared step released
all 131 registrations with zero reaped. Independent plan comparison proves
every canonical file exactly once, in planned order. All 127 per-file case
signatures and count records match the prior accepted native coverage. Those
historical rows were used only for comparison; none were replayed into this
invocation. Source-before/after equality passed on the fingerprint above.

CLI wall time was 1,825.546 seconds (30m 25.5s); coordinator time was 1,824.914
seconds. Successful capability admission took 8.627 seconds. These are local
observations under the existing host load, not a matched default-command or CI
speedup. No timeout, pool, resource or concurrency bounds were increased.

Native controls on the final code independently execute the known Node-only
reader as a negative control, the correct reader as a positive control and
cancellation after acknowledged creation. The negative control reaches the
Docker version command and refuses the actual missing executable before database
admission; the earlier failure spent over 18 minutes before reaching that test.
All five acknowledged owners in each full probe sequence are removed; the
cancelled sequence removes its single acknowledged owner and preserves null.
No remaining capability-owner containers are observed after each control.
The final controls took 8.969 seconds for expected missing-tool refusal,
9.820 seconds for successful versions and 2.412 seconds for cancellation.

Verified local versions are PostgreSQL 18.3, FFmpeg and FFprobe 8.0.1, Node
24.21.0 and Docker CLI 29.9.0. The PostgreSQL reference resolves to
`postgres:18-alpine@sha256:54451ecb8ab38c24c3ec123f2fd501303a3a1856a5c66e98cecf2460d5e1e9d7`;
media ID is `sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`
and reader ID is `sha256:5898e3f6d6379363eadb683963962b267df72e007f84edec0b3b1b8cd2c65f6e`.
These identify observed local bytes, not general installation defaults or publisher
attestation. The runner does not borrow the application's database or containers.

Private evidence lives under `.tmp/integration-preflight-2026-10-15/`: code
freeze, full source fingerprint, fast log/result, actual complete log/result,
exact-coverage/signature summary and native control results. Prior failed
collections remain under their original directories and are not overwritten.
Repository documents contain approved aggregate evidence; raw native output and
private identifiers remain outside committed documentation.

Opening and closing GitHub MCP PR collection reads returned zero open PRs, so
no random or stale PR was available to implement or rebase. Work stayed on main;
no release, tag, new branch or PR merge was created. App images/Compose were not
rebuilt for this test-only change; the earlier requested walkthrough remains a
separate completed deployment scope.

## Recommendation and limits

Select Node 24 ESM modules → canonical exact-once plan → immutable local image
inspection → five constrained owned capability probes → verified retirement →
existing reviewed shared PostgreSQL owner → remaining isolated serial files →
native root evidence and awaited publication. Benefits are earlier actionable
prerequisite refusal and less wasted native work. Costs are five short container
lifetimes, strict local image prerequisites and dependence on Docker availability.
Versions alone do not prove functional behavior, publisher provenance, later
daemon availability or reserved CPU. Full native assertions remain required.

Maintain the existing testing/standards skills with implementation owners,
failure cases, evidence requirements and official-source status. No overlapping
general standards skill is needed. No browser behavior changed, so no new WCAG
or assistive-technology claim is made.

Next: separate the six-profile/four-pair Wanted root timing matrix into an
explicit benchmark lane. Retain routine current-authority and exact projection/
hash/byte equivalence checks, and preserve all larger profiles/assertions in the
explicit lane. Prove lane selection/ownership and measure matched complete runs
before claiming a whole-gate saving or promoting coordinator scheduling.
In this successful full invocation, that six-case file took 94.801 seconds,
the largest observed file duration. Automatic library add took 80.638 seconds,
library file matching 50.620 seconds, Missing Music add-to-library 42.702 seconds
and operator track delivery recovery 41.011 seconds. File durations guide the
next investigation; they are not additive ownership-attributed phase costs or a
promise that removing timing repetitions saves all of that wall time.

That follow-up has a separate [lane design](WANTED_ROOT_TEST_LANES_DESIGN.md)
and [outcome](WANTED_ROOT_TEST_LANES_OUTCOME.md), which own later source/coverage
evidence. The measurements above remain this collection's historical record.
