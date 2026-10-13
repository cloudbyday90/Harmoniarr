# Closed single-binding Wanted receipt groups

October 13, 2026. Baseline main `e0236b9`. The preceding 96-receipt workload
performs 672 hashes across seven projections, mostly duplicate historical
bindings. Grouping must establish current bytes, not promote a metadata cache.

## Bounded contract

Support only a bounded batch of 3–128 JSON receipts owned by one operator, all
with the same saved Wanted requirement, exact supported one-track scope, private
pathname and valid expected size/SHA-256. Each complete receipt is captured within
fixed depth/node/string budgets. Mixed scopes, evidence, paths, owners, unsupported
shapes, custom compatibility paths and limits keep ordinary serial verification.
No path normalization or cross-owner/artist/guard/invocation reuse.

For a supported positive batch, resolve the current private root separately for
every member, then collect a fresh full fingerprint. Resolve every member's root
again, then collect a second fresh full fingerprint to close the group. Both
actual byte observations and every root must agree; every captured receipt must
still match its accepted source. Only then return individual positive results.
Changed closing bytes/root/input refuse the projection as stale. Unexpected
Error/null and owned fingerprint cleanup remain intact. Opening missing/refused/
nonmatching evidence falls back to fresh serial verification, without caching
negative availability. Counters distinguish actual hashes from receipt outcomes.

Singles and pairs remain serial: two hashes would save no byte work for a pair.
Default grouping applies to the canonical fresh
fingerprinter; custom adapters retain serial behavior unless explicitly selected
for controlled comparison. Reader output order, each receipt/source identity,
all seven publication rereads, maintenance and required-event rollback remain.
The read service still owns one bounded buffer and closed handle per actual hash.
No new worker/schema/public setting, query parallelism, retry or resource increase.

## Why a closing full read

Same-size in-place writes can retain inode/device and restore mtime. A private
test must demonstrate that current metadata markers can match while SHA changes.
A grouped stat/mtime cache would miss that change; the closing full read must
refuse it before any grouped positive result. A descriptor or SQL transaction
does not freeze externally mutable file contents. No kernel-atomic filesystem
snapshot or immunity to changes after the last observation is claimed.

## Evidence and decision

Prove mixed/unsupported/capacity fallback, independent expected evidence and
owner isolation, source mutation, closing same-marker byte mutation, missing/
refused semantics, unexpected Error/null and delayed real reads. Native proof
must use the canonical default reader, real saved intent/history/private files,
full guarded reconciliation, late-change and required-event rollback.

Compare serial/reusable with closed-group/reusable in the explicit benchmark;
retain identical complete results and projection digests, accounting for fewer
actual hashes/bytes and additional current-root queries. Do not reuse the prior
stream-versus-reusable timing or repeat large experiments in normal validation.

Recommended stack: bounded exact receipt capture → fresh per-member root reads →
opening current hash → fresh per-member roots → closing current hash/source
comparison → individual results → unchanged fresh publication guards. Adoption
depends on this evidence. Separate research/outcome documents record actual
tradeoffs and limits. Main only; no release or PR merge.
