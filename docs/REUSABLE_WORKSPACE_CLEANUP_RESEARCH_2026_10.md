# Reusable workspace cleanup research — October 15, 2026

Official sources were discovered through connected search MCP and then opened
or searched within those verified pages. The execution host is Node 24.18.1 with
Docker Engine 29.8.2/API 1.56. Documentation version and installed runtime are
recorded separately; this change does not upgrade either.

Node's filesystem reference documents unique `mkdtemp` directories, symbolic-link
inspection with `lstat`, canonical paths with `realpath`, exact BigInt stat fields
and recursive `rm`. We use those long-established APIs to capture and recheck
directory identity before deletion. Forceful recursive removal is an operation,
not proof that a writer stopped. The reviewed reference is v24.20.0; native tests
exercise the installed v24.18.1 runtime. Vendor documentation does not make
multiple asynchronous filesystem calls atomic.
[Node 24 filesystem reference](https://nodejs.org/download/release/v24.20.0/docs/api/fs.html)

OWASP file-handling guidance recommends controlled names, directory restrictions
and careful storage placement. Applying that guidance to test fixture labels is
an architectural inference: reject path syntax, allocate a unique private child
and retain the captured parent boundary. This is not an upload feature or an
OWASP compliance claim. The exact label alphabet and 96-character limit are
project conventions checked against existing callers.
[OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html?trk=public_post_comment-text)

OWASP logging guidance calls for sensitive-data exclusion and failure-path
verification. Workspace decisions use fixed refusal codes and existing bounded
phase records; callback Errors/null are preserved privately. Directory paths,
raw predicate failures and database connection data are not added to public
diagnostics. Native PostgreSQL failure observations remain separate from proof
that a file/resource owner actually completed.
[OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

W3C High Resolution Time remains a September 1, 2026 Working Draft. Monotonic
durations support separate focused/native/fast measurement scopes. A fixed delay
cannot establish resource completion, and a passing cohort does not diagnose an
older timeout or demonstrate whole-CI performance improvement. There is no UI,
ARIA/focus/form change or accessibility-conformance claim in this fixture work.
[W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/)

## Source-to-decision method

Use the existing backend factory boundaries and actual returned cleanup owners.
Keep filesystem ownership and runtime admission in separate ESM modules; wire
them through the existing app runtime rather than adding another worker system.
Preserve original Error/null even when release or a predicate fails. Validate
holds and directory replacement at the owning boundary, then exercise the real
PostgreSQL/Docker entrypoint with the original resource policy. These are project
design decisions informed by the sources, not requirements stated by W3C.

The maintained standards/testing skills now route this evidence to the new
owners and native test. They distinguish intentionally retained callback
artifacts, unsafe retention, database release and actual root removal. An
independent caller's successful predicate cannot grant deletion of an earlier
retained child. This extends the existing practical skill; no duplicate generic
standards skill is introduced.

## Open PR check

GitHub MCP repository discovery and the open-pulls collection returned zero
open PRs at the start of this slice. No applicable random PR was available;
no patch was fabricated, and no PR merge/rebase/comment was performed. The final
lookup is recorded in the [outcome](REUSABLE_WORKSPACE_CLEANUP_OUTCOME.md).
Main-only work and the no-release instruction remain in force.

The [design](REUSABLE_WORKSPACE_CLEANUP_DESIGN.md) compares alternatives and gives
the final recommendation stack. The [outcome](REUSABLE_WORKSPACE_CLEANUP_OUTCOME.md)
separates baseline reproduction, focused controls and native/broader gates.
