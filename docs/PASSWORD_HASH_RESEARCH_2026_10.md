# Password hash research — October 27, 2026

## Official evidence

Sources were discovered and read through the connected search MCP service on
October 27, 2026. These are vendor/standards sources, not inferred URLs.

- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
  prefers Argon2id, lists scrypt N=16384/r=8/p=5 among its minimum profiles, and
  describes successful-login rehashing. Its profile choices trade RAM for CPU.
  Inactive accounts can retain older hashes indefinitely. This is security
  guidance, not a claim that one setting fits every deployment.
- [Node 24 crypto API](https://nodejs.org/download/release/v24.21.0/docs/api/crypto.html)
  documents asynchronous scrypt, explicit N/r/p/maxmem, a random salt of at least
  16 bytes, and approximate memory admission of 128*N*r. The retrieved page is
  for 24.21.0; qualification uses the installed 24.22.1 binary. Algorithm memory
  and maxmem do not describe total process RSS or shared libuv contention.
- [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)
  recommends storing algorithm/cost information to permit migration. Its broader
  password requirements include long-input support and whole-password handling.
  This change does not establish NIST conformance: the existing ten-code-unit
  minimum and input normalization policy remain unchanged.
- [PostgreSQL 18 row locks](https://www.postgresql.org/docs/18/explicit-locking.html)
  describe the writer exclusion provided by FOR NO KEY UPDATE. Application
  inference: compare the exact verified hash and textual credential epoch after
  that lock, then publish the upgrade and login writes in one transaction.
- [W3C WCAG 2.2 accessible authentication explanation](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum)
  supports password-manager filling and paste. This informative explanation
  informs preservation of the current form and whole-password behavior; it is
  not a complete accessibility assessment.

## Options and tradeoffs

| Option | Benefits | Costs / limits | Decision |
| --- | --- | --- | --- |
| Retain legacy N=16384/r=8/p=1 | No migration or extra CPU | Below OWASP's listed current profiles; no recorded cost | Verification compatibility only |
| Versioned scrypt N=16384/r=8/p=5 | Existing native implementation; nominal 16 MiB algorithm memory; stronger listed profile | More CPU and potentially more busy refusals | Implement now |
| Versioned scrypt N=131072/r=8/p=1 | Listed memory-heavy profile | Nominal 128 MiB/job; requires different maxmem and resource qualification | Defer |
| Argon2id migration | OWASP's preferred algorithm family | Separate implementation/runtime qualification and compatibility work | Evaluate separately |
| Offline or maintenance rehash | Could reach idle accounts | Requires plaintext passwords; stored hashes cannot supply those secrets | Do not implement |
| Upgrade on successful login | Secret already supplied; gradual migration | Extra derivation on first login; idle accounts remain legacy | Implement with exact-source guard |

The memory figures are algorithm estimates, not service-wide limits. No fixed
CPU multiplier or production latency guarantee follows from the profile values.

## Recommended stack

1. Node asynchronous scrypt with an allowlisted versioned p=5 profile, 16 random
   salt bytes and a 64-byte derived key; retain legacy p=1 verification.
2. Shared admission of two native jobs, no application queue, and the existing
   4096-byte full-input cap. Hold capacity through actual native completion.
3. Prepare upgrade material outside SQL. Lock the account and compare the
   accepted hash and full epoch; commit upgrade, bookkeeping, session and audit
   together. Preserve the epoch because the secret did not change.
4. Preserve password-manager/paste behavior, private fixed errors and cookie
   delivery only after confirmed publication. Keep unknown versions/costs closed.
5. Qualify real native work in fresh 2/3 GiB profiles. Replace the application
   binary as one deployment; old binaries cannot verify the new encoding.

See [design](PASSWORD_HASH_DESIGN.md) and [outcome](PASSWORD_HASH_OUTCOME.md).
The next recommended security boundary is atomic, current-credential-owned
password change, session revocation/reissuance and its required audit.
