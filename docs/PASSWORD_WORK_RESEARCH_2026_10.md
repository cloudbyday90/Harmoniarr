# Password work admission research

Consulted October 27, 2026 through MCP search and official pages. Qualified
runtime: Node 24.22.1/OpenSSL 3.5.9, PostgreSQL 18.6 and pg 8.23.1.

| Official source and status | Applicable decision |
| --- | --- |
| [Node 24 crypto API](https://nodejs.org/download/release/v24.21.0/docs/api/crypto.html), vendor documentation for the preceding 24.x patch | Async scrypt uses libuv's shared threadpool and exposes cost/maxmem parameters. Retain slots through native completion. Actual behavior is qualified on 24.22.1; this reference is not mislabelled as that patch's documentation. |
| [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), informative guidance | Work factors trade memory/CPU for offline resistance. The existing N=16384/r=8/p=1 is below the listed current profiles. This admission change does not claim to upgrade password strength. |
| [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b.html), normative requirements within its assurance scope | Support long passwords and full verification without truncation; store algorithm/cost metadata for migration. This application is not claiming NIST compliance: existing minimum length and normalization behavior remain separately scoped. |
| [W3C accessible authentication](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum), informative WCAG 2.2 Understanding document | Preserve password-manager/autofill/paste behavior; add no cognitive challenge or client-side truncation. |

## Alternatives and recommendation

| Option | Benefit | Limitation |
| --- | --- | --- |
| Rate limits alone | Existing per-request defense | Do not bound concurrent native work across entrypoints |
| Increase UV_THREADPOOL_SIZE | More execution capacity | Does not bound memory/work; also changes unrelated libuv consumers |
| Bounded queue | Absorbs bursts | Retains passwords and needs wait/expiry ownership |
| Two active jobs, no queue (selected) | Constant admission state, immediate overload refusal, shared hash/verify capacity | Legitimate bursts may receive temporary refusal; cap is per process |
| Timeout and release active scrypt | Short caller wait | Native work can continue after apparent capacity release |

Recommended stack: 4096-byte UTF-8 input validation without truncation, strict
legacy hash parsing, one shared process-local hash/verify owner, two active jobs,
zero queued jobs, explicit compatible scrypt parameters/maxmem, timing-safe full
comparison, and release only after completion. Keep database authority/audit
owners independent. No new service container or global threadpool tuning.

The cap supports at least 1024 four-byte Unicode code points. Existing passwords
above 4096 UTF-8 bytes will be refused and require the existing password reset/
recovery path; they cannot be detected from stored hashes. No existing password
is shortened. Canonical project-generated legacy hashes remain compatible;
malformed hashes are refused before KDF admission.

Next prioritize versioned hash parameters and a measured work-factor upgrade,
with legacy verification and guarded upgrade-on-login. Resource admission must
remain owned while the stronger operation runs. Do not present this resource
bound as a total RSS guarantee or an aggregate login deadline.

See [design](PASSWORD_WORK_DESIGN.md) and [outcome](PASSWORD_WORK_OUTCOME.md).
