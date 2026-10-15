# PostgreSQL runtime cleanup outcome

Date: 2026-10-15. Work is on main; no release, tag or PR merge is part of this slice.

## Delivered behavior

The shared runtime now rejects an owned server-stop failure in empty-schema mode
as well as template mode. It retains its single cleanup promise and one stop
attempt. Earlier template/scenario failures retain exact Error/null identity
while later cleanup still completes. No production service, schema, dependency,
resource limit or fixture mode default changed.

The initial container-free regression run had 15 cases: 12 passed and three
failed with missing expected rejection (empty-schema stop Error, stop null and
successful-wrapper/failed-stop). This red evidence precedes the one-condition
correction. The focused runtime, app and workspace cohort then passed 52/52,
with zero skips, in 18.544 seconds of runner time.

## Native evidence

Both final native PostgreSQL cases passed, with zero skips, in 10.906 seconds of
runner time (10.997 seconds including process invocation). Each starts a real
PostgreSQL container, runs an actual isolated scenario query and verifies its
database was dropped. Template mode also executes the real preparation/clone
path. A controlled adapter holds the stop, then rejects before calling the real
stop. Cleanup remains pending during the hold, returns the original Error/null,
and retains the same rejected promise without a second stop attempt.

An independently owned maintenance client successfully queries before and after
that rejection. This proves that failure propagation does not certify shutdown.
Finally, the test closes that client, directly stops only its captured server
with the existing deadline and verifies the full container ID is absent. Normal
Ryuk behavior remains enabled. These are controlled pre-stop adapter failures,
not reproduced Docker transport failures or diagnoses of earlier PostgreSQL
connection incidents.

Existing focused app/workspace tests also pass: uncertain children retain their
original Error/null and parent directory through later teardown failure, while
safely drained workspaces can be removed despite an independent PostgreSQL
failure. No failed stop grants workspace or container-storage deletion authority.

## Final checks and recommendations

The complete fast gate passed 10,234 tests: 5,282 server, 4,384 client and 568
script cases, with zero failures/cancellations/skips, plus static checks, lint and
both builds, in 129.960 seconds. The runtime and fast-tested source stayed fixed.
A final native-test-only fallback release refinement followed that gate; both
native cases, focused lint and test hygiene passed again on the final source.
This elapsed time is an observation, not a matched speedup claim. Production
dependency audit reports zero known vulnerabilities.

Both repository skills and the installed standards skill passed structural
validation, and all four installed standards files matched repository bytes.
All three final JavaScript hashes match staged bytes; 89 previously frozen
source files remain unchanged, and 698 local links in ten changed Markdown
documents resolve. Staged whitespace checks pass.
Private red, focused and native evidence is ignored under
`.tmp/postgres-cleanup-2026-10-15/`.

Initial and final GitHub MCP collection reads reported zero open PRs. There was
no applicable random PR to implement or stale PR to rebase. No PR comment or
merge occurred.

The existing standards and testing skills gain a focused ownership/failure
reference. This extends the requested practical W3C/OWASP/runtime method without
creating a second competing skill. Structural validation is separate from a new
blind behavioral evaluation.

Next: review strict temporary-database cleanup at the shared empty-schema
entrypoint. It still delegates to the helper's legacy `strictCleanup=false`
default; pool closure, backend drainage or DROP failure after a successful
scenario can remain best effort. An injected helper control returned a successful
result after one controlled DROP rejection and one admin close. It created no
real database and does not reproduce a native DROP incident. The server-stop
fix does not establish that database-release contract. Preserve borrowed-server
ownership and original Error/null when evaluating that next bounded change.
Separately review an actual manual Ubuntu canonical-media workflow result before
promoting media defaults.

See [design](POSTGRES_RUNTIME_CLEANUP_DESIGN.md) and
[official research, pros/cons and stack](POSTGRES_RUNTIME_CLEANUP_RESEARCH_2026_10.md).
