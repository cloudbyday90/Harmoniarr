# Node 24.22.1 security patch outcome

Qualified October 21, 2026 on main. Implements the
[design](NODE_24_SECURITY_PATCH_DESIGN.md) with the
[official sources and tradeoffs](NODE_24_SECURITY_PATCH_RESEARCH_2026_10.md).

## Implemented baseline

`.nvmrc`, both package Node floors, lockfile root metadata and Docker Node index
now agree on 24.22.1. Existing CI setup-node consumers already use `.nvmrc`;
their configuration/contract checks pass without changing action pins or release
triggers. The isolated Linux signal runner and checkpoint assertions also use the
reviewed patch. The canonical guard explicitly refuses a real 24.22.0 executable
with exit 1, and its unit controls retain newer/other-major/drift refusal.

Windows validation uses `.tmp/node-security-2026-10-21/toolchain/node.exe`, whose
SHA-256 matches the official release. npm remains 12.0.2. This project-scoped
PATH does not replace the OS-wide Node installation. npm resolutions/integrities
are unchanged; only root Node-engine metadata changed in the lockfile.

No application API, authorization, TLS verifier, database migration/schema,
provider policy, framework or version/release metadata changed. The validation
skill's dependency-review reference now records coordinated patch guards,
actual artifact checks and the distinction between vendor fixes and selected
reproductions. New tests use ESM and owned loopback services.

## Final source and checks

Eight code/configuration files belong to the final source fingerprint,
**3,254 files**:

```text
d705061aaf6f360513d6d91986750c7c712453cd1f56d827e04fdd551255e1f0
```

The separate changed-file manifest includes `.nvmrc`, which is outside the
existing cohort fingerprint glob. Code/configuration hashes and package bytes
remain unchanged through focused, native, broad and image qualification.

| Gate | Result |
| --- | --- |
| Focused baseline/CI contract, signal ownership, DNS/Brotli, TLS fixture, HTTP session and recovery output checks | 34 passed |
| Selected native PostgreSQL and built Chromium consumers | 17 passed, zero failed/cancelled/skipped |
| Actual isolated Linux SIGINT/SIGTERM lane | 6 passed, owned container retired |
| Final `npm run validate:fast` | 10,808 passed: 5,641 server, 4,470 client, 697 scripts |
| Static, copyright, ESM, migration/snapshot policy, lint and both builds | Passed through the final gate |
| Existing Vue warnings | 225, unchanged and not suppressed |
| Built client files | Same 155 hashes as the preceding runtime and final build |
| Validation skill check | Passed |

All final test gates had zero failures, cancellations and skips. One stable fast
gate followed the selected native cohort; no exhaustive unrelated matrix or
deadline/concurrency change. Native plus built-browser checks completed in about
93.06 seconds on this host; this is not a matched whole-suite speed comparison.

Native coverage includes real PostgreSQL TLS DNS/IP acceptance, mismatch and
untrusted-CA refusal with actual socket retirement, query serialization, protected
HTTP mutations, session/role/revocation and legacy CSRF intent. Built Chromium
submits through the actual default-required token client, follows real lazy
children/history and exercises the requester journey. No TLS verification override,
extra CA or NODE_OPTIONS was configured for the host qualification; fixture CA
material remains scoped to its existing native test connections.

## Security controls and retained failures

An acknowledged loopback UDP server observed **one DNS packet** for the
NUL-containing name on 24.22.0, ending in ETIMEOUT. The patched runtime returned
`ERR_INVALID_ARG_VALUE` with **zero packets**. The regression failed on the old
executable and passes on 24.22.1. Both resolver/server lifetimes closed.
Repeated valid Brotli responses decode through bundled fetch on the patched
runtime; this is normal-consumer proof, not a malformed decoder exploit test.

The selected TLS alias comparator rejected its inputs on both runtimes. It does
not reproduce the vendor's TLS bypass and is retained as a non-reproduction.
Vendor adoption and these controls do not independently verify every advisory or
establish application-specific exploitability. Backported library fixes also
cannot be inferred solely from an unchanged component version label.

The first Docker inventory collection failed because of a syntax error in a
temporary collector, before build or application recreation. Its owned container
was removed and absence verified. The corrected collector was rerun on the same
frozen source; original logs remain under the private preflight-failed evidence.
This failure was not a runtime compatibility result.

The [Docker outcome](LOCAL_DOCKER_NODE_SECURITY_PATCH_OUTCOME.md) records the
no-cache preserved rebuild, exact runtime/base binary match and independent
disposable fresh/restart proof. Private evidence is under
`.tmp/node-security-2026-10-21`; generated fixture secrets are not committed.

## Recommendation and remaining scope

Retain Node 24.22.1/npm 12.0.2, the matching pinned Alpine families, modular ESM
services, PostgreSQL 18 and default TLS verification. This removes the previously
selected older canonical patch; pins still require active maintenance. Supported
package ranges and arbitrary build overrides are broader than exact canonical
qualification. Hosted CI, arm64 execution, independent signature audit, live
providers and complete image vulnerability assessment are outside this collection.
Physical assistive-technology acceptance remains deferred; UI regressions do not
establish full WCAG conformance.

MCP GitHub queries at selection and completion found zero open PRs, so none was
available to implement, rebase, close or merge. Work stayed on main without a
release, tag, separate branch or npm dependency upgrade.

Next, qualify the **actual provider HTTPS client boundary** in an isolated fixture:
trusted identity, DNS/IP mismatch, untrusted CA, redirects and compressed/error
responses with bounded diagnostics. PostgreSQL TLS acceptance does not establish
those provider-client contracts under the updated trust store/HTTP implementation.
