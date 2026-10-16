# Wanted root correctness and explicit scaling lanes

Date: 2026-10-16. Scope: test infrastructure on main; no production behavior,
schema, dependencies, resource bounds, release, branch or PR merge change.

## Problem and alternatives

The complete coordinated run identified library-wanted-root-profile.test.js as
its largest file: six cases, 94.801 seconds. Each profile compares both root
readers four times. Two media profiles and three historical receipt cardinalities
produce 48 projections. Only the first small case also owns current-authority
checks. Routine correctness needs those guards and a real paired comparison;
scaling measurements need the full matrix explicitly available.

| Option | Pros | Cons |
| --- | --- | --- |
| Keep all repetitions in routine integration | One command executes everything | Repeats expensive media hashing and fixture setup on ordinary changes |
| Skip/filter the large cases with an environment flag | Small patch | Hidden coverage changes, ambiguous full-run semantics and skip evidence |
| Separate routine proof from an explicit complete benchmark | Clear coverage ownership, fewer routine projections, full matrix retained | Benchmark must be invoked deliberately; lane selection and lifecycle require proof |

Select the third option. Keep the existing routine filename in the canonical
glob, with one sine/two-second/one-candidate case, one paired comparison and
every current-authority assertion. The explicit workload command gains
--root-lookups; its full default retains sine/noise, two/thirty-second media,
1/8/24 candidate histories and four counterbalanced pairs: six scenarios and
48 samples. Historical receipts do not establish distinct acquired-track scope.

## Module boundaries

Extract a pure pair comparator, a scenario executor and current-authority
assertions into focused ESM modules. The comparator verifies exact private
projections, wanted emptiness, query difference, fingerprint/root-call counts
and hashed bytes before exposing bounded numeric summaries. Keep source paths,
private projections and credentials out of the benchmark artifact.

Both lanes call the same scenario executor. Seed/apply exactly as before;
borrow one real client and retain the existing rollback owner across all pairs
within that scenario. No new warm-up, schema cache, pool, transaction system,
root cache or relaxed verification is introduced. Preserve the authority tests
for null/missing music settings, disabled owners and same-transaction root drift
with unchanged persisted Wanted rows. Keep them in the full benchmark's first
small scenario as well as in routine integration.

Reuse measure-wanted-guarded-workload.js and its explicit selection/reporting
runner. Add a root-lookup benchmark service, not another executable/lifecycle
system. Old modes keep their plans and defaults. New full selection requires
all 48 unique media/receipt/pair/variant keys; reduced profiles/pairs are marked
selected. Invalid or incompatible options refuse before app/PostgreSQL imports.
No benchmark test registration enters the routine glob.

## Ownership, failure and security

The benchmark owns one fresh PostgreSQL runtime and serial isolated scenario
databases through existing app/fixture owners. Retain the configured per-scenario
deadline; cancellation is checked before admission, after seed/comparison and
after awaited output/cleanup. Await actual scenario return and runtime cleanup.
Preserve the first Error/null if later cleanup fails. A deadline/signal is not
proof that arbitrary I/O stopped. Never borrow application databases or delete
inferred container/database identities.

Only emit a matched pair after both variants pass private equality and work
assertions. A partial or failed benchmark remains incomplete; a reduced selection
cannot claim full coverage. Existing approved checkpoint/failure fields stay
bounded; add only reviewed root dimensions and pair indices to the root mode.

## Evidence plan and recommendation stack

Capture the old six-case native file before code edits using the verified local
images and unchanged bounds. Test pure comparator mutations, complete/selected
plans, duplicate/missing/foreign samples and first-failure/held cleanup controls.
Run the actual full benchmark, fresh routine file and complete coordinated gate
on final frozen code. Verify the routine canonical inventory remains 127 files;
the intentional case-count change is six scaling cases to one correctness case,
while the explicit benchmark preserves all six profiles and 48 samples.

Compare structural work and per-profile counter/query/hash summaries against the
baseline. Local wall measurements are descriptive; no whole-CI percentage is
inferred. Keep any failed collection and its source separate. Run appropriate
fast/static/build checks; retain existing authority and lifecycle regressions.

Recommended stack: Node 24 ESM → native routine current-authority/pair proof →
explicit existing workload CLI → fixed full/selected plans → exact pair/work
comparison → existing PostgreSQL/app/transaction owners → bounded summaries and
native complete-gate evidence. Broader test selection or parallelism needs a
separate risk and ownership review.
