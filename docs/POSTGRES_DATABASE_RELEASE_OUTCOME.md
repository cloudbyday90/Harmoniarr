# Strict shared database release outcome

Date: 2026-10-15. Work is on main; no release, tag, branch or PR merge is created.

## Delivered behavior

The shared empty-schema runtime now selects the helper's existing strict cleanup
policy. An otherwise successful scenario rejects its first pool-close, backend-
drain, DROP or admin-close failure. Earlier scenario/setup Error/null values
remain primary and later cleanup still runs. The functional wrapper still awaits
its owned server stop. Borrowed servers are not acquired or stopped.

This is a one-selection correction in the existing ESM lifecycle. The helper's
compatibility default remains unchanged for direct schema tooling. Template and
parent-owned fixtures retain their existing strict policies. No production
source, schema, dependency, fixture mode or resource limit changed.

## Validation evidence

Before implementation, the dedicated 22-case container-free regression run had
four passes and 18 failures. Sixteen stage/source/Error-or-null cases and the held
first-failure case lost their expected rejection; a wrapper case instead surfaced
the secondary stop error. After selecting strict cleanup, the focused shared
runtime, helper, app and workspace cohort passed 88/88, zero skips, in 20.863
seconds of runner time. It exercises the actual helper through the changed
runtime, rather than merely checking that an option was supplied.

The new native cases use one fresh PostgreSQL 18 owner and borrowed empty-schema
runtimes. Each runs an actual isolated pool query under the existing pool bounds.
Before DROP, the test adapter changes only its own maintenance session to a
temporary NOLOGIN role. PostgreSQL then rejects the real DROP with SQLSTATE 42501.
The admin client disconnects and its returned completion tail is held. The
scenario stays pending while that tail is held; the target's captured OID still
exists. Releasing the tail returns the original driver error after successful
work, or original null after a failed scenario.

Borrower cleanup leaves the target, server and sibling database intact; sibling
identity and sentinel data are checked. Only the independent test owner then
checks captured target/role identities, drops them and verifies absence. Actual
operations are registered and drained before suite disposal. These are controlled
native authorization refusals, not diagnosed historical DROP, network or timeout
incidents. They do not establish an atomic OID fence for standalone helper cleanup.

The selected final native cohort passed 12/12, with zero failures, cancellations
or skips, in 35.859 seconds of runner time (35.951 seconds including invocation).
It includes both new permission-refusal cases, eight existing native template
cases and the two prior server-stop controls.

The complete fast gate passed 10,256 cases (5,304 server, 4,384 client and 568
script), zero failures/cancellations/skips, plus static checks, lint and both
builds in 136.750 seconds. All JavaScript stayed frozen from native validation
through that gate. These are elapsed observations, not a matched speedup claim.
Production dependency audit reports zero known vulnerabilities.

Both repository skills and the installed standards skill passed structural
validation; all four installed standards files match repository bytes. Three
final JavaScript hashes match staged bytes, 91 previously frozen source files
remain unchanged, and 704 local links in ten changed Markdown documents resolve.
Staged whitespace checks pass. Structural checks are distinct from a new blind
skill trial. Private evidence is ignored under
`.tmp/postgres-release-2026-10-15/`.

## Standards, recommendation stack and next item

The existing standards/testing skills receive focused release-contract guidance.
The method connects maintainer PostgreSQL/driver behavior to observable ownership,
completion and primary-failure evidence, applying W3C/OWASP data minimization to
diagnostics. It makes no new browser/WCAG or blanket security certification claim.
See [official research and option tradeoffs](POSTGRES_DATABASE_RELEASE_RESEARCH_2026_10.md).

Recommended stack: strict selection at the shared owner → existing awaited helper
stages → original scenario/first cleanup failure → bounded owned server teardown
→ independent workspace quiescence → fast contracts and bounded native proof.
The benefit is accurate release failure reporting with a small implementation;
the cost is that formerly hidden teardown failures now fail validation.

Next: review empty-schema shared-runtime admission and drainage. App and template
owners have lifetime barriers, but the lower shared empty runtime has no matching
barrier around returned isolated-database operations. A controlled injected
adapter reproduced one server stop completing while a database tail was still
held, and another scenario admitted after cleanup. It launched no native server
and does not establish how often real callers violate that lifetime expectation.
Evaluate sealing admission and awaiting actual release tails before server
cleanup, using the existing lifetime module where appropriate. Preserve canonical
cleanup identity, primary failure contracts, resource bounds and caller ownership.
Hosted Ubuntu canonical media evidence remains a separate requirement before
media-default promotion.

Initial and final GitHub MCP collection reads returned zero open PRs. No
applicable random PR or stale PR was available to implement, rebase or merge.
No PR comment or other external message was sent.

See [design](POSTGRES_DATABASE_RELEASE_DESIGN.md).
