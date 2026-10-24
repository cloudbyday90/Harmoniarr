# Eligible choices before a public cap

Use when valid quality-review alternatives are hidden behind ineligible higher
raw scores. Read the active repository's docs/ELIGIBLE_MATCH_SHORTLIST_DESIGN.md,
research and outcome.

1. Trace both the read projection and selection command. Fixing the list alone is
   insufficient if mutation still requires membership in the old raw shortlist.
2. Filter with the shared current scope/policy before the public twelve-choice cap.
   Use stable UUID keyset batches, including exact-page termination. Preserve the
   bounded response and distinguish a valid empty scope from unavailable authority.
3. Read only policy inputs and choice facts in a narrow store. Avoid candidate-file
   and per-alternative detail reads. Exercise batch/full-candidate eligibility parity
   when trimming fields; include both bitrate spellings, formats and legacy context.
4. Share one scoped scan result between detail choices and exhaustion permission.
   The guarded restart's existence check uses the same scanner with a one-match cap.
5. Validate candidate identifiers before SQL and precheck source/recipient scope
   before taking candidate locks. Revalidate under the canonical write locks;
   visible choices never authorize a stale or cross-scope selection.
6. Keep the public file/format/size allowlist, native W3C disclosure, owned focus and
   command feedback. Selection remains separate from download; retain failed media,
   original requirements, explicit consent and atomic event/audit evidence.
7. Prove a real eligible choice beyond fifty-one higher-ranked ineligible rows can
   be read and selected through HTTP and keyboard UI. Check private-field exclusion,
   cap/order, replay, stale authority and no transfer. Use query-count assertions for
   page reads and absence of per-alternative detail work, not whole-app timing claims.

This slice filters before the cap. For public pagination, follow
[scoped pages](match-pagination.md); score-based ordering is a separate choice.
Use official MCP-discovered sources and keep browser semantics separate from
manual screen-reader/device acceptance.
