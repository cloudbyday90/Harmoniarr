# Artwork corpus qualification outcome

Completed October 22, 2026 on `main`. See the separate
[design](ARTWORK_CORPUS_DESIGN.md), [official research and tradeoffs](ARTWORK_CORPUS_RESEARCH.md)
and [local rebuild outcome](LOCAL_DOCKER_ARTWORK_CORPUS_OUTCOME.md).

## Delivered

Added a repeatable seven-case native artwork corpus, bounded streaming PNG fixture
generation, a shared test-only cgroup profile helper and the explicit
`validate:native-artwork-corpus` npm command. The existing three-case allocation/
concurrent-byte lane now uses that helper. All new code is ESM and stays in small
fixture/test modules. No application decoder, memory limit, queue, deadline,
publication policy, dependency version or database schema changed.

The standards/testing skills now cover real sample-depth evidence, canonical
eight-bit comparisons, bounded large fixtures and efficient native-lane selection.

## Native evidence

The final packaged npm command passed all **seven cases**, zero skipped/cancelled,
in a one-CPU/1 GiB/no-additional-swap/96-PID Linux amd64 container. Network was
disabled, root read-only, UID 1000 and test storage disposable. Inputs were generated
serially. Actual native metadata established depth/channels and PNG sample bits.

| Input | Input bytes | Output bytes | Child maximum RSS, KiB |
| --- | ---: | ---: | ---: |
| 1024² RGB8 PNG noise | 3,147,780 | 3,152,404 | 84,804 |
| 1024² RGBA8 PNG noise | 4,196,676 | 4,202,836 | 92,844 |
| 1024² grayscale16 PNG noise | 2,098,884 | 1,522,081 | 81,404 |
| 1024² RGBA16 PNG noise | 8,392,260 | 4,202,836 | 99,788 |
| 1024² JPEG noise with synthetic EXIF | 864,667 | 1,054,674 | 86,264 |
| 512² WebP noise | 219,904 | 206,328 | 78,640 |
| 8192² RGBA16 PNG pattern | 8,184,332 | Capacity refusal | Not sampled |

Each accepted child verified the actual **1 GiB DATA soft/hard limit** and retired
before the result reached parent publication. Stored output/source checksums,
format, dimensions and alpha expectations matched. PNG outputs remained identical
to their inputs' decoded eight-bit pixel projection. This confirms the existing
eight-bit rewrite behavior; it does not retain full 16-bit precision. The real
EXIF-bearing JPEG produced an output without EXIF. No private media was required.

The large 16-bit pattern was a valid PNG below the compressed input limit. The
actual production worker returned owned `artwork_worker_memory` 503, with no
publication lookup, repository write or stored file. Its compressed size does
not describe the potential decoded allocation. All child PIDs retired and kernel
OOM-kill counts remained zero. No raw native errors or input pixels were projected
into diagnostic records.

The whole corpus container peak was **158,810,112 bytes**, including fixture
generation, the npm/test parent, prior cases and children. It is a different scope
from child maximum RSS and is not production sizing or a worst-case bound. Timings
were observations only; no deadline was enlarged and no time-based assertion was
added. Noise here is deterministic incompressible data, not cryptographic entropy
or reproduced malicious-image complexity.

The existing **three-case memory lane** also passed after the helper extraction,
under its distinct two-CPU/3 GiB profile. It retained real external allocation
refusal after valid output, zero publication, successful subsequent work, paired
maximum-byte publication and combined-byte/pixel capacity refusal.

## Validation scope and artifact comparison

Scoped lint, ESM, copyright, test hygiene and Node-baseline checks passed. Hygiene
covered 1,396 files and copyright checked 1,585 files. Both skill validators passed.
The packaged default-ingestion probe passed with parent input loaders blocked,
exact stored hash, actual worker/limiter arguments, minimal environment, successful
child close, early-cancel refusal and a PIE Node executable.

The no-cache image comparison found **all 898 server files, 11 shared files and
155 client artifacts unchanged**, alongside unchanged Node, 110 production npm
packages and 151 APK versions. Only the root package script metadata changed.
This supports focused native validation: no unrelated full server/client/SQL
matrix was rerun or claimed for this fixture-only change.

Four changed/new JS files were frozen. Final source fingerprint, 3,326 files:
`373a82a439f2369057a2097243268bd59f930b96f2dacaf1eebf5cac26f6de8a`.
Private evidence is retained under ignored `.tmp/artwork-corpus-2026-10-22/`.
An initial corpus probe preceded the synthetic EXIF addition. The final packaged
npm run passed all seven cases, but its private capture wrapper expected TAP while
npm selected the spec reporter. The adapter was corrected against the retained
actual seven-pass log without repeating those passed cases. This was a reporting
adapter failure, not a native test failure. Temporary containers and the fresh
builder were removed with absence checked.

GitHub MCP found no open PRs at selection/completion, so random local PR evaluation
and stale-PR cleanup were inapplicable. No release, tag, version bump, additional
deployed service or branch was created.

## Recommendation and next item

Retain the current layered memory policy and run this explicit corpus when changing
decoder policy, dependencies or sample-depth handling. It adds diverse evidence
without slowing every routine test invocation. Costs are an extra opt-in native
lane and synthetic coverage that cannot represent every real image.

Keep the qualified 1 GiB DATA ceiling: these moderate-image RSS values do not
replace the preceding maximum-JPEG allocation evidence. **Next: implement staged
aggregate reservations in the existing admission owner**, starting with a bounded
metadata/grant protocol and parent-retained-buffer accounting. Hold reservations
through actual close/publication, retain fixed resource failures, and prove
cancellation/timeout/late-result behavior before changing concurrency. Free-memory
sampling may support that policy but cannot be its reservation authority.

## Repeat the corpus

After the documented local build, run from the repository root in PowerShell:

```powershell
docker run --rm --network none --read-only --cap-drop ALL `
  --security-opt no-new-privileges:true --user 1000:1000 `
  --cpus 1 --pids-limit 96 --memory 1024m --memory-swap 1024m `
  --tmpfs /tmp:rw,nosuid,nodev,size=16m --workdir /app `
  --mount "type=bind,source=$($PWD.Path)/src/server,target=/app/src/server,readonly" `
  --mount "type=bind,source=$($PWD.Path)/src/shared,target=/app/src/shared,readonly" `
  --mount "type=bind,source=$($PWD.Path)/testing/server,target=/app/testing/server,readonly" `
  --mount "type=bind,source=$($PWD.Path)/test/native/artwork-worker-corpus.test.js,target=/app/test/native/artwork-worker-corpus.test.js,readonly" `
  --entrypoint npm harmoniarr:walkthrough-local run validate:native-artwork-corpus
```

The explicit kernel profile is required; missing controls refuse qualification.
No walkthrough data, provider account or downloaded media is mounted.
