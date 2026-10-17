# Library-add setup timing design

Date: 2026-10-17. Follow-up to the
[automatic media comparison](AUTOMATIC_LIBRARY_ADD_MEDIA_OUTCOME.md).

The previous complete automatic-file samples had variable differences between
parent wall time and returned scenario totals. That residual cannot identify
tooling, runtime startup, module loading or process/reporting as the cause.
Measure the original completion boundaries before changing their execution.

## Implementation boundary

Reuse fixture-phase-observer and its explicit timing opt-in. Add five fixed
phase names: media_tooling, media_image_inspect, media_version, runtime_setup and
runtime_cleanup. The automatic file owns the outer tooling/runtime boundaries
and supplies the same observer to its runtime and prerequisite media fixture.
The existing runtime's container/workspace records retain their native nesting
and all scenario children retain their own correlation IDs.

Extract tooling verification into a narrow ESM library-add-media-tooling module.
Observe the existing image-inspect/version commands with the supplied observer;
keep their command order, arguments, output, return/unavailable semantics and
async completion unchanged. Local tooling still runs ffprobe then ffmpeg; image
tooling still inspects the image then runs ffprobe -version. Never add a probe,
skip verification, cache a result or parallelize these commands for timing.

The observer records approved phase/outcome/duration/opaque correlation fields,
without commands, environment, media metadata, private paths or Error messages.
Disabled timing does no clock/sink work. Existing sink/clock failure handling
must preserve original returned values and thrown Error/null. A resolved tooling
unavailable reason remains a resolved helper result; a passed phase alone does
not certify usable tooling. Complete native zero-skip evidence owns that claim.

The existing cohort aggregate schema remains unchanged: these new raw diagnostic
phases are not newly required fields in version-one cohort evidence. Parent wall,
returned scenarios, outer setup and nested command phases are distinct; do not
sum overlapping observations or infer missing phases from subtraction alone.

## Security and execution scope

This slice observes existing execution. The tooling helper currently has no
command timeout, unlike media scenario commands and the owned preflight probe.
Adding execFile timeout alone would signal the Docker client without proving
remote retirement. A safe process-policy change needs acknowledged container
identity and verified teardown, such as the existing integration-tool-probe
owner. That changes command work and needs its own adverse validation; it is not
silently introduced into a timing comparison. Existing scenario cleanup, current
bytes, pool/deadline policy and per-command default remain unchanged.

## Options and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Infer setup from wall minus scenarios | No code | Cannot locate work or establish causality | Reject attribution |
| Reuse existing observer at actual boundaries | Small, optional, shared privacy/failure behavior | Adds descriptive evidence, not an optimization | Implement |
| New profiler or global performance marks | Flexible | Duplicate state and cleanup/privacy policy | Avoid |
| Cache verification or enlarge deadlines | May hide observed delay | Changes work or conceals failure | Reject |
| Replace version probe with owned preflight immediately | Explicit remote retirement | Different work and process policy; needs separate qualification | Evaluate after timing evidence |

Recommended stack: existing phase observer, narrow tooling module, original
command completion, correlated runtime records, unchanged native assertions and
private complete-source evidence. The experiment is explicit investigation, not
new mandatory repeated CI work. See separate
[official research](LIBRARY_ADD_SETUP_TIMING_RESEARCH_2026_10.md) and
[outcome](LIBRARY_ADD_SETUP_TIMING_OUTCOME.md).
