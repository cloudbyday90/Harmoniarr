# Native retry and resume outcome

October 20, 2026. Implemented the [design](NATIVE_RESUME_DESIGN.md) and
[official-source recommendation stack](NATIVE_RESUME_RESEARCH_2026_10.md) as
the opt-in ESM command npm run validate:native-slskd-resume. No production
service, schema, dependency or retry-default change was needed.

Actual slskd 0.26.1 / wire 0.26.1.0 reported effective retry options resume,
three total attempts, configured base delay 5,000 ms and configured maximum
60,000 ms. The fixture does not override them. The released calculation permits
zero fixed delay plus 0..4,999 ms jitter on the first retry; configuration is not
a five-second minimum wait.

| First native fault | Verified resume offset | Suffix sent | Final declared bytes | Native invocations / application POSTs |
| --- | --- | --- | --- | --- |
| EOF one byte short | 131,088 | 1 | 131,089 | 2 / 1 |
| TCP reset after real partial receipt | 32,791 | 65,520 | 98,311 | 2 / 1 |

Each second request used a new, one-use token after first send completion and
actual socket close. The read-only inspector verified the real incomplete
prefix, stable descriptor/path identity and hash before sending only the suffix.
Both native receipts ended Completed, Succeeded with full bytes, no normalized
exception and the original durable batch/receipt identity. Wrong identity reads
were refused. The reset scenario lost the completed HTTP response and recovered
through GET with no second POST. Local requeue was observed in this run; the
harness records observed states without requiring every transient state to be
pollable. Native attempt count, exact offsets and final bytes own the retry proof.

After native downloads retired, the harness stopped and acknowledged the exact
provider before final inspection. Completed storage contained exactly the two
full files, totaling 229,400 bytes, with matching hashes and stable identities.
Incomplete storage contained no files. Actual kernel inspection proved two
4 MiB tmpfs volumes with separate provider-write/inspector-read-only mounts.
Internal networking, no ports, uid 1000/read-only roots, resource bounds, dropped
capabilities and strict Docker cleanup remained in force.

The final behavioral validation capture has 3,092 files, SHA-256
1b21e86403bf777e02479f0908674f846fc8980f5f183888a73fd6b02f32cf61.
The final fast gate passed 10,592 tests in 122.08 seconds: 5,507 server, 4,388 client
and 697 script tests, plus static checks, lint and build. Twenty focused controls passed,
including seven new parser/capability/range/backpressure/cancellation/retirement
tests. The final two-scenario native resume case passed in 47.96 seconds.

Four additional native regression cases / nine scenarios passed on the earlier
frozen capture 14c213f793fb53ca9c22ab3bb981354a1053ec5018b495b9d3ec5ed85a73718a:
partial EOF/RST refusal, full completion and queue/response-loss controls on
0.26.1 and 0.26.0. Only the resume client changed between captures, to avoid
requiring a transient local-queue state; the regression owners are identical.
Reran the affected resume lane and fast gate after that correction. All five
case types used the same rebuilt application image; no final case skipped work.
Unchanged SQL and three-minute timeout owners did not require their long suites.

Staged whitespace review then removed one extra trailing LF from each of nine
new JavaScript files. Byte comparison proves those are the only formatting
changes; all nine Node parse checks and test/fixture lint passed. Broad behavioral
tests were not repeated for this formatting-only correction. The final formatting
capture is f8d80de49d766672413b1ab51e8ba4ade8578bdf639c6a4f9247a10dbb7f9748.

Private evidence under .tmp/native-resume-2026-10-20/ retains the prototype
failure at an omitted raw exception field, the corrected native control, lint
feedback and both captures. A queue invocation initially supplied the wrong
expected version; the guard refused it, and only affected controls were rerun
with explicit version inputs. The walkthrough's first helper invocation hit a
Windows PowerShell stderr handling issue; PowerShell 7 completed it. These are
harness/input corrections, not reproduced production regressions.

The [Docker outcome](LOCAL_DOCKER_NATIVE_RESUME_OUTCOME.md) records preserved
state and unchanged runtime artifacts. The independent
[PR 48 evaluation](OPEN_PR_48_NATIVE_RESUME_EVALUATION.md) leaves its unchanged
incompatible candidate unapplied after fresh applicability checks. Maintained
testing and web standards skills now route native resume to a focused reference.

Next: bounded native retry exhaustion and changed-size refusal, proving failed
receipts and incomplete-only payloads without another application POST. This
slice does not authenticate a same-size changed remote source or prove music
decoding/library import. No release, Git tag or application branch was created.
