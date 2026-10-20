# Unit-aware shared-search diagnostics

Date: 2026-10-20. Follows [external diagnostic evidence](EXTERNAL_SEARCH_DIAGNOSTICS_OUTCOME.md).

Source tracing corrects the previous recommendation's surface attribution: the
mixed `Filtered` total belongs to advanced Activity > Wanted. Canonical Missing
Music has a separate authorized decision DTO and does not call that helper.
Fix the real advanced consumer and expose the same bounded counts in the canonical
inspector, rather than treating a helper change as a completed visible journey.

Extract the existing external numeric allowlist into a shared slskd projection.
Keep its external wrapper's positive-response condition unchanged. The generic
projection also admits recorded zero responses; that count alone does not certify
provider finalization or grant new-search permission. Require known nonnegative
safe-integer response/file counts, zero candidates and valid parent/cause counts.
Drop unknown fields and supplied reason strings.

Use one focused client presenter for fixed labels and messages. Report provider
responses/files, ignored-source responses, files excluded by title, responses
missing identity and malformed files separately. Do not sum different units or
infer quality-policy rejection. Missing evidence remains unavailable. Advanced
Wanted uses the presenter without rendering raw reason-code arrays.

Add a narrow Missing Music server policy that reads only the target resolver's
authorized release. Project last successful zero-candidate ingestion for cooldown
or blocked discovery, with no newer dispatch failure or pending continuation.
Require the recorded slskd source and zero candidates/files. Hide old reasons
after readiness for a new search, active search, success or failure. A new small
inspector component labels the evidence Last recorded search and uses semantic
description lists. The worklist stays compact; existing Refresh, focus, actor/
recipient scope and mutation permissions remain the owners of behavior.

This is a read projection: no policy relaxation, automatic search, reset, new
command, migration or dependency. Prove projection/privacy/scope in cheap controls,
actual authenticated PostgreSQL reads for own/admin/disabled/unrelated targets,
and canonical plus advanced rendered units. Validate the frozen source and rebuild
the preserved local Docker stack without cache. Keep research and outcomes separate.
