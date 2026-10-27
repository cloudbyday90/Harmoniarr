# Password work admission design

October 27, 2026. Extract password hashing/verification from `security.js` into a
small ESM factory and shared default owner. Existing security exports delegate to
that same owner, so login, password changes, bootstrap, account creation/claim,
recovery and provider placeholder hashes share capacity within the process.

The default admits two jobs and retains no application pending queue. Admitted
jobs may wait inside libuv behind unrelated work; that wait still holds a slot.
Input validation and
canonical legacy hash parsing precede admission; overload returns fixed 503
`password_work_busy` before native dispatch. A slot covers the entire promise
through native completion and result shaping; native failure releases once and
returns private-safe 503 `password_work_unavailable`. No request AbortSignal or
caller timeout can free a still-running native slot. There is no automatic retry.

Use explicit compatible N=16384, r=8, p=1, 64-byte output and 32 MiB maxmem. Keep
the existing scrypt$salt$hash encoding and random 16-byte salt. Strict bounded
parsing accepts the project's 32-hex salt/128-hex digest format; malformed records
produce false without native work. Full comparison remains timing-safe.
Legacy records do not encode cost parameters, so increasing their implicit cost
would invalidate verification. A versioned format/work-factor upgrade follows
this resource boundary rather than silently changing those parameters.

A shared input policy caps strings at 4096 UTF-8 bytes, checking code-unit length
before encoding measurement. Both low-level crypto entrypoints and the existing
password validator enforce it. No trimming, truncation, Unicode normalization,
new composition rule or minimum-length change is introduced. Above-cap legacy
passwords need existing reset/recovery; new enrollment cannot create them.

The cap is process-local and algorithm maxmem is not a total process/native RSS
ceiling. Native work has no cancellation promise; retaining its slot protects
admission while it runs. Some legacy non-login callers hash inside their own
transaction; this step bounds dispatch but does not redesign those lifetimes.
The normal password-login flow continues hashing outside checkout/account locks.

Qualify exact byte boundaries/Unicode/full comparison, zero native work for
invalid input/hash or overload, shared hash/verify saturation, native failure and
slot retirement, actual legacy compatibility, controlled HTTP refusal without
counter/session/audit writes, and unchanged auth transaction regressions. Run the
new packaged native workload in fresh 2/3 GiB profiles; keep sampled memory facts
separate from a memory bound or deployment minimum.

See [official research/tradeoffs](PASSWORD_WORK_RESEARCH_2026_10.md) and
[outcome](PASSWORD_WORK_OUTCOME.md).
