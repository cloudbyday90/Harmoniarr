# slskd transfer confirmation research

Consulted October 8, 2026, America/New_York; GitHub/web reads occurred on
October 9 UTC. This is read-only primary-source research. The root reported
Harmoniarr's README/Compose baseline as slskd 0.25.1; this subtask did not probe
a running provider or independently inspect those application files.

## Discovery and immutable versions

GitHub MCP search discovered the official [slskd repository](https://github.com/slskd/slskd),
ID `325619780`. Returned repository metadata supplied REST release, branch,
Git-ref and tree templates. Exact tag refs and complete non-truncated trees
resolved the source revisions below. Official repository/release/source pages
were also opened with the web tool. Consultation is distinct from publication.

The repository metadata query completed at `2026-10-09 01:44:14 UTC`, the
0.26.0 immutable-tree query at `01:45:27`, and the 0.25.1 tree query at
`01:49:18`. The primary source ledger completed at `01:56:04`; per-file
consultation times are retained with each response.

| Snapshot | Publication or source identity | Classification |
| --- | --- | --- |
| [0.25.1 release](https://github.com/slskd/slskd/releases/tag/0.25.1) | April 20, 2026; `7961741f740abd240754ff6e39cda6d69f727268` | Compatibility baseline reported by root |
| [0.26.0 release](https://github.com/slskd/slskd/releases/tag/0.26.0) | July 19, 2026; `e42a525d700d6dc343f316447803138b8ea2fbe3` | Latest release returned by the fresh five-item release collection; alternative API contract |
| [Master snapshot](https://github.com/slskd/slskd/tree/85ce16a71eb88134a9b3230ea832e6dc37c7c216) | `85ce16a71eb88134a9b3230ea832e6dc37c7c216`; repository last pushed October 7 | Development source, separate from released behavior |

Controller, persisted transfer model and batch-service blobs match between
0.26.0 and that master snapshot. Some request/response DTO and download-service
blobs differ; release behavior was read directly, not inferred from master.
The MCP paginated tags-collection URL was rejected by its allowlist; exact
tag-ref resources resolved successfully. No claim covers every later release.

## Baseline 0.25.1 contract

| Primary source | Observed contract |
| --- | --- |
| [Transfers controller](https://github.com/slskd/slskd/blob/7961741f740abd240754ff6e39cda6d69f727268/src/slskd/Transfers/API/Controllers/TransfersController.cs) | Lines 222–258: `POST /api/v0/transfers/downloads/{username}` returns 201 with `enqueued` and `failed`. Lines 339–362: exact receipt GET parses a UUID and queries its ID; its route username is not a lookup predicate. Validate the returned body identity. Global downloads GET accepts `includeRemoved`; username-only GET does not. |
| [Request DTO](https://github.com/slskd/slskd/blob/7961741f740abd240754ff6e39cda6d69f727268/src/slskd/Transfers/API/DTO/QueueDownloadRequest.cs) | Request items carry filename and size. The inspected legacy handler exposes no caller attempt or idempotency identifier. |
| [Download service](https://github.com/slskd/slskd/blob/7961741f740abd240754ff6e39cda6d69f727268/src/slskd/Transfers/Downloads/DownloadService.cs) | Lines 392–450: admitted requests get fresh GUIDs; active same-user/file transfers are skipped, while terminal predecessors are soft-removed. Lines 603–604: the response list records local admission of a scheduled task. It does not establish remote-peer acceptance, completion or delivered bytes. |
| [Persisted transfer](https://github.com/slskd/slskd/blob/7961741f740abd240754ff6e39cda6d69f727268/src/slskd/Transfers/Types/Transfer.cs) and [directory response](https://github.com/slskd/slskd/blob/7961741f740abd240754ff6e39cda6d69f727268/src/slskd/Transfers/API/DTO/DirectoryResponse.cs) | Returned files use the persisted transfer GUID model. An older API DTO computes a filename SHA-1 ID, but that is not the model returned by the actual list/POST code. The model includes username, direction, filename, size and request/queue/start/end timestamps. |

An explicit response receipt can establish which slskd intent this command
created. Match it to the private requested manifest and persist that association
durably. Current state remains a separate observation. Filename/size equality,
timestamps or disappearance from an earlier listing do not establish command
causality when its response was lost.

The baseline [HTTP serializer setup](https://github.com/slskd/slskd/blob/7961741f740abd240754ff6e39cda6d69f727268/src/slskd/Program.cs#L973)
uses `JsonStringEnumConverter()` without an enum naming policy, emitting
`Download`/`Upload`. The baseline project pins Soulseek 10.0.0; its discovered
immutable [TransferDirection enum](https://github.com/jpdillingham/Soulseek.NET/blob/92874fae786bc30108cb03cbf5d38dd14895699f/src/TransferDirection.cs)
defines Download as 0 and Upload as 1. Accepting lowercase text or numeric 0
would be a separate compatibility choice. This slice requires the emitted
`Download` value when direction is present, while tolerating omission at existing
seams. Explicit other values must not prove admission.

## Retention and restart limits

[Program storage configuration](https://github.com/slskd/slskd/blob/7961741f740abd240754ff6e39cda6d69f727268/src/slskd/Program.cs)
uses disk-backed SQLite by default; volatile mode uses in-memory SQLite.
[Options](https://github.com/slskd/slskd/blob/7961741f740abd240754ff6e39cda6d69f727268/src/slskd/Core/Options.cs)
defaults volatile mode to false and warns that volatile data is lost at shutdown.
Configured download-retention pruning soft-marks completed rows removed, using
minutes; the download service's pruning comment incorrectly says hours. Exact
ID lookup does not filter removed rows. Storage reset/loss can still erase them.
Absence or 404 cannot prove that a request was never admitted.
The username-list API cannot include removed rows. New attempt-owned missing or
subset live observations remain pending rather than causing orphan recovery or
a new POST; preexisting confirmed legacy grace behavior is a separate compatibility
boundary. Exact known-UUID detail lookup is a possible later improvement.

[Application startup](https://github.com/slskd/slskd/blob/7961741f740abd240754ff6e39cda6d69f727268/src/slskd/Application.cs),
lines 359–367 and 1038–1054, marks dangling records errored and re-enqueues
their file tuples after login. Combined with fresh GUID creation, this implies
a resumed provider transfer can have a different ID without a public causal
link to its predecessor. This is source-derived inference, not an executed
restart experiment. Do not follow that replacement by filename alone.

## Alternative 0.26.0 batch API

The [released controller](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Transfers/API/Controllers/TransfersController.cs)
adds `POST /api/v0/transfers/downloads/batches` and exact
`GET /api/v0/transfers/downloads/batches/{id}`. Its
[request DTO](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Transfers/API/DTO/EnqueueDownloadBatchRequest.cs)
allows a caller UUID, optional search UUID, username and file manifest.
Duplicate batch UUID creation returns 409 before another enqueue. The batch
record is created before per-file processing: 201 reports no enqueue failures,
207 partial failures and 200 all failed. Batch existence alone proves neither
complete admission nor delivery.

[Batch lookup](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Transfers/Downloads/BatchService.cs)
includes associated transfers through their persisted foreign key.
[Transfer.BatchId](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Transfers/Types/Transfer.cs)
is assigned at creation and is init-only. Existing active transfers are skipped,
not reassigned to a new batch. The [batch model](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Transfers/Types/Batch.cs)
does not persist the original manifest or the POST's separate failure list.
An incomplete lookup may reflect partial processing; retain uncertainty unless
per-file ownership and state account for the exact local manifest.

The authenticated [application version endpoint](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Core/API/Controllers/ApplicationController.cs)
returns the semantic version at `GET /api/v0/application/version`. Swagger is
optional and disabled by default. `BatchId` already appears in the 0.25.1
transfer model, so that field's presence does not demonstrate batch API support.

## Decision and retained evidence

Keep 0.25.1 compatibility for this slice. Persist a private local attempt UUID,
exact manifest and explicit direct-response receipt identities. Legacy outcomes
without durable receipts remain unresolved; do not confirm from baseline/history
matching or resend automatically. A caller-ID batch migration is a separate
version/capability decision with per-file verification and executed evidence.

Ignored source/discovery responses are retained in
`.tmp/transfer-confirmation-2026-10/pr-applicability/slskd-source-evidence.json`,
SHA-256 `b797c241583e66fa4b4d2b8366b0ad1b5bab2c0254159f743da706e93da8f66d`.
Its per-request UTC timestamps, returned URLs, tag/tree/blob identities and
complete consulted files bind this source study. PR applicability has separate
[design](OPEN_PR_APPLICABILITY_TRANSFER_CONFIRMATION_2026_10_DESIGN.md) and
[outcome](OPEN_PR_APPLICABILITY_TRANSFER_CONFIRMATION_2026_10_OUTCOME.md).
The baseline directory-response type was additionally read at
`2026-10-09 01:58:43 UTC`; `slskd-baseline-directory-evidence.json` in the same
ignored directory has SHA-256
`fbbe117a382f286dfe22aa045f50fe530be66ec5d03a9bd4dc516468614f4608`.
Serializer and Soulseek 10.0.0 enum discovery is additionally retained in
`slskd-direction-evidence.json`, SHA-256
`188c7630f20bb2d9e130ea35eea715c93265432c154712b251cc39a53ff2b8ff`.

No C# execution, provider/Soulseek contact, live deployment version/storage probe,
restart test, batch POST, transfer mutation or provider exactly-once proof was
performed. Source research does not establish downloaded byte identity or audio
quality. It does not authorize a provider upgrade or a legacy receipt backfill.
