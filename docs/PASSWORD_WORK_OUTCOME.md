# Password work admission outcome

October 27, 2026. Hashing and verification now share bounded process-local work
admission and a 4096-byte UTF-8 input limit. Implementation stays on main without
a release/tag or additional service container.

## Delivered behavior

The small ESM work factory owns two submitted jobs and no application waiting
queue. Existing `security.js` exports delegate to one shared default instance,
covering password login, creation/change/claim/recovery and provider placeholders.
An admitted job keeps its slot while waiting inside libuv and through native
completion/result shaping. Browser disconnects do not release capacity. There is
no caller timeout masquerading as native cancellation or automatic retry.

Overload returns fixed 503 `password_work_busy` before dispatch. Native failures
or invalid native output return fixed 503 `password_work_unavailable`, preserving
the private cause and releasing once. Malformed stored records produce false
before native admission. The bounded parser accepts the project's existing
32-hex-salt/128-hex-digest scrypt encoding; comparison still verifies the full key
with timingSafeEqual.

Both low-level crypto functions and the existing password validator enforce the
4096-byte limit. Passwords are never trimmed, normalized or truncated. Exact
ASCII/Unicode boundaries and at least 64 Unicode characters remain supported.
Existing passwords above the new cap require the existing reset/recovery path;
their original length cannot be determined from stored hashes. The ten-code-unit
minimum remains unchanged and is not claimed as NIST compliance.

Explicit compatible settings are N=16384, r=8, p=1, 64-byte output and 32 MiB
maxmem with a random 16-byte salt. Legacy records do not encode cost; silently
changing it would break verification. **These settings remain below OWASP's
current listed profiles.** This change bounds resources, not offline password
strength. Versioned stronger parameters are the next security task.

## Executed qualification

Final source: 3,734 files, SHA-256
`b25fbcdf5e6703cf2c452baf9473d2f1ce82d67596a44636ef7e98d399c51f1b`.
All six code/test files were frozen before final qualification. The four changed
production paths match the immutable image; only documentation followed.

Focused command `node --test test/server/password-work.test.js
test/server/password-login.test.js test/server/account-security-service.test.js
test/server/account-claim-service.test.js
test/server/admin-recovery-completion.test.js` passed all 24 tests. The fourteen-
stage fast gate passed 6,268 server, 4,504 client and 703 script tests (**11,475
total**) with zero failures, cancellations or skips. Server concurrency was
capped at eight. Lint, ESM, copyright, migration/snapshot/anchor checks, Compose
policy, hygiene and production build passed. npm audit reported zero advisories.

The packaged `test/native/password-work.test.js` passed eight scenarios in each
fresh 2/3 GiB profile:

- Actual old-default scrypt records and full Unicode compatibility.
- Exact 4096-byte ASCII/Unicode input and changed-content refusal without truncation.
- Shared production hash/verify saturation at two submitted native jobs, immediate
  excess refusal, zero application queue and retirement to zero active work.
- Oversized inputs and malformed records refused before admission.
- Controlled HTTP saturation with no counter, audit or session mutations.
- Actual HTTP input refusal before authentication mutations.
- Controlled completion paused through HTTP disconnect: the work slot remains
  held, then retires and the required security write finishes independently.
- Ordinary production login retry after retirement.

Controlled derivation barriers prove ownership/interleaving, not native hang
cancellation. The production-cap case uses actual scrypt. Sampled Node-process
RSS during that case was:

| Container profile | Before | Sampled peak | After fixture work |
| --- | --- | --- | --- |
| 2 GiB | 133.8 MiB | 165.7 MiB | 134.9 MiB |
| 3 GiB | 133.6 MiB | 165.6 MiB | 135.4 MiB |

Five-millisecond samples can miss peaks; these are process observations, excluding
the separate PostgreSQL process. Neither algorithm maxmem nor these measurements
establish a total RSS bound, deployment minimum or mixed-media capacity.

Existing auth-read/session/failure/login/rotation/replay fixtures passed their
16/10/20/16/15/13 scenarios at 3 GiB. Across profiles this is **106 scenario
executions**, including the repeated eight-case password cohort. All eight native
containers exited 0, were removed and had exact absence verified. Source-overlay
preflight remains separate from final packaged proof. See the
[Docker outcome](LOCAL_DOCKER_PASSWORD_WORK_OUTCOME.md). Private logs/receipts are
under `.tmp/password-work-2026-10-27/`.

## Recommendation and limits

Adopt byte validation, bounded legacy parsing, shared hash/verify admission,
explicit compatible parameters, full comparison and native-completion retirement.
Benefit: bounded password dispatch/retained input with safe overload handling.
Costs: temporary refusal during bursts and the explicit over-cap compatibility
boundary. See [official research and alternatives](PASSWORD_WORK_RESEARCH_2026_10.md)
and [design](PASSWORD_WORK_DESIGN.md).

The cap is per process and admitted work can wait in libuv. No aggregate login
deadline, host-global allocator, stronger KDF, new minimum/normalization policy,
or universal memory guarantee was introduced. Some legacy non-login callers hash
inside transactions; those lifetimes were not redesigned. Their service tests
passed, but this step does not rerun every provider/recovery transaction matrix.
Unchanged packaged paths/dependencies retain their historical scope. UI assets
remain unchanged; no new assistive-technology or full W3C conformance claim is made.

GitHub MCP found no open repository or Dependabot PRs. Random local application
and stale cleanup/rebase were inapplicable; no PR was merged.

Next: version the stored hash parameters and upgrade to a current reviewed work
factor, with bounded legacy verification and guarded upgrade-on-login. Qualify
the stronger cost under the same resource profiles before selecting it.
