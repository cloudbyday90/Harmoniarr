# Parent-owned PostgreSQL test launcher design

October 10, 2026, America/New_York. Clean main baseline: 209aee2.
Separate [research](POSTGRES_TEST_LAUNCHER_RESEARCH_2026_10.md) and
[outcome](POSTGRES_TEST_LAUNCHER_OUTCOME.md) distinguish source contracts from proof.

## Scope and selected profile

Add an explicit shared-server profile for Wanted and scan catalogue. Keep serial
file execution, native process isolation, existing reporters/assertions/deadlines,
fresh scenario databases/pools and Wanted's private per-file migration template.
The complete default integration command remains unchanged. Raw Docker harness,
app-global and manually created sibling/replacement fixture adoption require their
own contracts; they are outside the initial registration-completeness cohort.
No release, branch, tag, deployment, dependency or application schema change.

| Option | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| More workers/forced exit | Easy configuration | Previous parallel profile failed; hides cleanup | Reject |
| One mutable scenario database | Avoids setup | Invalidates commits, faults and cross-client races | Reject |
| Native run() over all files | Existing event API | No public child handle/close guarantee or awaited per-file reconciliation | Defer |
| Explicit serial CLI children + one dedicated parent server | Retains native flags and gives close/reconciliation ordering | New registration and termination lifecycle | Implement selected cohort |
| Borrow an existing user server | Avoids startup | Unknown-creation crash recovery cannot stop that server | Exclude from this owned-server profile |

Stack: dedicated Testcontainers server; explicit file allowlist; shell-free Node
spawn; native spec/early failure streams; authenticated loopback registration;
positive creation/OID/role ownership; serial child close and database reconciliation;
strict outcome reporting; parent-only server shutdown. Measure before promotion.

## Ownership and transport

The parent starts a new non-reused test server, captures its private connection
configuration and uses an unallocated child PGDATABASE sentinel. Children know
maintenance credentials but receive neither a container object nor server-stop
authority through the fixture API. They keep current external-server runtime mode.
This is an API/fixture ownership boundary, not a sandbox for adversarial test code.

A small loopback POST service accepts bounded, exact versioned records with a
random per-file bearer capability. Each file has a separate admission scope;
future tokens are not sent to earlier children. Reserve returns a parent-generated
name after verifying absence. Children register only after CREATE acknowledgement
and fresh OID/current-role inspection, before pool or scenario work. Matching
commits are idempotent so lost acknowledgements can be retried during cleanup.
Explicit arbitrary database names are refused in this selected profile.

Scenario and template creation owners both use the protocol. Before destructive
child cleanup, parent ownership must still match. Registry release requires
observed absence; a child's 'dropped' assertion is insufficient. Scope closure
revokes admission; after child close and known worker quiescence, parent fencing,
backend termination/zero-session verification and DROP touch only registered,
matching OID/role identities. Uncommitted-but-existing reservations are uncertainty,
not cleanup authority. The run fails and its dedicated server can be stopped.

No prefix scan, stdout parsing or PID-only message creates database ownership.
Parent store queries on one pg client are serialized. Control records/responses
do not dump credentials, token values, SQL, environment or arbitrary error bodies.
Native test streams remain independent and unsanitized.

## Process and error boundaries

Launch one validated file with process.execPath, argument arrays, shell false and
an explicit environment. Remove inherited NODE_TEST_CONTEXT only for these owned
CLI children. Wait for close/output drain. On cancellation, close admission first,
terminate the owned process tree using the platform adapter, then wait for close
and observed known worker quiescence before reconciling. No next file starts while
cleanup is pending. Termination request alone is not a completion certificate.

Known worker PIDs are liveness observations, never authority to kill arbitrary
reported processes. Termination targets the actual spawned runner tree/group.
Unregistered descendants and privileged database administration remain explicit
limits; do not claim universal process/I/O cessation. Preserve the original test
or cancellation error over secondary cleanup; otherwise dirty cleanup fails.
Stop the owned server once, after scope cleanup, including startup/transport failure.

Cancellation/error termination separates process quiescence from output drainage.
After owned process closure, abandon blocked output consumers when necessary and
report `outputDrained:false`; preserve the original error and never advance to
another file on that failure. Normal success still requires both closed process
and completed output writes. Reject PID 1 before any process-group signaling.

## Acceptance

Prove exact file/environment/argument handling, authentication/body bounds,
reserved-versus-created transitions, collision/replacement refusal, idempotent
commit/lost acknowledgement, verified release, close/admission/reap/next ordering,
pre-abort no launch, failed startup and child-tree cancellation. Real subprocess
and PostgreSQL cases must preserve siblings and leave no owned test resources.
Compare the unchanged 18-case cohort with one shared server; startup and fixture
costs stay separate. Retain full serial/default validation and fresh bootstrap proof.
W3C user-facing focus/status guidance does not establish new conformance here.
