# Automatic library-add media outcome

Date: 2026-10-17. Follow the
[design](AUTOMATIC_LIBRARY_ADD_MEDIA_DESIGN.md) and
[official research](AUTOMATIC_LIBRARY_ADD_MEDIA_RESEARCH_2026_10.md).

## Implemented boundary

Automatic library-add now uses the existing ESM library-add-media-scenario
adapter instead of a mutable fixtureRoot. Only one test file changes. There is
no new executor or production, schema, dependency, image or scheduling change.
Per-command remains the default; owned-api is explicit and image-backed. ffmpeg
generation stays per-command and writable; only ffprobe delegates to the
scenario's existing confined inspection owner.

A private normalized comparison against the opening source confirms all eight
native callbacks/assertions are unchanged except for the scenario-wrapper call.
The body digest is
`b670366e4ba31de3727c077f072c97a4aaa3afa8e58a190a22ce0ef0d254d927`.
This retains real media bytes, authority/consent/quality checks, rollback,
collision/reuse guards and malformed-ownership refusal.

## Baseline and counterbalanced comparison

The fresh unchanged eight-case baseline passed in **122.972 seconds**. Its
3,020-file source fingerprint is
`605e0f38d98d45630724b82b893cf46c01b764809a4268d7c652b8b65541e026`.
The previous 94.285-second complete-gate observation remains separate; neither
baseline is a same-source, same-load comparison against the final adapter.

The final source completed all four serial ABBA samples with eight passed cases
and zero failures, cancellations, skips or TODOs in each. Every sample retained
the same ordered native case digest and per-scenario generation/inspection work:
**1/4, 0/0, 0/0, 0/0, 9/30, 3/12, 5/13, 0/0**. The correct total is **18
generations and 59 inspections**; the earlier conversational total of 17
generations was an arithmetic error.

| Order | Mode | Parent wall seconds | Sum of returned scenario seconds | Schema phase seconds | Scenario close seconds |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | per-command | 142.790 | 134.092 | 9.909 | 0.000048 |
| 2 | owned-api | 142.167 | 96.013 | 8.017 | 4.558 |
| 3 | owned-api | 176.208 | 159.198 | 12.493 | 6.727 |
| 4 | per-command | 193.909 | 136.984 | 8.589 | 0.000059 |

Owned mode saved 0.623 seconds (0.436%) in the first wall-time pair and 17.700
seconds (9.128%) in the reverse-order pair. Returned scenario time was 28.398%
lower in the first pair and 16.216% higher in the second. This is variable local
evidence under the existing host load, not an isolated causal or whole-CI
speedup. No default promotion follows from it.

Returned scenario duration includes setup, the returned database tail and close;
parent wall also includes file/process and before/after setup. The schema and
close observations overlap that returned duration and must not be added to it.
Tiny per-command scenario-close time means there is no retained inspection owner
to close; it does not measure each completed Docker command's cleanup. Absent
per-command transport records likewise do not mean zero native work.

Each owned sample created and removed four native inspection owners and completed
all 59 command executions. The other four scenarios created no native owner.
All eight cleanup predicates were true, and transport observations had zero
failed, pending, untimed or clipped work. Command-exec totals were 25.613 and
47.965 seconds respectively; these are overlapping transport observations, not
additional wall-time savings. The existing app/worker/reader/database/workspace
owners retain their actual drainage and uncertain-artifact behavior.

Opening and closing final-source fingerprints match: 3,020 files,
`33a2501c5960666fb59da193b0f07f68829d68cf572fbeb798406cac7fdcae89`.
The ordered native case digest is
`0a58cc061f0fde7520ad1a370921d87787073b74c7f052dca5797b48ac6fcdb4`.
Private baseline, individual logs, work rows, source freezes and summary evidence
remain under .tmp/automatic-media-2026-10-17 and are excluded from Git.

## Runtime and security scope

| Component | Actual local selection |
| --- | --- |
| Windows host Node | 24.18.1 |
| Docker Engine / API | 29.8.2 / 1.56 |
| PostgreSQL | 18.3, postgres:18-alpine at sha256:54451ecb8ab38c24c3ec123f2fd501303a3a1856a5c66e98cecf2460d5e1e9d7 |
| ffmpeg / ffprobe image | 8.0.1, sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2 |
| Trusted reader Node / Docker CLI | 24.21.0 / 29.9.0, sha256:5898e3f6d6379363eadb683963962b267df72e007f84edec0b3b1b8cd2c65f6e |

The reader CLI version is not the daemon version. Local preflight verified the
actual immutable images and tool versions. Preserve read-only inspection mounts,
no-network execution, dropped capabilities, no-new-privileges and the reviewed
Engine reader/path policy. Daemon access remains privileged trusted test
infrastructure. Local Docker Desktop success does not qualify hosted Ubuntu;
the existing [six-case Linux lane](LINUX_CANONICAL_MEDIA_DESIGN.md) is unchanged.

## Validation and recommendation

The ten focused media-scenario/tool cases passed, including invalid/default
policy, held close/database tail, strict workspace removal, Error/null retention,
real child output and ffprobe-only delegation. The changed file passes focused
ESLint with zero warnings. Two additional unchanged native files pass all nine
cases: owned-media-inspection (seven) and reusable-workspace-cleanup (two).
These exercise CLI/API current-byte reinspection, write refusal, nonzero/timeout
retirement, held actual mounts/database tails and retained unsafe workspaces.
Together with the automatic file, this is 17 distinct native cases across three
selected paths; the four repetitions do not create 32 distinct automatic cases.
The final fast gate passed in **168.643 seconds**: 5,434 server, 4,384 client
and 671 script cases, **10,489 total**, with zero failures/cancellations/skips/
TODOs. Both client/server builds, copyright, migration/schema, ESM, image/Compose,
lint and test-hygiene checks passed. Both updated repository skills and the
installed standards skill validate; its four files match the repository copy.
Changed local Markdown links resolve and final source/body proofs remain equal.

The other 124 canonical integration paths were not freshly rerun for this
one-file fixture-wiring change. The previous complete 127-file/558-case pass
belongs to the opening commit, 57f5790, and is recorded in the
[HTTP phase outcome](FIXTURE_HTTP_PHASE_OUTCOME.md). Selected passes do not
replace it or diagnose the older atomic-creation, scan-receipt or startup
failures. Existing Vue/TestsStream warnings are not repaired or suppressed here.

Keep the recommendation stack from the design: pure selection policy, narrow
media tools, the existing scenario adapter and inspection executor, actual
application/database/workspace cleanup, unchanged native assertions and bounded
aggregate evidence. The adapter improves ownership and offers a measured opt-in;
its extra transport and cleanup complexity has not earned a default switch.

Next, attribute the existing automatic file's before-hook work at the actual
verifyTooling and createIntegrationAppRuntime completion boundaries. Parent wall
and returned-scenario totals differ substantially across these samples; that
residual alone cannot identify a cause. Review command timeout/drain ownership
while measuring the original work, without extra probes, skipped verification,
caching or larger deadlines. Establish a complete equal-work comparison before
another optimization or Linux cohort expansion.

GitHub MCP discovery and a fresh closing PR-collection read both returned zero
open PRs. There is none to randomly select, apply, close or rebase. Work stays on
main; no release, tag, branch, PR merge or deployment-image rebuild is created.
