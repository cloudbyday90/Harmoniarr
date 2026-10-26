# Backup failure precedence outcome

October 26, 2026. See [design/tradeoffs](BACKUP_FAILURE_PRECEDENCE_DESIGN.md),
[official-source research](BACKUP_FAILURE_PRECEDENCE_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_BACKUP_FAILURE_PRECEDENCE_OUTCOME.md).

## Result and recommendation stack

The original publication/deletion failure now survives a secondary failure while
recording it. A small ESM recorder owns safe journal projection, awaited error-only
recording and an awaited bounded secondary diagnostic. Error identity, frozen
objects and thrown null/undefined remain intact; no mutation, aggregate wrapper,
raw-error chain, retry or replacement connection is introduced. A missing journal
row is unrecorded. Secondary reporter failure cannot replace the original.

Recovery retains ordinary deferred-per-operation behavior when recording succeeds.
When recording fails, it stops and throws the primary failure. It does not return
a successful/deferred aggregate that implies the failure was persisted. Durable
phase/link/completion fields remain under their existing workflow/store owners.
The local gate covers reporting and session cleanup before admitting replacement
work. Diagnostics contain only a fixed event, finite categories and a validated
UUID, without raw messages, stacks, SQL, filenames or paths.

Adopt original failure → safe error-only journal write → bounded secondary report
if unavailable → original throw, or normal deferred recovery after a recorded
failure. Benefits are identity preservation and truthful missing-journal visibility;
the limitation is that a secondary report cannot become durable when both sinks
fail. The design compares alternatives and their pros/cons.

The randomly selected [PR #56](PR_56_DEPENDENCY_OUTCOME.md) is implemented locally,
without a GitHub merge. The dependency audit also found and prompted the separate
[compressed-parser security update](COMPRESSED_JSON_SECURITY_OUTCOME.md).

## Validation

The controlled baseline probe reproduced an `EIO`/null being replaced by a journal
ownership error. Final focused validation passes 38 tests. The helper matrix covers
primary Error/null/undefined/string, secondary Error/null, reporter success/Error/
null, frozen identity, missing rows, safe default output and actual report lifetime.
Caller checks cover publish/delete/recovery, unchanged phases and recovery stopping
before a later operation when recording fails.

All final fast-gate stages pass: 6,042 server, 4,485 client and 700 script tests
(11,227 total), zero failures/skips/cancellations. Lint, baseline/migration/schema,
ESM/image/topology/hygiene checks and build pass. The explicit server invocation
was `node --test --test-concurrency=8 "test/server/**/*.test.js"`, about 71 seconds;
this is a bounded equivalent invocation, not execution of unchanged
`npm run validate:fast` or a general CI benchmark. The earlier pre-parser gate also
passed, but final lockfile/test changes required a separate final-source run.

Five final native entries pass in separate networkless, read-only containers with
disposable PostgreSQL (3 GiB/two CPUs): failure precedence, existing journal,
I/O drainage, exclusive publication and compressed JSON. Mounted sources match
independently inventoried packaged modules. The new precedence entry observes
three real permission failures and three rejected actual journal UPDATEs through
a controlled PostgreSQL trigger. The original native error survives, phase/error
fields do not regress, and fresh production recovery verifies bytes/catalog.
Real backend termination during admitted controlled Error/null failures proves
owner-loss refusal cannot mask the primary value. Reporting remains locally owned
until settlement, including a reporter throwing null. These controlled failures
are identified separately from actual filesystem/SQL errors.

The live packaged storage probe passes exclusive link, same-inode cleanup,
collision preservation and mode `0600`; its private directory is removed. Seven
new packaged Chromium checks pass login, query/hash redirect, lazy navigation,
back/forward history, reload and nested deep link, with no page/asset errors.
They are router compatibility checks, not physical-device or screen-reader proof.

Exact source/runtime review retains 44 unrelated native entries, 42 SQL checks and
controlled-provider/file-backed evidence. Runtime changes are restricted to three
backup modules and two parser-related package versions; pg/media/native binaries
are unchanged. Twenty earlier browser checks remain historical because client
bundles changed; they are not presented as executions on the new client.

Final frozen source: 3,540 files,
`06845ba65663426ac668ffac5cb404690fed73ff436ff7a065128cdd59ea40fe`.
Initial/baseline evidence is under `.tmp/backup-failure-precedence-2026-10-26/`;
final evidence/audit is under `.tmp/backup-failure-precedence-final-2026-10-26/`.
All builders, bootstrap, inventory/identity, native and browser helpers retire.
Administrator, data and five binds are preserved. No schema/version/release or
branch change; work stays on `main`.

## Next recommended item

Completed by the [backup handle cleanup outcome](BACKUP_HANDLE_CLOSE_OUTCOME.md).

Preserve the primary temporary-file write/sync failure when closing its file handle
also fails. A separate controlled file-handle probe reproduces Error/null masking
at both write and sync: the current unconditional `finally` close throws over the
earlier failure. Qualify primary/close success/failure combinations, always attempt
and await close, and keep close-only failures visible. This finding uses injected
callbacks, not an observed storage incident; the private probe is retained. The
current recorder preserves the failure it receives and cannot recover a primary
already replaced inside the lower-level file service.
