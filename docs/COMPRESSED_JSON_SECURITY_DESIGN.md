# Compressed JSON parser security design

October 26, 2026. Discovered during the dependency review for
[backup failure precedence](BACKUP_FAILURE_PRECEDENCE_DESIGN.md).

The npm audit reported high-severity CVE-2026-111181 in body-parser 2.3.0.
The production `createApiJsonBodyParser` uses Express JSON parsing with default
decompression enabled, matching the affected configuration. The
[maintainer advisory](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828)
identifies patched 2.4.0 and recommends updating; its alternative workaround
disables compressed request bodies. The
[upstream fix and regression cases](https://github.com/expressjs/body-parser/commit/1260c3845f54502a05a87594f09a334786bb34d7)
detach/destroy the completed decoder, keep late errors handled and consume the
remaining raw request bytes without removing other consumers.

Update the transitive lockfile selection to body-parser 2.4.0 and its required
qs 6.16.1, within Express's existing dependency range. Preserve compression and
request-size policy. No application parser fork, direct dependency or override.
PR #56's Vite/router patch remains independently identifiable in the same lockfile.

| Option | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Update maintained parser | Repairs stream cleanup and preserves compressed clients | Lockfile/runtime dependency change requires regression checks | Adopt |
| Disable inflation | Avoids decoder creation | Rejects existing compressed clients | Keep as an upstream workaround, not this change |
| Patch vendored/parser application code | Can target cleanup directly | Duplicates upstream maintenance and stream behavior | Reject |

Use a child process so the vulnerable baseline cannot terminate the test runner
or live application. The reusable test-only ESM probe imports the actual production
parser factory, holds the raw HTTP request open after a valid deflate frame, then
sends trailing bytes when parsing finishes. It waits for raw request completion,
checks gzip trailing/valid bodies and a follow-up health request, and owns child
stdio/process close. The baseline child exits with an unhandled decoder error;
the repaired child must complete all checks normally. No global uncaught-exception
handler, arbitrary success sleep or relaxed response assertion is added.

Run that probe in the fast suite and against `/app/server-dist/http-hardening.js`
in the guarded final image. Re-audit the complete installed dependency tree and
verify the exact two changed runtime package versions. This qualifies parser
availability for these cases, not general HTTP security or all compression inputs.
