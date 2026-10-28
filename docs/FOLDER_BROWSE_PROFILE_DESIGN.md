# Folder browsing measurement design

October 28, 2026. See [research and options](FOLDER_BROWSE_PROFILE_RESEARCH_2026_10.md)
and [outcome](FOLDER_BROWSE_PROFILE_OUTCOME.md).

The benchmark is opt-in through scripts/measure-folder-browse.js. It does not
run in application startup, HTTP routes, maintenance or the routine test glob.
No production service, dependency, schema or deployment topology changes.
Network profiles are explicitly deferred for this session.

An immutable production image supplies the real service; mounted benchmark
modules are read-only. Service/cursor/selector/API-error/shared-policy hashes must match
the checkout. A preparer creates only a UUID-owned fixture beneath a fresh
Docker volume or a verified child of an explicit host scratch root. Case
directories contain exactly their declared raw entries; ownership manifests
live outside those directories so the 50,000-entry case remains exact.

Every algorithm/case/itinerary/repetition uses a fresh consumer process with two
CPUs, 1 GiB memory, no swap, no network, dropped capabilities, read-only root and
read-only fixture mounts. The preparer/cleanup phase uses root only within the
owned scratch mount; measured consumers use UID 1000. Preparation/import/proof,
baseline GC and post-work GC are outside timed work. Caches are not cleared;
fresh process does not imply cold storage. Samples alternate algorithm order.

The real scanner keeps its guards and cursor policy. The full-readdir comparator
uses the same fixture sort/page projection and rescans for each requested page,
but has no production metadata/cursor/admission checks. Its timings therefore do
not isolate the read primitive or reproduce every old application behavior.
Both outputs must match independently generated expected page names. The run
measures first-page and three-forward-page itineraries, not an entire 500-page
walk. Count caller-visible reads/stats and actual directory open/close ownership.

Full process memory fields are captured before/after work and after post-work
GC. Only RSS is periodically sampled at 5 ms; sampling-off controls retain the
same boundary snapshots. Read/stat counters return the original native Promise,
avoiding an additional Promise per entry. Report signed deltas and observed maxima without
claiming exact sub-interval peaks. Lifetime maxRSS (KiB converted to bytes) and
container before/after current/peak/events (v1 or v2) are separate scopes, not service allocation
or additive totals. The immediate post-GC snapshot is not a persistent-retention
or leak test. Include CPU usage and elapsed page/itinerary observations.
Sampling, validation and wrapper overhead are disclosed; refusals never become
successful page comparisons or deadline increases.

Container completion, verified actual stop/removal and fixture ownership precede
cleanup. Cancellation closes launch admission, retires the exact owned container
and preserves primary failures. Uncertain retirement or invalid ownership retains
the fixture. Bound records/errors exclude host paths and native error details.
The output is an exclusive local evidence file; no messages or remote writes are
sent beyond the user-authorized Git push at task completion.
