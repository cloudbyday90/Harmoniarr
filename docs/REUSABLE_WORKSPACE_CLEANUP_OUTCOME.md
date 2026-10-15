# Reusable workspace cleanup outcome

Implemented on main, October 15, 2026. Two narrow ESM modules now separate runtime
admission/drainage from directory identity/retention. The reusable app runtime
wires runtime-wide and per-scenario cleanup predicates into both child and root
ownership. Each scenario gets a fresh contained directory; cleanup seals new
admission, awaits returned isolated-database work and has one canonical promise.
Production source, schema, media execution defaults and resource policy remain
unchanged. See the [design](REUSABLE_WORKSPACE_CLEANUP_DESIGN.md) and
[official October research](REUSABLE_WORKSPACE_CLEANUP_RESEARCH_2026_10.md).

## Reproduced behavior

A standalone control loaded the preceding committed app runtime into an ignored
local module with its imports resolved to the same repository dependencies.
With an explicit false scenario guard, it observed zero predicate calls and
deleted both child and parent. A separately held scenario also lost its workspace
when runtime cleanup ran before the scenario returned. These are reproduced
fixture ownership defects, not inferred timeout causes.

The first standalone attempt ended before its checkpoint because the existing
shutdown delay was unreferenced and the script had no other live handle. The
completed control used an owned keepalive released at script completion. No
production/runtime timeout or shutdown policy was changed to obtain that evidence.

## Validation

| Collection | Result | Scope |
| --- | --- | --- |
| Frozen focused controls | 24 passed; 3.408 seconds | Filesystem/lifetime policy and real app adapter wiring with controlled dependencies |
| Initial native cohort | 10 passed; 30.487 seconds | New guards plus existing checkout/media-worker lifetime coverage |
| Frozen native cohort | 10 passed; 37.933 seconds | Three literal files, serial execution, actual PostgreSQL and Docker media owner |
| Frozen fast gate | 10,201 passed; 138.252 seconds | 5,249 server, 4,384 client, 568 script cases plus policy/lint/build checks |
| Dependency audit | Zero vulnerabilities | Existing npm audit policy |

All final collections had zero failures, cancellations and skips. The fast gate
also passed copyright, migration/schema/ESM/Compose policy, lint and both builds.
The selected native paths were reusable-workspace-cleanup, media-inspection-worker-
lifetime and app-checkout-diagnostics. The full integration/browser suites and
large media workload matrix were not repeated; this change does not claim
whole-CI performance improvement or a historical timeout diagnosis.

Focused controls prove held predicates, drainage beyond body completion into
database teardown, closed late admission and shared cleanup-promise identity.
They preserve original Error/null through a later release failure, retain a
refused child through a successful same-name sibling, and keep intentional failed
callback artifacts through parent cleanup. Real directory, root and junction
replacement controls preserve their sentinels. Invalid path-like labels and
nonfunction predicates refuse before native scenario dispatch. Startup controls
preserve original null while applying the outer guard.

The native resource case runs real ffprobe through the existing API-backed
executor. With its cleanup predicate held, runtime cleanup remains pending, the
source directory remains present and the acknowledged container still runs with
that exact read-only source mount. Releasing the predicate awaits executor close,
verified retirement/removal, then scenario/database/runtime completion. The
scenario and parent directories are absent only afterward.

The native refusal case executes real PostgreSQL queries, retains a sentinel
with original null, completes a fresh same-name sibling on a different directory,
and proves outer cleanup still preserves the refused child. Its controlled
predicate owns no external process; the test reaps its retained evidence only
after runtime completion and an independent root-identity check. Unknown native
ownership is never converted into guessed cleanup.

## Security and maintained workflow

Directory checks use canonical absolute paths, `lstat`, exact BigInt device/inode
identity and current parent/child checks. Runtime and scenario predicates must
return exactly true. False, thrown or nonboolean predicates cannot grant removal.
An unsafe retained child permanently vetoes parent removal for that runtime;
original unsafe failure remains primary while resource release still executes.
Intentional safe artifact retention does not introduce another cleanup error.
These are cooperating fixture ownership checks, not an atomic filesystem deletion
capability against arbitrary host writers.

Existing standards/testing skill references now map the ownership contract,
real held-resource proof, intentional/unsafe retention and original failure
precedence to their implementation. Structural validation and installed-skill
byte checks are recorded separately; no new blind skill trial or standards
certification is claimed. Private source hashes, baseline controls, logs and
gate evidence remain ignored under `.tmp/reusable-workspace-2026-10-15/`.

Initial and final GitHub MCP checks returned zero open PRs. No applicable random
PR existed, so no PR patch, merge, rebase or comment was performed. No new Git
branch, release or Git tag was created.

## Recommendation and next item

Keep the guarded reusable owner and existing execution defaults. Its benefit is
correct child/parent lifetime authority without repeating large workloads in
every test run. The cost is extra directory checks and deliberately retained
evidence after uncertain cleanup; later successful predicates cannot silently
erase it. Delayed or retried deletion is not an alternative proof of quiescence.

Next adopt an explicit owned API executor in one reusable canonical media cohort.
Register actual close before evaluating its guard, retain every current media/
receipt/byte/private comparison, and compare a selected baseline before broader
default adoption. Full Engine exec/lifecycle migration remains separate.
