# Migration scaffold policy outcome

Implemented October 21, 2026 on main with Node 24.22.0/npm 12.0.2. The generator
now passes its existing SQL transaction template through the canonical
`insertCopyrightHeader` helper before writing the exclusively created file.
Owner, year and license notice come from the maintained SQL policy.

## Behavior and evidence

The revised regression test reproduced the old failure: a real newly generated
SQL file made the real copyright checker exit 1 with “No copyright header found”.
The fixed generator's output passes that checker and the real filename checker
in an owned temporary directory. It preserves the transaction body/UUID hint,
UTC timestamp, filename-only stdout, path-like description normalization and
existing usage refusal. Cleanup checks the acknowledged temporary parent/prefix
before recursively removing its own directory.

The existing backend skill now describes the corrected scaffold and directs
authors to actual policy consumers before costly database qualification. Its
recovery reference no longer instructs manual repair of every generated header.
The [design](MIGRATION_SCAFFOLD_DESIGN.md) compares shared policy, duplicated
templates, SPDX-only conversion and later repair. The
[official research](MIGRATION_SCAFFOLD_RESEARCH_2026_10.md) records source status,
GNU retrieval limits and the next runtime priority.

Two changed code/test files belong to final source fingerprint **3,253 files**:

```text
8dc98a8fd4b438d8cfd8e5a95aa033d05cf5390a37d42164065d40773f7cdae9
```

| Gate | Result |
| --- | --- |
| Focused generator, copyright, migration-ID policy and shared script argument/entrypoint/runtime tests | 28 passed, zero failed/cancelled/skipped |
| Final `npm run validate:fast` | 10,806 passed: 5,639 server, 4,470 client, 697 scripts; zero failed/cancelled/skipped |
| Static, copyright, ESM, migration/snapshot policy, lint and both builds | Passed through the final fast gate |
| Existing Vue warnings | 225, unchanged and not suppressed |
| Client build artifacts | Same 155 files before and after the gate |
| Backend skill validator | Passed |

The focused cohort takes about 0.45 seconds on this host; it is not a whole-suite
performance claim or a new deadline. The final broad gate runs once on stable
source. No timeout, assertion or skip policy was weakened.

No database SQL file, schema snapshot, dependency, application server/client or
runtime contract changed. The migration-ID consumer in the focused cohort checks
its existing repository inputs and snapshot controls; only the copyright and
filename child checks consume the new temporary scaffold. This distinction avoids
claiming that the migration-ID tool tested a file outside its configured manifest.
No fresh PostgreSQL/browser suite was needed for this comment-only authoring fix.
The [preserved Docker rebuild](LOCAL_DOCKER_MIGRATION_SCAFFOLD_OUTCOME.md) records
packaged bytes/readiness separately; the authoring script is not shipped there.

## Follow-up

MCP GitHub searches at selection and completion found zero open PRs.
None was available to implement, rebase, close or merge. Work
stays on main without a release, version, tag or dependency update.

Next priority is qualification of the newly published **Node 24.22.1 security
baseline**, including its local/CI/Docker pins and native TLS/HTTP consumers.
This round remains on 24.22.0 and does not assess application-specific
exploitability. Physical screen-reader/device acceptance remains deferred; no
web interaction or accessibility conformance claim follows from SQL-header tests.
