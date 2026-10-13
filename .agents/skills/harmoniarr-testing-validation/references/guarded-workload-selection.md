# Guarded workload selection and failure evidence

Use this reference for Wanted workload collection or a timeout diagnosis, not
ordinary styling/unit changes. Start from the actual CLI policy and benchmark
owners; do not use a selected measurement as a replacement for correctness tests.

Verify local ffmpeg/ffprobe or an existing owned media image before PostgreSQL
work. Capture its immutable identity/tool version and scope/restore the image
environment. Missing tooling is a prerequisite failure, not a database diagnosis.

`scripts/measure-wanted-guarded-workload.js` keeps the full default matrix.
For a smallest source comparison, use `--source-noops --profiles sine --bindings 2
--pairs 1`; for a failed largest noise case, select `--profiles noise --bindings 8
--pairs 1`. Supply `--expose-gc` and `--output <local JSON>`. Do not enlarge
dimensions, pool limits, checkout/scenario deadlines or scheduling to get green.

Version-two artifacts record full/selected scope, expected sample membership,
partial summaries, safe failure class/code/frames and the last approved
distinct-binding phase checkpoint. Await returned checkpoint sinks; diagnostic
failures must not replace benchmark work. A phase locates the current operation,
not its root cause. Server readiness and a replacement query are separate from
the original client's failure. Node TimeoutError is an approved timeout label;
messages, assertion payloads and private connection/source data remain excluded.

Retain Error/null, cleanup completion and every exact private result/durable/
digest comparison. Do not publish a lone unmatched sample if its comparator
failed. Keep historical, prerequisite-failed, full-replay and selected-native
collections separate. Work counts are structural; local timing/memory is
descriptive. See `docs/WANTED_WORKLOAD_REPLAY_OUTCOME.md` and its research/design;
the Wanted publication proposal still needs all-writer/absence proof.
