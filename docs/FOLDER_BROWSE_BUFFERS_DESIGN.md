# Folder buffer comparison design

October 28, 2026. See [research and tradeoffs](FOLDER_BROWSE_BUFFERS_RESEARCH_2026_10.md)
and [outcome](FOLDER_BROWSE_BUFFERS_OUTCOME.md).

The existing scripts/measure-folder-browse.js accepts an explicit
`--comparison buffers`. Its default `algorithms` comparison remains available.
A small variant-policy module owns the fixed choices: stream/32 versus
readdir/no-buffer, or stream/32 versus stream/128. Arbitrary buffer settings are
rejected. Report version 2 identifies the comparison and per-sample buffer.

The immutable packaged scanner is unchanged. The existing dependency adapter
asserts that production requested exactly `{ bufferSize: 32 }`, then passes the
selected buffer to native opendir. Both variants use the same adapter, counter
and result verification. Any unexpected production option fails qualification
before native opening. Record a checked option per open and the applied buffer;
do not infer actual native syscall counts from caller-visible read counts.

The scanner's 100-folder pages, 50,000 raw-entry limit, four active scans,
cooperative five-second deadline, metadata fences and signed actor/path-bound
cursors remain unchanged. No retained idle handles, new application service,
maintenance task, environment setting, schema change or deployment is needed.
Native read/stat observers return the original Promise. Admission remains held
until native close settles, including refusals and cancellation.

For each local storage topology, measure the same four cases (1,000 directories,
10,000 directories, 1,000 directories/9,000 files and 50,000 directories), first-page
and three-forward-page itineraries, with four fresh consumers per buffer/point.
That is 64 primary samples plus eight sampling-off controls at 10,000 directories/
three pages. Alternate order by repetition: 32/128, 128/32, 32/128, 128/32.
Each point therefore has equal first/second positions. Report median as the mean
of the two middle observations for four samples; keep min/max and raw records.

The [existing benchmark ownership and measurement design](FOLDER_BROWSE_PROFILE_DESIGN.md)
continues to apply: 2 CPUs, 1 GiB, no swap/network/capabilities, read-only root and
fixture, UID 1000, immutable image/source hashes, UUID-owned scratch resources,
verified actual container removal and fail-closed fixture cleanup. The preparer
and cleanup run as root only inside the owned scratch mount. Exclusive reports
omit host paths/native errors; any failure keeps a private log.

Measure itinerary and page durations, sampled 5 ms RSS rise, process snapshots,
lifetime high-water marks, CPU and cgroup v1/v2 counters separately. Baseline GC,
fixture creation and post-work GC stay outside timed work; independent name/digest
verification and counters stay inside itinerary timing. Do not sum overlapping
memory scopes, correct results from noisy controls or label immediate post-GC
differences as leaks. Fresh processes do not clear filesystem caches. Run profiles
serially and the complete validation gate afterward, without changing host load.

Focused tests cover variant admission, order/equal work, actual native options,
independent pages, option drift refusal, scan/deadline/metadata refusals and held
close/admission at both sizes. Existing container failure/cancellation/ownership
tests remain required. Exact unchanged production/runtime comparisons support
retention of unrelated SQL/browser/native evidence; no fresh such checks are claimed.
