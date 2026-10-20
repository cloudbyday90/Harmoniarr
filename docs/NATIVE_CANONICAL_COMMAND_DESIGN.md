# Canonical selected-match native acquisition design

October 20, 2026. Strengthen the existing opt-in native audio lane rather than
adding a second import system or repeating unchanged native inventories.
Replace selected-candidate, execution-run and ready-summary fixture writes with
the actual authenticated Missing Music detail, Use match and Start download
routes. Missing Music is the canonical surface; legacy Music Queue redirects
there. Selection and download start remain separate explicit commands.

Seed only account/wanted metadata, controlled search-result candidates and
filesystem/provider setup. Candidates begin pending. The server resolves the
actor, target and selected match; preserve sessions, CSRF, account state, own
scope, current eligibility, durable idempotency, maintenance and queue leases.
Claim the actual queued execution and await the application's configured worker
completion with its real planner and pre-provider/handoff services.

Prove refusal without side effects for missing CSRF, wrong target/match,
disabled target and requester download start. Replay successful selection and
download commands with the same keys, requiring identical results and one
selection event/queued run. Assert actor versus recipient in persisted events
and required audit. Refresh the actual detail/handoff projection.

Retain both equal-size valid/corrupt native transfers, exact receipts,
retired-producer export, actual inspection, safe auto-add/apply, scheduled scan
and catalogue/audit controls from the native audio lane. Keep narrow ESM command
and worker helpers; no production policy bypass. This is authenticated HTTP
command proof with controlled discovery inputs, not browser interaction, live
search or full audio decoding. Preserve existing fast lanes and no-cache local
walkthrough rebuild with data/admin retained.
