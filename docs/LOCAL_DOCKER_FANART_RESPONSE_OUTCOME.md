# Local Docker Fanart.tv response outcome

Completed October 22, 2026 following the preserved-data path in
[the walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). Fanart.tv transport evidence is
owned by [the separate outcome](FANART_RESPONSE_OUTCOME.md).

## Build and retained state

An invocation-owned BuildKit builder performed `--pull --no-cache --load` using
the existing pinned Dockerfile and local walkthrough tag. The builder was removed
and absence verified. The first artifact comparison stopped before replacing the
running service because Alpine supplied a newer OS Brotli package. That failure
was retained and the exact update qualified before resuming the same built image;
the comparison now admits only that reviewed package substitution.

Previous image:

```text
sha256:60e15109e966955944cf1235ecc4c2c82cc1fc2639979947a625b82cecbc4029
```

Qualified current image:

```text
sha256:61f1bd92664c072284f09bb0374578cbbf7955874562fa7385febbb72bcb9fde
```

Compose ran `up -d --wait --no-build`, followed by the disposable bootstrap
helper. All five bind mount source/destination/access records, completed-download
override and existing admin/data were preserved. The app is healthy, read-only,
Linux amd64, UID 1000 and bound only to `127.0.0.1:47956`. Bootstrap confirmed the
existing admin and left no helper container. Startup applied **0 migrations**,
verified **112 applied**, and reported **0 pending**. Configured provider/path
readiness-only browser validation passed. Its password-only temporary file was
removed and absence verified. Existing provider/CSRF settings remained in place.

## Runtime qualification

Exactly three of 878 packaged server files are new/changed: the Fanart.tv client,
request policy and request service. Their bytes match tested source. All other
existing server/shared bytes and modes match the preceding image. All 155 client
artifacts and 11 shared files remain unchanged and match the final build/source.
Inventory containers were retired.

Node **24.22.1**, npm **12.0.2**, OpenSSL **3.5.9**, Undici **7.30.1**, the actual
Node executable hash, root package/lock bytes and all 110 production npm package
versions remain unchanged. Of 147 OS packages, only **brotli-libs 1.2.0-r0 →
1.2.1-r0** changed. The [research](FANART_RESPONSE_RESEARCH_2026_10.md) records
official package/release/source verification for this security update.

The actual image's reverse dependencies and dynamic loader output identify
FreeType and libjxl as consumers of the OS shared libraries. Node's bundled
Brotli remains a separate copy: its version string is still 1.2.0, while the
official Node 24.22.1 release explicitly records the security backport. Its
executable SHA-256 remains
`569128f3066ac7be59b10b9a0adef708def642ee37cbf9d560a9bdb68f872108`.

Exact common/encoder/decoder libraries were extracted from immutable old/new
images and hashed. Independent disposable processes loaded each set and verified
native versions, a 48,128-byte encode/decode round trip and malformed-input
refusal. The new library exposes `_ERROR_FORMAT_BLOCK_SWITCH` for reviewed code
-17; the preceding library reports INVALID. Initial probe assertions used the
wrong code/string and were corrected against official decode.h. Failed evidence
was retained; every owned extraction/tooling container was removed and absence
verified. Python tooling existed only in disposable containers, not the image or
project dependencies. No CVE exploit reproduction is claimed.

A separate read-only, network-none, resource-limited container ran the candidate
image's actual FFmpeg/libjxl encoder and decoder. A synthetic 16×16 RGB frame
round-tripped losslessly (768 raw bytes, 410 encoded). This is codec compatibility
evidence, not proof of every Brotli metadata path or FreeType/WOFF2 behavior.
The exact container was removed and absence verified.

Another isolated container imported the actual packaged Fanart.tv client/policy/
request service and proved sanitized transport failures, oversized JSON refusal,
preserved image selection and timer-overflow deferral. Default TLS remained
enabled and cleanup was verified. The separate **17-test Linux lane** exercised
real loopback HTTPS with child-local trust/proxy state and no remote accounts.

Readiness establishes configured provider/path usability, not successful saved-key
Fanart.tv delivery or a new search/download/import. No data reset, volume deletion,
release, tag or registry publication occurred. No unrelated full-release or
backup/restore matrix was repeated. Private artifact, package, build, native,
readiness and retirement evidence is in `.tmp/fanart-response-2026-10-22`.
