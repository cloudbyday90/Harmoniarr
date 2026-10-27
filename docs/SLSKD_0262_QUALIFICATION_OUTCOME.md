# slskd 0.26.2 local qualification outcome

October 27, 2026. PR #57 is implemented locally without merging, with exact
`0.26.2.0` batch-wire support and the managed Compose example updated to 0.26.2.
Other unreviewed version forms remain refused.

Provider image pulled from the proposed tag:
`sha256:d0963a3e5b16facd295bf4f2156dad0182f246b1b21a032cae12f5494c694843`.

All six selected native lanes passed on the immutable application image
`sha256:cca7078e92f9534de4f5f3d66d5eff2902a489e01bec1a212f79f33049adaa8d`:

| Lane | Observed result |
| --- | --- |
| Batch | Direct and completed-response-loss cases retain one application POST and exact receipts |
| Completed files | Both cases succeed with exact deterministic bytes/file identity and one POST |
| Partial EOF/reset | Control succeeds; EOF/reset retain only incomplete prefixes and fail conservatively |
| Resume | EOF/reset complete on two native attempts, preserving one application POST and receipt identity |
| Permanent refusal | Exhaustion fails after three native attempts; changed size aborts after two; partial bytes remain incomplete and recovery stays unknown |
| Audio import | Two declared files traverse canonical discovery/commands, real native transfer, inspection and library publication |

Every owned fixture/project acknowledged process/socket closure and verified
container/network/volume absence before deleting its temporary files and secrets.
Internal-only networks, no published ports, UID 1000, read-only roots and bounded
CPU/memory/PIDs were inspected by the existing fixture.

The first attempt exposed 403 on the fixture's old `/server` readiness read.
Production uses the permitted `/application` summary, so fixture readiness now
matches it. Restricted-key calls to server/options/debug remain refused. The
partial/recovery/audio lanes use a separate temporary administrator observer only
for fixed GET `options` and `debug/transfers` reads. Search/download clients retain
the original readwrite key, and production managed credentials are unchanged.
Observer path projection/refusal and original Error/null behavior have focused
coverage. The upstream [access change](https://github.com/slskd/slskd/pull/1905)
supports this separation; no memory-dump setting is enabled.

The initial refusal fixture observed an attempt-level failure before native retry
queued. It now requires the configured final attempt plus a fresh bound failure
with unchanged identity before claiming permanent refusal. Existing deadlines,
partial-byte checks, unknown recovery and one-POST assertions remain intact;
the corrected native lane passed. This is fixture evidence of final exhaustion,
not a general change to production transient-state classification.

Batch/files/partial/resume source (3,700 files):
`af0e67104000f513c3eafba4ad878c6d80a1f1821e9e44848cdeb7b84fda8206`.
Final refusal/audio source (same file count):
`fea8d22af08874f3bbaa5fed9212c875f95235672335d5582960709b498246c6`.
Only `native-refusal-client.js` changed between these captures. The four earlier
lanes are retained after exact owning-source review; final refusal/audio were
executed on the final capture. Application/provider images and production code
are identical across both. Failed attempts remain separate private evidence.

The existing three-minute timeout/debug lane was not rerun for this version and
does not establish 0.26.2 timeout behavior. No memory dump option or broader
production API role is enabled. No live external account or operator download
tree is part of these disposable local tests.

See [qualification design](SLSKD_0262_QUALIFICATION_DESIGN.md) and
[pool/session outcome](POOL_SESSION_ADMISSION_OUTCOME.md).
