# Bounded root reads during Wanted publication

October 13, 2026. Baseline: `4d59887` on main.

## Decision and ownership

For an existing exact closed receipt group, resolve its current owner root once
before the opening full hash and once before the closing full hash. Allow this
only inside an admitted Wanted publication transaction whose root-input writers
participate in the existing projection lock. Retain complete bounded receipt
capture, both hashes, current filesystem/descriptor checks, source comparison,
every projection recheck and atomic required events. No root value is cached.

A narrow proof store reads current transaction identity, Read Committed/origin
mode, held projection authority and the two enabled statement triggers with
their exact function/column contract. A service mints an opaque token bound to
that queryable and deletes its private registration in finally. Each bounded
root statement checks the captured transaction ID, including when the owner is
missing. A reused connection or fabricated/expired token cannot grant batching.
No identifier, SQL definition or root value enters public diagnostics.

The canonical Wanted service defaults to bounded mode. Explicit custom projection
readers default to compatibility mode, and standalone readers have no token.
Internal member/bounded comparator modes both obtain the same proof; only the
bounded mode forwards the token. Custom root resolvers always retain independent
reads. A custom fingerprint wrapper needs explicit bounded-root selection and
still requires the real transaction token and canonical root resolver.

Only the existing 3–128-member same-owner/requirement/scope/path/evidence group
qualifies. Singles, pairs, mixed, unsupported, over-budget and opening-negative
cases retain the old serial/member fallback. Closing changed root, bytes, source
or transaction refuses publication. Error/null and awaited completion remain.

## Alternatives and tradeoffs

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Two fresh root statements per closed group, admitted token | Removes repeated SQL/containment while preserving closing authority and bytes | Proof/identity plumbing and existing writer contention; adopt only after native and exact-result proof |
| Independent member roots | Existing conservative contract; supports custom/standalone paths | Repeated joined SQL and containment; retain as comparator/fallback |
| Boolean flag alone | Simple wiring | Cannot establish an owned transaction or writer participation; reject |
| Connection-keyed root cache | Fewer reads | Outlives transactions/guards and can conceal revocation; reject |
| Omit closing root/hash | Less work | SQL locks do not freeze filesystem bytes or in-transaction changes; reject |

Root-input writes still wait behind admitted publication; this round does not
change that ordering or preempt already admitted work. Privileged DDL/TRUNCATE/
replication bypass and earlier conflicting tuple locks retain the preceding
coordination design's maintenance limits. Runtime proof refuses missing/changed
guards instead of silently authorizing a reduced read count.

## Proof and recommendation stack

Prove default production wiring, missing/null/disabled current state, writer-first
and late-writer ordering, changed root within the same transaction, transaction
replacement, token expiry/forgery/queryable mismatch, custom/standalone fallback,
same-marker byte mutation and required-event rollback. Compare full results and
private projection digests, receipt outcomes and identical actual hashes/bytes.
Count saved root statements separately from proof overhead and sample heap/RSS
without allocation or leak claims. Keep the larger matched experiment opt-in.

Recommended stack: real writer admission → current guard/transaction proof →
invocation token → exact receipt capture → fresh root/opening full hash → fresh
root/closing full hash → original source and publication/event guards. Use this
narrow path; preserve conservative fallbacks and qualified measurements.

See [research](WANTED_BOUNDED_ROOT_READ_RESEARCH_2026_10.md) and
[outcome](WANTED_BOUNDED_ROOT_READ_OUTCOME.md).
