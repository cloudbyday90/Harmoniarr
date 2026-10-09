# slskd batch handoff research

Read-only primary-source ledger, consulted 8 October 2026 America/New_York
/ 9 October UTC. Root supplied main ac4993f and the unchanged checked-in
slskd 0.25.1 deployment. This research authorizes no provider upgrade or mutation.

## Discovery and version boundaries

GitHub MCP search rediscovered [slskd/slskd](https://github.com/slskd/slskd),
repository ID 325619780, at 03:13:09 UTC. Metadata supplied release, branch,
Git-ref and tree URLs. Fresh release/tag reads at 03:13:38 and non-truncated
tree reads at 03:14:08 resolved these immutable revisions. Source reads started
03:14:26. Project/dependency discovery began at 03:19:31, with exact enum
reads at 03:20:09. Additional shutdown/traversal reads began at 03:23:36 UTC.

| Version / classification | Publication or observation | Immutable source |
| --- | --- | --- |
| [0.25.1 release](https://github.com/slskd/slskd/releases/tag/0.25.1), compatibility baseline | Published 20 April 2026 02:20:53 UTC | 7961741f740abd240754ff6e39cda6d69f727268 |
| [0.26.0 release](https://github.com/slskd/slskd/releases/tag/0.26.0), latest returned stable release | Published 19 July 2026 16:57:55 UTC | e42a525d700d6dc343f316447803138b8ea2fbe3 |
| [Current master](https://github.com/slskd/slskd/commit/f4edb6baa76bbe1465d30bd69de06d57e4d23c0c), development source | Observed 9 October 2026 03:13:55 UTC | f4edb6baa76bbe1465d30bd69de06d57e4d23c0c |

The release collection request was per_page=20, page=1; this identifies the latest
returned stable release, not every historical page. Current master shares the
0.26 controller, Batch/Transfer models, BatchService and DB context blobs, but
its request/response DTOs, download owner and application source differ.
This ledger verifies the 0.26.0 contract; it does not certify every later version.

The fresh [0.25.1 controller](https://github.com/slskd/slskd/blob/7961741f740abd240754ff6e39cda6d69f727268/src/slskd/Transfers/API/Controllers/TransfersController.cs)
and complete tag tree lack the batch endpoints/classes present in 0.26.0.
Existing 0.25.1 direct-receipt compatibility and uncertainty bounds remain in the
[earlier ledger](SLSKD_TRANSFER_CONFIRMATION_RESEARCH_2026_10.md).

## Exact request, response and lookup contract

The route owner exposes POST /api/v0/transfers/downloads/batches and
GET /api/v0/transfers/downloads/batches/{id}. POST creates the caller-ID batch
before per-file enqueue. Outcomes are 201 for no reported failure, 207 for mixed
failures, 200 when every requested file failed, 409 for a duplicate batch ID,
400 for invalid input, 429 for request throttling, 403 for relay mode, 404 for
an offline user, and 500 for other errors. GET validates the GUID and returns
the exact batch or 404. HTTP status alone does not prove admission.
[0.26 controller, lines 291–510](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Transfers/API/Controllers/TransfersController.cs).

ASP.NET uses camelCase properties and a JsonStringEnumConverter with no enum
naming policy; null properties are omitted. State flags are enum text rather
than product labels. [Serializer registration](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Program.cs)
and [standard JSON options](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Common/CommonExtensions.cs).

| Wire object | Exact relevant keys and shape |
| --- | --- |
| Request | id:string GUID optional; searchId:string GUID optional; username:required nonblank string<=500; files:nonempty array; options:optional object |
| Request file | filename:required nonblank/nontraversing string; size:required nullable long with validation 0..long.MaxValue |
| Request options | destination:optional relative/nontraversing path; externalId:optional string |
| POST response | batch:Batch; failures:array of objects with filename:string and message:string |
| GET response | Batch directly; no failures envelope |

[Request DTO](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Transfers/API/DTO/EnqueueDownloadBatchRequest.cs),
[response DTO](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Transfers/API/DTO/EnqueueDownloadBatchResponse.cs).
Source permits size 0; retaining Harmoniarr's stricter positive safe-integer
manifest rule is a deliberate application constraint.

Batch keys are id:GUID, searchId:optional GUID, username:string,
direction:Download, createdAt:DateTime, transfers:array, options:object.
It persists neither requested manifest/count nor enqueue failures or an
enqueue-finished marker. Options contain destination/externalId properties,
but the controller copies only destination from this release's input.
ExternalId is therefore not a usable caller-ID proof for this path.
[Batch model](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Transfers/Types/Batch.cs), [options model](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Transfers/Types/BatchOptions.cs).

Transfer proof fields are id:GUID, batchId:optional GUID, username:string,
direction:Download, filename:string, size:long, state:enum flags text.
Other keys are requestedAt, optional enqueuedAt/startedAt/endedAt,
bytesTransferred, averageSpeed, optional placeInQueue, optional exception
(a string, not an exception object), attempts, optional nextAttemptAt,
removed, and computed bytesRemaining/elapsedTime/percentComplete/remainingTime.
StateDescription is explicitly excluded from JSON. Id, batchId, username,
direction and filename are init-only; size/state/progress remain mutable.
[Transfer model](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Transfers/Types/Transfer.cs).

BatchService includes related transfers without a Removed filter. A persisted
batch ID is unique in that SQLite database; constraint failure maps to duplicate
refusal. The relationship uses transfer.BatchId and an optional foreign key.
Neither uniqueness nor GUID secrecy establishes cross-installation authorization
or provider-wide exactly-once execution.
[BatchService](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Transfers/Downloads/BatchService.cs),
[DB relationship](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Transfers/TransfersDbContext.cs).

## Admission versus persisted records

DownloadService skips an already active peer/file, preserving its old identity.
A newly admitted file gets a new GUID and supplied BatchId. It saves a
Queued|Locally record before scheduling the task. An intervening exception
can leave a failed same-batch record while the filename enters POST failures.
Consequently a complete GET manifest proves owned persisted records, not
necessarily the original POST's complete local task admission.

The direct Enqueued collection is filled after successful task scheduling;
remote queue acceptance and byte delivery happen asynchronously. Existing
terminal records are soft-removed when superseded. Provider retry can update
the same record's attempt count and state; its retry policy is separate from
Harmoniarr's dispatch attempt.
[DownloadService, lines 430–667 and 1350–1437](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Transfers/Downloads/DownloadService.cs).

## Verified flag vocabulary and recommended positive gate

The [0.26 project](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/slskd.csproj) pins Soulseek 10.0.2. Fresh MCP search/tag/tree
resolution binds that dependency to 94fba7d4056796af067e6d7b2a8628099723cd26.
The exact flag values are:

| Flag | Value | Flag | Value |
| --- | --- | --- | --- |
| None | 0 | Requested | 1 |
| Queued | 2 | Initializing | 4 |
| InProgress | 8 | Completed | 16 |
| Succeeded | 32 | Cancelled | 64 |
| TimedOut | 128 | Errored | 256 |
| Rejected | 512 | Aborted | 1024 |
| Locally | 2048 | Remotely | 4096 |

[TransferStates 10.0.2](https://github.com/jpdillingham/Soulseek.NET/blob/94fba7d4056796af067e6d7b2a8628099723cd26/src/TransferStates.cs). Direction is Download=0 and Upload=1,
serialized as Download/Upload by the configured converter. [Direction enum](https://github.com/jpdillingham/Soulseek.NET/blob/94fba7d4056796af067e6d7b2a8628099723cd26/src/TransferDirection.cs).

Recommendation, not a provider guarantee: parse exact known flag tokens and
require a coherent remotely queued, InProgress, or Completed+Succeeded state
for every exact manifest file in a recovered GET/operator adoption.
Reject unknown tokens/numbers, contradictory/adverse combinations, duplicates,
foreign BatchId/peer/direction, missing/subset/extra files, local-only queue,
Requested, and terminal failure. Transferring is not an enum member.
The ordinary classifier's default-to-active behavior must not authorize this gate.
A direct full POST may establish local admission from a validated empty failures
list and exact owned transfers without claiming remotely queued success.

## Retention, restart and version detection

Configured transfer pruning uses minutes and sets Removed=true; it does not
delete those rows. Exact BatchService lookup still includes them. Its inspected
API has create/find operations, not a batch deletion/expiry contract.
Do not infer rejection from 404, absence, or an incomplete batch.
[Pruning owner](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Transfers/Downloads/DownloadService.cs),
[retention configuration](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/docs/config.md).

Default storage is disk SQLite; volatile mode uses memory databases and loses
the uniqueness/history domain at shutdown. Reset/replacement of storage is
also outside persistent caller-ID guarantees.
[Storage wiring](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Program.cs), [volatile option](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Core/Options.cs).

Startup marks dangling downloads Completed|Errored with exception
'Application shut down'. Upon login it re-enqueues their peer/file/size tuples
without BatchId. Combining that call with new-transfer construction implies
new unassociated UUIDs while the old batch retains shutdown-terminal rows.
That is source-derived restart behavior, not an executed experiment. It prevents
treating shutdown errors as proof that no work continues or that another POST
is safe. [Application, lines100,360–394,1044–1073](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Application.cs).

GET /api/v0/application/version returns a JSON string of Program.SemanticVersion.
That property takes InformationalVersion before '+', stripping build metadata
while retaining prerelease text. The default build uses tag+shortSHA, so the
tagged source implies 0.26.0 as the endpoint value; custom builds may choose a
different --version. Development assembly defaults map to 0.0.0.
[Version endpoint](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Core/API/Controllers/ApplicationController.cs),
[version property](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Program.cs), [build script](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/bin/build).

Only release 0.26.0 is source-verified here for batch selection; 0.25.1 remains
legacy. A >=0.26 or future/nightly assertion exceeds this evidence. Version
text is not cryptographic proof of a binary. Swagger is optional/default false;
a 404 at an arbitrary batch ID alone cannot distinguish unsupported route from
missing batch. Capability discovery should be read-only and fail closed.

## Security and safe migration tradeoffs

Batch and version endpoints use AuthPolicy.Any; with normal configuration this
requires JWT or X-API-Key authentication. API-key validation also checks CIDR.
Disabled authentication substitutes a passthrough scheme. Batch ID lookup has
no per-Harmoniarr-user ownership predicate, so UUIDs are correlation data,
not permission grants. Destination input changes filesystem placement; omit it
unless separately intended, and preserve existing URL/key/path protections.
[Auth handler](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Common/Authentication/ApiKeyAuthentication.cs),
[key/CIDR owner](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Core/Security/SecurityService.cs), [auth wiring](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Program.cs).

| Approach | Benefit | Limit / recommendation |
| --- | --- | --- |
| Keep 0.25.1 direct receipts | Preserves supported deployment | Lost receipts remain unresolved; retain this compatibility path |
| Explicit 0.26.0 batch transport | Caller UUID gives exact lookup domain | Select before checkpoint; save transport, UUID, source and manifest privately |
| Re-POST after 409/404/subset | Appears to resolve uncertainty | Duplicate/domain loss or unfinished work remains possible; reject |
| GET/operator adoption of fully progressed exact batch | Recovers positive owned evidence without POST | Apply identical strict identity/state/current-source checks and transactional receipt owner |
| Automatically upgrade provider or infer later-version support | Broadens availability | Outside task authority/source proof; reject |

Keep a saved uncertain batch attempt on its original transport; do not silently
fall back to legacy enqueue. Do not use filenames/timestamps as causal baseline
proof. Persist direct failure evidence privately; recovered GET cannot invent it.
Retain unresolved checkpoints, current-before-POST gates and truthful review
status. Provider restart/storage/config changes remain bounded uncertainty.

## Exact shutdown, retry and traversal details

The startup marker is exactly Application shut down (Application.cs line100).
Startup sets Completed|Errored, EndedAt=UTC now and that exception on every
dangling record, including removed rows. It leaves Removed, Attempts and
NextAttemptAt unchanged. Only !Removed saved IDs are subsequently re-enqueued.
The new enqueue marks superseded old same-file records Removed=true.

StopAsync sets ShuttingDown and disconnects with the exact message Shutting down.
Signal handlers cancel the master token. The state-change callback skips persistence
during shutdown, but TryFail and synchronized catch-path writes have no equivalent
guard. Task continuations explicitly construct Task was cancelled; the dependency
explicitly wraps cancellation as Operation cancelled. Default .NET cancellation
text is runtime-generated and is not guessed here.

TryFail fills missing EndedAt/Exception, removes the first colon-delimited message
prefix, and maps cancellation/timeout/other exception to the corresponding terminal
flag. The source does not prove one universal persisted shutdown string.
Application shut down is the precise startup discriminator; other cancellation
messages are not restart-exclusive. Narrow marker suppression has that limit.
Conservative failure quarantine covers more uncertain cases.
[Dependency cancellation owner](https://github.com/jpdillingham/Soulseek.NET/blob/94fba7d4056796af067e6d7b2a8628099723cd26/src/SoulseekClient.cs).

Attempts is initialized to1 and updated during retry; the download owner does not
set NextAttemptAt. WithSoulseekTransfer retains Attempts but omits NextAttemptAt
and Removed, which take defaults. Those fields are not reliable restart markers.
[Transfer copy](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Transfers/Extensions.cs).

This restart limit also applies after a direct batch POST was already confirmed:
later original-ID shutdown-terminal observations cannot by themselves authorize
automatic failure cascading or another acquisition. GET recovery/operator adoption
uses the same positive state gate; terminal error/cancellation is not positive proof.

NonTraversingPath checks slash- and backslash-separated segments exactly equal
to . or ..; it does not reject every filename containing dots. RelativePath(All)
checks both Linux and Windows rooted-path rules. Request filename uses the former;
options.destination uses both plus its string validator. This describes the provider
validator, not complete Harmoniarr path safety.
[Traversal attribute](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Common/Validation/NonTraversingPathAttribute.cs), [relative attribute](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Common/Validation/RelativePathAttribute.cs),
[path helper](https://github.com/slskd/slskd/blob/e42a525d700d6dc343f316447803138b8ea2fbe3/src/slskd/Common/FileSafety.cs).
## Retained evidence and limits

All ignored artifacts are under .tmp/batch-handoff-2026-10/pr-applicability/.
slskd-batch-source-evidence.json SHA-256:
ac4b73fbc24fe19f5a65db323a0c9e46dbde0ec3c50ac2ee2655907678db8e65.
slskd-enum-version-evidence.json SHA-256:
976a5dba1f4fec0f3565315ea04875bf970c6123195e31295438c4679f199c6d.
slskd-shutdown-validation-evidence.json SHA-256:
49a9a900aad14052534a9b0830c748ebb2b27dfb1a986f8b4d3eb1ff916ccec9.
They retain exact query UTC, discovery/templates, tag/tree/blob identities and
complete consulted source. Official release, controller, batch, transfer,
application and dependency enum pages were also opened through the web tool.

No C# or provider execution, live version/storage probe, Soulseek contact, POST,
restart/storage-loss experiment, application/test edit, Git mutation, or external
write occurred. This is contract research, not full security review or an
external exactly-once, downloaded-byte, audio-quality, or library-add proof.
Fresh PR applicability has separate [design](OPEN_PR_APPLICABILITY_BATCH_HANDOFF_2026_10_DESIGN.md)
and [outcome](OPEN_PR_APPLICABILITY_BATCH_HANDOFF_2026_10_OUTCOME.md).
