# Eligible alternatives before the shortlist limit

## Problem and decision

Quality review currently filters an already limited public shortlist. An eligible
match beyond that limit prevents Search again, yet cannot be reached in the chooser.
The mutation also requires old-shortlist membership, so a projection-only fix would
still refuse a newly exposed match.

Filter current quality-review alternatives before applying the existing twelve
choice cap. Reuse the native disclosure, command, feedback, focus and explicit
download flow. This round keeps a bounded shortlist; a new public pagination API
is not required to repair the demonstrated hidden-eligible case.

## Architecture and authority

A small ESM candidate store reads keyset batches of fifty in stable UUID order.
It selects only candidate identity/status, public file/format/size facts and the
private quality-context fields consumed by the shared eligibility policy. It
does not load candidate files, peers, provider bodies or source paths.

The shared quality-review scope scans these batches, filters eligibility and
collects at most twelve candidates. The same scanner answers Search again's
existence check with a one-match limit. Detail reads share one scope/scan result
for choices and exhaustion instead of repeating per-candidate reads.

Only the existing public fact allowlist crosses the Missing Music boundary.
Selection in measured quality review uses candidate ownership/eligibility rather
than membership in the old raw shortlist. Reject malformed identifiers before SQL
and precheck candidate scope before acquiring candidate locks. Current account,
wanted/discovery, creation and candidate locks plus fresh eligibility, track-scope,
transition/event/audit checks remain authoritative at commit.

No read selects or downloads a match. Retain rejected candidates, quality floors,
recipient consent and source bytes. Ordinary non-review selection retains its
existing shortlist rule. No dependency, migration, branch or release is needed.

## Evidence

Prove fifty-row keyset traversal, twelve-choice cap, batch/full-candidate policy
parity, no per-alternative detail/file reads and bounded public fields. Real SQL/HTTP
must expose and select an eligible match after fifty-one higher-ranked ineligible
rows, refuse cross-scope/stale/disabled choices and keep replay/rollback atomic.
Render the actual HTTP result in the existing disclosure, select by keyboard and
verify focus, refresh, reload and explicit no-download. Run focused checks before
the stable fast gate and affected SQL/browser/packaged lanes; rebuild the preserved
local walkthrough without cache.
