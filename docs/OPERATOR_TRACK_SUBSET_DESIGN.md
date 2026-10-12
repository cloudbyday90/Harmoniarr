# Exact single-track acquisition design

Accepted October 12, 2026. This follows the
[catalog safety boundary](OPERATOR_TRACK_CATALOG_DESIGN.md). The first supported
proper subset is one catalog track on medium one, requested from a larger release.

## Decision and boundaries

Use the existing request, Wanted, candidate, operation-run and import systems.
Keep the complete catalog and candidate file inventory; derive a restricted file
manifest instead of treating the folder as the granted object. Whole-release
behavior continues through its existing checks. Unsupported multi-track/disc
subsets and incompatible shared participants retain a bounded refusal.

The file policy requires a unique numbered audio filename with the exact catalog
title, position, positive size, unlocked state and advertised duration within two
seconds. Its raw provider path must agree with its stored folder and filename.
This is a search/file binding, not proof of the recording's audio content.
The first slice requires a source request and recipient; a source-less Wanted
requirement cannot begin subset discovery or selection without a delivery owner.

Discovery searches the selected title and scores against one expected track.
Preview and execution filter to the selected file; artwork and sibling files are
excluded. Selection rechecks persisted requirements and current monitoring,
account eligibility, overrides and catalog membership. Preparation, attempt
staging and final provider admission compare the exact filename/size manifest on
the transaction's existing queryable. A legacy candidate without typed context
cannot inherit subset permission from a request.

Import validates actual ffprobe output: one audio stream, no video, exact release
and recording MBIDs, disc/track positions, title and measured duration. It probes
again before each stage/finalize mutation and verifies the resulting library file.
The destination fingerprint must remain unchanged across the final probe. A
successful file operation carries its verified catalog track and SHA-256/size.
Restart-confirmed finalize plans remain unsupported for subsets in this slice.

The applied transition rechecks current requirements and saves the owner/request/
scope/file receipt with candidate status and its required event in one transaction.
An applied candidate alone cannot fulfill a selected-track request. Receipt
scope and recipient must match exactly; another person or sibling requirement
stays under review. Wanted checks the receipt against current file bytes and
current scope. Missing/replaced files restore the requirement. Identical shared
subsets may share search requirements, but this receipt fulfills only the source
recipient; there is no implicit second-person delivery grant.

## Modular ownership

- `operator-track-file-policy.js`: supported selection, manifest/media predicates
  and owner-specific receipt matching.
- `operator-track-acquisition-store.js`: current consent, release MBID, candidate
  files and receipt persistence/reads; parameterized SQL only.
- `operator-track-file-evidence-service.js`: streaming fingerprint collection.
- `operator-track-fulfillment-service.js`: verified receipt validation/persistence
  inside the applied transition's existing transaction.
- Existing scope verifier and service/worker adapters: current authority and
  actual provider/filesystem execution.
- Existing media-request fulfillment and Wanted readers: owner-specific outcome.

No schema migration, browser control, CommonJS module or new worker is needed.
Existing quality, path containment, provider provenance, lease, cancellation and
maintenance boundaries remain independently required.

## Alternatives and tradeoffs

| Option | Advantages | Costs / limitations | Decision |
| --- | --- | --- | --- |
| Keep all subsets blocked | Smallest behavior and no broader grant | Cannot acquire an intentionally selected track | Retain for unsupported cases |
| Grant a scored folder | Easy reuse of album pipeline | Sibling downloads/imports and coarse fulfillment violate scope | Reject |
| Exact single-track manifest plus media/receipt checks | Positive useful slice, auditable owner outcome, narrow ESM modules | Strict tags/naming can refuse legitimate files; extra probes/hashes | Implement |
| General shared union with track-MBID persistence | Multi-disc/multi-owner flexibility | Requires migration/remapping, per-owner delivery and recovery design | Next design slice |

## Evidence and limits

Global release reconciliation counts cannot satisfy a typed subset for a person.
Planning and Wanted retain that requirement until its exact owner receipt and
current file bytes satisfy it; whole-release availability keeps its existing
semantics. The native case starts with global complete counts and still requires
the selected track's owned delivery.

Use a two-track native catalog and real saved override/request. Prove current
selection, exact manifest, changed-consent refusal, real ffprobe and exclusive file
apply, durable owner receipt, untouched sibling, wrong-recording refusal and
replaced-file Wanted restoration. A completed execution-worker fixture must
prove its actual provider call contains only the requested file. Preserve
incompatible participants and explicit null markers; do not broaden bounds or
skip failing native cases.

Embedded MBIDs are metadata claims, not acoustic fingerprint identification.
Privileged local filesystem/database edits are outside the untrusted-browser
boundary. File and SQL checks do not create a cross-system atomic transaction:
a late cancellation/change can leave imported files while receipt publication
refuses. Existing exclusive path mutation handles collisions; receipt checks
prevent claiming successful fulfillment after a refused publication.

Receipt reads stream file bytes during Wanted reconciliation. This has an I/O
cost and currently scans applied JSON receipts; a typed indexed receipt store
with scan-owned invalidation is a follow-up optimization, not a reason to weaken
identity checks. Subset download-adoption/origin-resolution still conservatively
refuses a folder inventory that differs from its original single-file manifest.

The [research](OPERATOR_TRACK_SUBSET_RESEARCH_2026_10.md) owns primary-source
applicability; the [outcome](OPERATOR_TRACK_SUBSET_OUTCOME.md) owns executed gates.
