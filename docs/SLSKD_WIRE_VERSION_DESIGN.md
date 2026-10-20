# Stable slskd wire-version admission

Date: 2026-10-20. Follows the baseline failure found during the
[provider PR evaluation](OPEN_PR_51_SERVER_BUILDER_EVALUATION.md).

## Decision and ownership

The deployed slskd 0.26.0 image reports the JSON string 0.26.0.0 from its
authenticated application/version endpoint. The current exact download policy
accepts 0.26.0 only, so preparation refuses before a batch can be sent.

Add the exact stable wire string 0.26.0.0 to the existing pure ESM protocol
policy as batch. Keep the existing 0.26.0 and legacy 0.25.1 entries for saved
bindings and existing integrations. Preserve the exact reported version in
provider bindings and durable attempts; the two batch strings are not
interchangeable identities for an already prepared dispatch. Do not coerce,
trim, parse ranges, strip suffixes, or accept arbitrary fourth components.
Keep 0.26.1/0.26.1.0 blocked pending their separate transport qualification.

No route, schema, singleton, dependency or parallel service is needed. Existing
dispatch, beforeSend authority, endpoint/credential checks, complete manifests,
receipt identity, uncertainty handling and no-legacy-fallback rules retain
their owners. Reuse the policy consumed by saved-attempt validation.

## Validation boundaries

First reproduce refusal against the real isolated provider and the original
app image. Prove stable admission with the corrected packaged image, preserving
private-network isolation and checking actual image/version identity. Exercise
authenticated native API refusal and batch lookup without public Soulseek I/O.
These checks do not establish a successful live transfer.

Use focused adverse policy/dispatch cases for unreviewed versions, raw binding
mismatch and no POST. Use the owning PostgreSQL/controlled-HTTP batch-handoff
file for exact version persistence, successful receipts, lost response without
re-dispatch, uncertain evidence and transactional rollback. Clearly distinguish
that provider fixture from native slskd acceptance. Run the fast gate once on
stable source, then rebuild and validate the preserved local walkthrough.

See the [official research and alternatives](SLSKD_WIRE_VERSION_RESEARCH_2026_10.md)
and separate [outcome](SLSKD_WIRE_VERSION_OUTCOME.md).
