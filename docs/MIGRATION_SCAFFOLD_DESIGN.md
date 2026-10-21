# Migration scaffold policy design

The October 21, 2026 follow-up fixes a reproduced authoring failure: a newly
generated migration fails `check-copyright` before meaningful validation begins.
The generator writes only the transaction template; its old test enforces that
headerless text. The repository already has the canonical SQL header in
`scripts/copyright-maintenance.js`.

| Approach | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Reuse `insertCopyrightHeader` while generating the file | One owner for SQL comment syntax, year, contributor and license policy; small ESM change | Generator imports the existing maintenance helper and its installed `glob` dependency | Adopt |
| Copy a header into the generator | Small local patch | Duplicates policy and can drift at year/owner changes | Reject |
| Convert the project to SPDX-only headers | Concise machine-readable license identifiers | Requires separate policy/checker review; historical applied SQL changes would affect checksums | Defer |
| Repair generated files in a later batch | Existing maintenance command can do it | Makes a fresh scaffold fail the first policy gate and modifies more files | Reject as the normal authoring path |

Recommended stack: canonical SQL header helper → existing exclusive file creation
and filename normalization → actual copyright/filename checker subprocesses → one
stable fast gate. Keep the existing UTC timestamp, forward-only transaction body,
UUID-default hint, raw filename output and `open(..., 'wx')` ownership. No new
service, dependency, migration or schema change is necessary.

The regression test runs the real generator in an acknowledged temporary
directory, then runs the real checker entrypoints against that generated file.
It also verifies transaction-template preservation, safe normalization of a
path-like description, filename-only stdout and the existing missing-description
refusal. Recursive cleanup is restricted to the owned temporary directory.

This is an authoring-tool fix. It does not change executable migration statements,
database state, runtime authorization, UI or web semantics. W3C interaction and
accessibility rules have no new implementation owner in this change. PostgreSQL
and browser suites are therefore not repeated for this comment-only output fix.
The standing preserved Docker rebuild is recorded separately and must keep the
same runtime bytes, admin and data. See [research](MIGRATION_SCAFFOLD_RESEARCH_2026_10.md)
and [outcome](MIGRATION_SCAFFOLD_OUTCOME.md).
