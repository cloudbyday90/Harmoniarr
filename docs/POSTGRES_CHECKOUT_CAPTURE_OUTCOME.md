# Owned PostgreSQL checkout capture outcome

October 13, 2026. Baseline main `ae1cd71`. Separate
[design](POSTGRES_CHECKOUT_CAPTURE_DESIGN.md) and
[official research](POSTGRES_CHECKOUT_CAPTURE_RESEARCH_2026_10.md) own boundaries,
source status, alternatives and the recommendation stack.

## Result and limits

Modular ESM fixture adapters observe promise and callback acquisition on concrete
owned direct/application pool instances. The application adapter attaches lazily
so schema setup retains environment behavior; both entry points keep real
pool/client/release identities. Fixture-local asynchronous context captures the
active phase at admission with timing disabled or enabled. The functional
PostgreSQL wrapper forwards its phase observer into the single case so
server/checkout correlation agrees with the app observer.

Fixed records contain approved source/pool/phase labels, generated IDs, public
before/dispatched/settled counters, monotonic duration and bounded code/class
chains. Default failure-only mode emits no success records or success probes.
All-mode ordinary records stop at 128 per observed pool; failures have a separate
16-record budget. Off-mode does not decorate pools. Messages, SQL, driver options,
endpoints and credentials are excluded.

The first checkout failure per case has a separate capture from higher-level
scenario rejection, preventing earlier unrelated errors from consuming evidence.
Server record version three correlates that checkout; existing scenario records
retain version two. Counters precede probes; asynchronous rejection/error callbacks
wait for capture. Synchronous throws remain synchronous, with admitted capture
drained before restoration. Original Error/null survives secondary diagnostic/
restoration failure. Concrete instance descriptors are restored after owned work
and before pool cleanup. No prototype patch, query replay, resource-bound increase
or assertion skip.

This closes a visibility gap. It does not diagnose or remediate the preceding
110/112 cohort's two intermittent timeouts. Its separate 17/17 pass remains
historical subset evidence. Pool counters, independent authenticated host query,
container readiness and state describe observations at different boundaries;
healthy probes cannot explain an earlier failure. Direct Clients, template
preparation and ad hoc test-created pools are outside this automatic observer.
Existing higher-level failure handling remains.

## Validation

The initial focused run passed 51/52: a lifecycle double intentionally omitted
getPoolFn, and the adapter incorrectly assumed one existed. Optional concrete-pool
observation preserves those doubles. Reviewed focused proof passes 54/54, adding
callback/receiver, exact Error/null, held capture, record budget, restoration and
concurrent/nested phase controls. Initial lint caught two promise-executor return
expressions in native controls; both were corrected. These results remain separate
from frozen gates.

An initial serial native control run passes 15/15 across three files in 56.397
seconds. A deliberately stalled cold connection exercises real migration
acquisition with max two and the unchanged ten-second connection bound. Both app
entry points hold two actual clients and call the real discovery-claim store:
the callback checkout records dispatched waiting one and settled waiting zero.
Held authenticated-host probes prove no caller rejection or pool cleanup occurs
early. After release, the exact original error is observed, the claim succeeds
with an empty result, callback queries work, and instance descriptors are restored.
Existing startup/refusal/backend-termination controls also pass. Controlled
failures prove capture behavior, not the preceding intermittent timeout cause.

Ignored `.tmp/postgres-checkout-capture-2026-10-13/` retains literal selections,
hashes and local logs. No whole-suite speedup, exhaustive native coverage,
historical remediation or standards/security certification is claimed.

The frozen fast gate passes **10,055 tests** (5,117 server, 4,384 client, 554
scripts), static checks and both builds in 127.451 seconds, with no test
failure/cancellation/skip. The unchanged 107-migration snapshot is current.
Thirteen staged/working code hashes remain identical. Five skill structure
validators pass and seven maintained/installed files match. The first dependency
audit was unavailable due to DNS EAI_AGAIN; after independent DNS resolution
succeeded, a separate audit with fetch retries disabled reports zero
vulnerabilities. Initial failure and subsequent result are retained separately.
No matched performance comparison or historical timeout remediation follows.

The frozen serial native cohort passes **65/65 tests across twelve literal
files**, with no failure/cancellation/skip, in 171.965 seconds of Node-reported
test time. It covers the checkout/server/phase controls, migration templates,
parent launcher, both previously failing Wanted/fallback files, scan catalogue/
lifetime, apply/import lifetime and actual large-media fingerprint delivery.
Native PostgreSQL 18.3 is observed. Media checks use the existing controlled
fixture image; the scoped environment is restored. All thirteen frozen code
hashes still match working and staged bytes. This is one selected cohort,
separate from the earlier 15-case control run and historical 110/112 failure;
repeats are not summed as distinct coverage or a matched speed benchmark.

## Skill, PR and next work

Existing web-standards/testing skills receive scoped reference maintenance:
trace concrete pool acquisition, preserve both API styles and lazy setup, record
before probing, own capture/restoration, and distinguish observations from
causality. Structure/install checks are separate from runtime proof; no duplicate
skill or new blind evaluation.

The separate [PR outcome](OPEN_PR_APPLICABILITY_CHECKOUT_CAPTURE_2026_10_OUTCOME.md)
records applicability. Main only; no PR merge, release or deployment.

Next, use any naturally recurring failure's correlated admission/queue counters
and server observations to choose a narrowly supported connection-establishment
or pool-wait investigation. Do not retry or widen resource bounds to manufacture
a green cohort. The selected affected checks are now stable: resume matched
guarded Wanted workloads with larger historical receipt sets, retaining exact
projection, query/byte/memory evidence and fresh publication rereads. This
selected pass does not establish that intermittent timeouts are eliminated.
