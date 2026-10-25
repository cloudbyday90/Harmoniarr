# Configured filesystem paths in diagnostics

Date: October 25, 2026. Scope: administrator Recovery/queue diagnostics and support
exports. This is data minimization hardening, not evidence of unauthorized access.

## Decision

Create an immutable redactor from current settings for each diagnostics read and
export. Extend the existing shared server policy with a pure configured-root
matcher. Include downloads, music, staging, transcode temporary storage, both
download-mapping prefixes and the application-data root. User music roots are
relative descendants of the configured music root.

Match absolute POSIX, Windows drive and UNC roots with component boundaries;
escape configuration before compiling expressions. Match Windows separators and
case independently of the host OS. Preserve POSIX case, literal backslashes and Unicode spelling.
Ignore relative roots and filesystem-wide POSIX `/`, which would erase routes.
Do not resolve files, follow symlinks or retain historical settings globally.

Preserve HTTP/public URL tokens and `/api` route tokens in the new matcher. When
a root has a child separator, redact to the next quote, bracket, comma, semicolon,
line break or end of message. This deliberately favors privacy for unquoted paths
containing spaces: trailing prose can also be removed. Stable IDs, status codes
and separate structured fields remain available. Exact roots without children
are replaced alone. Existing credential/key/known-path rules remain in force; historical known-root
patterns can also match URL path text, so this is not a general URL preservation
guarantee for the whole existing policy.

## Alternatives and final stack

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Broaden slash regex to every absolute-looking token | Simple, no settings query | Destroys API paths/URLs; still ambiguous with spaces | Reject |
| Global cache of configured and historical roots | Cheap per message | Stale after restore/save, mutable ownership, unbounded history | Reject |
| Current immutable settings at the read/export boundary | Current after save/restore; isolated; one compile per payload | One fixed settings read per boundary; composite export includes nested reads | Adopt |
| Structured error codes and path-owned fields at producers | Most reliable and useful minimization | Requires producer-by-producer follow-up | Next |

Final stack: existing settings loader → request-local shared redactor → pure
configured-root matcher → existing recursive key/credential/known-root policy →
administrator diagnostic response/support download. No dependency or schema change.

This does not sanitize stored rows, all application logs or every arbitrary secret.
Retired roots, encoded paths, aliases and ambiguous unconfigured text are outside
the new detection claim. Structured path fields retain their existing full-value
masking. A failed settings read fails the diagnostic request rather than silently
returning a less-redacted payload.

## Verification plan

Exercise exact/descendant/prefix-neighbor paths, quotes, spaces, Unicode, Windows
drive/UNC/separator/case behavior, regex metacharacters, invalid roots, URLs and
API routes. Prove fresh settings on subsequent reads and isolation across requests;
assert a fixed lookup count independent of event count. Test real composed
authenticated HTTP against disposable PostgreSQL for Recovery, queue and both
export forms, including settings updates and authorization/no-store controls.
Run focused tests, one stable fast gate, and the documented no-cache walkthrough
rebuild. Retain unrelated native/media proof only after source/runtime comparison.
