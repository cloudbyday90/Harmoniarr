# Artwork corpus in mixed workloads

Use when qualifying entropy/sample-depth inputs with review/media activity. Read
active-repo docs/DEPLOYMENT_REVIEW_CORPUS_DESIGN.md, research/outcome and
[the mixed workload owner](deployment-review-memory.md).

1. Use the existing frozen corpus specs; reject unknown selectors before input
   generation/pool acquisition. Match actual fixture MIME, including WebP. Keep
   the real decoder/admission/transport and ordinary input paths unchanged.
2. One case/profile needs fresh container/database storage. Reuse would accumulate
   kernel peaks and allow asset cache hits. Equal canonical output hashes across
   different inputs do not establish equal source checksums or input sample depth.
3. Verify actual input metadata. Accepted PNGs preserve canonical decoded eight-bit
   pixels; explicitly distinguish this from full 16-bit precision. Check stored
   hashes, format/alpha/dimensions and metadata removal. Avoid parent raw decoding
   of the large refusal case.
4. Refusal must drain both jobs with the owned memory error, no publication lookup,
   asset/file/assignment, and actual child close. It cannot wait on the success
   publication gate or waive successful review/media completion and lease release.
5. Run all seven cases in fresh 2/3 GiB profiles, outside the fast gate. Rerun the
   affected three default memory cases and baseline mixed case when shared helpers
   change. Keep unrelated retained evidence tied to exact source/runtime identity.
6. Keep memory, logical reservations and duration scopes separate. Fixed noise is
   selected incompressible data, not arbitrary decoder complexity. No passing
   profile proves a production minimum, maximum-file or household-concurrency bound.
