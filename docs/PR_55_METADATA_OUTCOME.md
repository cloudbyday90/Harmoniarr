# PR 55 metadata parser outcome

October 26, 2026. [PR #55](https://github.com/cloudbyday90/Harmoniarr/pull/55)
was the sole open candidate returned by GitHub MCP. A recorded
`node:crypto.randomInt` selection from `[55]` selected it. Its exact two-file
package/lockfile patch applied cleanly on `main`, with a successful reverse check.
The provider PR was not merged, closed or rebased. Final MCP review found it open,
mergeable and unmerged; this fresh applicable PR did not need stale-PR cleanup.

Reviewed base: `593144721d60d1efe18be678150e7351770e5f1b`.
Reviewed head: `32ab447a298a5ca6af2bdfdcb3bd593fa313c0a3`.

The patch raises music-metadata to 12.2.3 and its resolved strtok3 to 10.6.2.
Upstream notes cover tokenizer bounds/allocation and container/tag boundary
handling. See [official-source research](BACKUP_HANDLE_CLOSE_RESEARCH.md).
Benefits are parser correctness and maintained input handling; risks are changed
tag extraction or allocations on real media. The recommendation is the exact
reviewed PR versions with adapter and guarded-scan qualification. Newer upstream
releases are separate work; a patch label or clean audit alone is insufficient.

`npm ci --ignore-scripts --no-fund --no-audit` passes, as does a subsequent npm
audit with zero advisories at observation time. The full bounded gate passes
11,230 tests, lint, repository checks and build. The no-cache image inventory
confirms these are the only two changed runtime npm package versions.

The new native entry asserts actual packaged parser/tokenizer versions and
generates stereo 48 kHz FLAC, MP3, Opus, WAV and M4A/AAC. The production parser
and tag projection preserve artist, album, title, duration/channel/sample-rate
facts and source hashes. Its snapshot-writer callback is controlled; this entry
does not claim database persistence. A separate existing workload scans 64 files
across FLAC/MP3/Opus/WAV and persists all tag snapshots through real guarded SQL,
completing runs and releasing leases under the 3 GiB profile.

The first preflight failed because its test expected header-only `fLaC` bytes to
fail extraction. Actual parser behavior is extracted empty metadata. The corrected
test asserts that precise result and absent audio facts, then uses unsupported
non-container bytes to verify the adapter's failed result and null tag payload.
Both inputs remain unchanged. The failed log and retired-container evidence are
retained alongside the corrected preflight and final-image pass; no allowance for
arbitrary parser errors was introduced. Metadata extraction does not prove audio
playability or general malformed-input rejection.

Native codec hashes are unchanged, but parser-sensitive prior memory results are
historical for this version. The current guarded media run provides new scoped
evidence; unrelated exact-runtime proof is retained as described in the
[owning outcome](BACKUP_HANDLE_CLOSE_OUTCOME.md). No application version, schema,
release or provider transfer changes are included.
