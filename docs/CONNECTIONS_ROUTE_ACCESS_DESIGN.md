# Settings Connections admission design

Date: 2026-10-21. Continues the [history admission outcome](HISTORY_ROUTE_ACCESS_OUTCOME.md).
See the separate [research and tradeoffs](CONNECTIONS_ROUTE_ACCESS_RESEARCH_2026_10.md).

Connections mounts form settings, setup progress and saved Soulseek status.
The first two read `/api/v1/settings`; the third reads `/api/v1/slskd/status`.
Both handlers require admin. Settings writes and provider link/OAuth/collection
commands independently require fresh admin and CSRF. The broader authenticated
`/api/v1/providers/status` endpoint is a different contract. Correct admission
without changing any of these server permissions or initiating provider work.

Keep area rules modular: Activity retains its four reviewed routes; a new focused
Settings policy owns only `settings-connections`. A small common route-access
service composes the two policies and owns current-session verification. Move
that mechanism out of the Activity module rather than adding Settings membership
there or introducing a second guard with subtly different authentication order.
The router retains initial session loading, bootstrap/password-change/login
precedence, Home refusal for non-admin roles and bounded cancellation/retry
feedback after cached verification failure. Other destinations keep existing rules.

Lift Settings' static primary/secondary navigation into an immutable inventory
with a role-aware projection. Filter Connections through its area policy, keeping
other tabs' order and preserving Account for every authenticated role. The global
health panel's direct Connections link uses the same decision. Existing bounded
recovery query data remains navigation context, never permission or write consent.
All direct links still pass through the common guard. Already mounted views rely
on independent API authorization after revocation; continuous eviction is outside
this admission change.

Settings primary tabs also receive a scoped two-pixel token-based keyboard focus
cue, inset to remain visible inside the horizontally scrolling tab bar. This is
the project's focus-cue convention, not a claim that SC 2.4.7 mandates that width.

Validate the composed role/session decisions and navigation projections cheaply.
Use actual PostgreSQL/browser admission checks for held native session responses,
current authorized reads, cached revocation, password-change precedence, failed
verification/retry, direct links, protected HTTP contracts and Account access.
Retain Activity admission, canonical Connections recovery and real lazy Settings
navigation in one selected cohort. Inspect keyboard order, focus and responsive
navigation, then run the stable fast gate and preserved no-cache Docker/readiness
workflow. No API/schema/dependency/version/release change is needed for admission.

Random PR #54 independently updates the SHA of the QEMU action in the manually
dispatched release workflow. Apply only its reviewed one-line pin after validating
the Node 24 action/input contract and local behavior. Distinguish controlled action
logic and existing Docker Desktop emulation from privileged emulator registration
on a fresh GitHub runner. Do not dispatch a release to test the pin.
