# Artwork loading resilience design

Reviewed September 12, 2026. Harmoniarr artwork supports library and artist browsing; it must not block metadata, policy editing, or acquisition controls.

## Decision

Introduce a small ESM artwork batch resolver factory. Each instance admits at most two concurrent requests across overlapping calls, each containing at most 50 items to match the existing server route contract. Publish successful batches as they finish; failed batches leave their keys retryable and do not erase successful siblings. Artist discography and related artwork share an instance. This is a per-instance limit, not a global provider quota.

Keep lifecycle ownership in Vue composables. Watcher cleanup invalidates superseded batches; artist changes clear their scoped maps; shared resolver clear and scope disposal prevent stale results from repopulating them. Already-started HTTP requests may finish, but cancelled generations cannot publish or start additional batches. Transport abort is a future optimization, not a correctness guarantee in this slice.

Resolve hero background and thumbnail independently with settled outcomes. Retain successful sibling roles and previous artwork when a refresh role fails. Invalidate tokens before missing-artist early returns and on disposal. Catch synchronous injected resolver failures as rejected promises too.

Pass the artist card's resolved release-group artwork into the release modal. It is representative release-group artwork, not a claim to be the exact previewed edition cover. Keep the existing local-first image fallback behavior and adjacent release text. No new external image origin, HTML insertion, authentication path, or server request shape is introduced.

## Alternatives and final stack

| Option | Pros | Cons |
| --- | --- | --- |
| Bounded ESM factory plus lifecycle guards (chosen) | Partial success; predictable request load; shared reuse | Explicit lifecycle bookkeeping; slower total loading than unlimited requests |
| Promise.all over all batches | Simple | Unlimited fan-out and one rejection discards siblings |
| Promise.allSettled over all batches | Retains outcomes | Does not limit already-started requests or publish before all settle |
| Global artwork singleton | Global concurrency budget | Cross-page lifetime coupling and broader architecture change |

Final stack: existing artwork API → factory-owned two-slot batch scheduler → scoped Vue composables → existing artwork components and textual fallbacks. No dependency or database migration. Failed batches retry on later resolution calls; there is no automatic retry loop.

## Official research

URLs discovered and opened through tools as of September 12, 2026:

- [ECMAScript 2026 Promise.allSettled](https://tc39.es/ecma262/2026/multipage/control-abstraction-objects.html): collects fulfilled and rejected outcomes; concurrency limiting is a separate engineering decision.
- [WHATWG Fetch](https://fetch.spec.whatwg.org/): abort behavior does not substitute for lifecycle ownership; future transport cancellation can save work.
- [Vue watcher cleanup](https://vuejs.org/guide/essentials/watchers.html): register cleanup before awaiting work.
- [W3C decorative images](https://www.w3.org/WAI/tutorials/images/decorative/) and [functional images](https://www.w3.org/WAI/tutorials/images/functional/): preserve equivalent text and control names independently of artwork. Existing placeholders remain decorative; no per-image error announcements are added.

## PR review

GitHub MCP refreshed every open PR and complete patch. #40 head `649659f1e199d48d55cc8d5cccf9f079dc235d86` is an unrelated Node-major fixture change. #24 head `40cf4d117b69bd55b9a0a7353361838216e1e952` and #23 head `ae651337286216e92be7ae977e39fcedc14de7f9` are superseded by newer local action pins. No applicable patch was applied or merged.
