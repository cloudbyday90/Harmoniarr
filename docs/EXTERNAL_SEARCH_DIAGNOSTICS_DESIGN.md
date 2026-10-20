# Bounded external-search filtering diagnostics

Date: 2026-10-20. Follows [empty-search recovery](EXTERNAL_EMPTY_SEARCH_OUTCOME.md).

External ingestion already counts provider responses, files and rejection reasons.
Approved-request discovery currently discards them. Carry a strict numeric projection
through the existing worker summary and current-intent review query; render a small
read-only result component. Do not expose peer names, filenames, queries, raw
payloads, exception text or provider-supplied reason strings.

Only successful ingestion with zero accepted candidates and positive provider
responses qualifies. Genuine published empty searches keep their separate policy.
Missing diagnostics, failed reads and candidate success do not imply filtering.
Validate nonnegative safe integer counts and count relationships; compute supported
reasons from known counters rather than trusting a reason-code array. Reapply the
same projection when reading persisted summaries. Drop unknown fields.

Project evidence only from the current failed external discovery run, bound to its
approved intent/request, with the expected no-candidate failure and no supersession.
Clear diagnostics at worker start and in subsequent terminal summaries so retries
cannot inherit old reasons. Persist no new schema or parallel diagnostic history.

The UI explains separate response/file counts and each observed cause; never add
response and file counts into one total. Link ignored-source evidence to the
existing Ignored view and malformed provider evidence to Connections. Use fixed
internal route names, never provider-supplied links. Explain title exclusions without
inventing a settings editor. Preserve approved edition/recipient ownership; advise
a separate request if the approved edition is wrong. Quality scoring alone does not
establish that quality rejected these responses.

Review and navigation queue no searches, remove no ignores and reset no empty-search
budget. After an intentional source-policy correction, ordinary job Retry can
continue the saved provider search; it is distinct from Search again. Native
headings/lists/links expose persistent detail, while existing Refresh status owns
the asynchronous announcement and focus remains with the user.

Validate projection confidentiality and misleading/stale evidence controls cheaply;
prove actual ignored-source filtering through PostgreSQL, HTTP, worker and review;
check collection callers and real browser navigation/refresh. Keep the broad fast
gate for stable source, then rebuild the preserved local Docker stack without cache.
