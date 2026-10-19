# Library-add prerequisite ownership outcome

Date: 2026-10-19. See the
[design](LIBRARY_ADD_PROBE_OWNERSHIP_DESIGN.md) and
[official research](LIBRARY_ADD_PROBE_OWNERSHIP_RESEARCH_2026_10.md).

## Implemented result

Library-add prerequisites now use fixture-probe-command, a narrow ESM owner that
bounds stdout/stderr to 2 MiB each and requests SIGKILL at 30 seconds or caller
cancellation. It waits for both the command callback and actual process/stdio
close before resolving or rejecting. The first observed command Error or abort
reason, including null, survives a later failure while close is pending. A
termination request is not successful retirement or a hard total cleanup deadline.

Image verification reads one existing local image, accepts only a complete Linux
identity without declared volumes and binds the version probe to that immutable
ID. The existing integration-tool-probe owns create/start/inspect/retire/remove:
full acknowledged ID, owner token, non-root user, no network, read-only root,
dropped capabilities, no-new-privileges, no mounts and no implicit pulls. Create
waits for acknowledgement before cancellation; cleanup commands are uncancelled.
Unknown identity or changed configuration never authorizes guessed removal.

Local ffprobe/ffmpeg remain serial. Success still returns null; failure returns
the existing bounded unavailable reason only after returned ownership work. The
image version log now contains the parsed version, without the old full build
banner. Existing optional phase records remain minimized and media_version now
includes actual probe retirement. The automatic and canonical before hooks pass
their cancellation signals. There is no production, schema, dependency, execution
default, scheduling or image change.

## Native evidence and scope

All three new native cases passed in **4.264 seconds**. They prove:

- Availability returns after the confined acknowledged version probe is removed,
  with successful daemon listing independently confirming absence.
- Cancellation immediately after actual create acknowledgement does not start
  the probe and still verifies/removes that stopped owner before unavailable.
- Injected null after the actual attached version command closes survives real
  remote retirement and removal.

Tests retain actual completion beyond test callback timeout and clean only their
complete, inspected, stopped ID. The new native cancellation control occurs
before start; it does not claim interruption of a long-running remote process.
Held active-remote retirement and failed-stop refusal remain controlled unit
proofs in the existing integration-probe tests. Real local-child tests separately
prove timeout, cancellation/null, output overflow and spawn-error close.

The automatic eight-case file passed in **83.039 seconds**, preserving exactly
**18 generations and 59 inspections**. Its observed prerequisite image inspection
was 0.134 seconds, complete version probe 1.282, outer tooling 1.416, runtime setup
3.014 and final runtime cleanup 1.039. These are nested descriptive durations,
not an equal-work speed comparison: the version probe now performs additional
identity and retirement commands. Historical timings remain separate.

The unchanged six-case library-add cohort passed in **49.152 seconds**. Overall
this is **17 passed native cases across three selected files**, with zero
failures/cancellations/skips/TODOs. All fourteen original native test bodies are
unchanged after newline normalization. Their private body digests are:

- Automatic: b670366e4ba31de3727c077f072c97a4aaa3afa8e58a190a22ce0ef0d254d927.
- Canonical: 5f7def0c06b37b9ddb93d5f6e3cb813a177ea952d7e7b8ccce2abe739d12bf20.

The canonical inventory now includes the three new cases, moving from 127 files/
558 cases to **128 files/intended 561 cases**. File discovery confirms 128 paths;
the other 125 paths were not freshly rerun.
This is selected proof, not a new complete invocation or diagnosis of historical
connection/atomic-creation/scan-receipt failures. Existing Vue/TestsStream warnings
are not repaired or suppressed.

## Focused validation and source identity

All **56 focused cases** pass across command ownership, media tooling/tools/
scenario and existing preflight/probe policy. These retain actual close ordering,
first Error/null, no admission after cancellation, held retirement, foreign-owner
refusal, strict workspace cleanup and import isolation. Final focused ESLint has
zero errors/warnings. The first lint pass found a promise-executor arrow-return
style issue; it was corrected before the final native source freeze.

Opening/closing native fingerprints match: **3,025 files**,
`c6e7a8f79904529484d9eed61e6be8fc920e622b973ff48d9b9185abb49e01d2`.
All eight changed code files are frozen individually. Native preflight verified
the same local PostgreSQL 18.3, ffmpeg/ffprobe 8.0.1 and reader Node 24.21.0/Docker
CLI 29.9.0 images as the
[previous outcome](LIBRARY_ADD_SETUP_TIMING_OUTCOME.md). Host Node remains 24.18.1
and Docker Engine 29.8.2/API 1.56. No image build or pull was required.

The final fast gate passed in **119.741 seconds**: 5,452 server, 4,384 client and
671 script cases, **10,507 total**, with no failures/cancellations/skips/TODOs.
Both client/server builds and copyright, migration/schema, ESM, image/Compose,
lint and test-hygiene checks passed. Existing testing and standards skills now
retain prerequisite ownership, actual evidence limits and dependency guard rules.
Both repository skills and the installed standards skill validate. Its four-file
copy matches the repository, all checked local Markdown links resolve, and
the tested eight code files and complete source fingerprint remain unchanged.
Private native logs, body/code/source freezes and PR install/gate/
restore evidence remain under .tmp/library-add-probe-2026-10-19, excluded from Git.

## PR evaluation and recommendation

The random open selection was [PR 46](https://github.com/cloudbyday90/Harmoniarr/pull/46).
Its exact package files were applied and installed locally with scripts disabled.
The actual pg 8.23.1 driver gate returned false and exited 1. Both package files
were restored byte-for-byte and the original lock reinstalled; pg 8.23.0 again
passes. The [separate evaluation](OPEN_PR_46_LOCAL_EVALUATION_OUTCOME.md) preserves
the rejection and its limits. No PR changes are retained or merged here.

Retain the recommendation stack: close-owned command, inspected immutable image,
existing acknowledged probe, uncancelled actual retirement, optional minimized
timing and unchanged application assertions. This adds setup checks and explicit
ownership complexity in exchange for evidence that availability does not precede
cleanup. Keep per-command execution default and retain uncertain artifacts.

Next, review pg 8.23.1 and its actual pg-pool implementation against the internal
queue/connection/startup adapters, then run their native controls before widening
the exact driver guard or reconsidering PR 46. A patch version alone is not that
review; the gate rejection is not evidence of an upstream vulnerability or proof
that the other three package updates fail. Qualify the four runtime updates as a
separate dependency change. Do not mix that proof with these original-dependency
probe results. Closing GitHub MCP metadata confirms PR 46 remains open at the
same evaluated head.

Work stays on main. No release, tag, branch, PR merge/closure/comment, provider
message or deployment-image rebuild is created.

The recommended driver review was subsequently handled in the separate
[pg 8.23.1 outcome](POSTGRES_DRIVER_8231_OUTCOME.md). This document's probe results
remain evidence for the original dependency lock, with their own source identity.
