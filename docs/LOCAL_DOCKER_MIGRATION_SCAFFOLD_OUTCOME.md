# Local Docker migration scaffold rebuild

Completed October 21, 2026 using the preserved-installation path in
[LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md). An invocation-owned
BuildKit builder performed `--pull --no-cache --load`; Compose recreated the
walkthrough app with `up -d --wait --no-build`. The builder and both read-only,
network-disabled inventory containers were removed and retirement verified.

Previous image:

```text
sha256:dd6a19914a6fa3ea76aee85f284f6444d80f64436f380651a75dfbcc18ae20fd
```

Current local image:

```text
sha256:5bdf56a9b9811c22cf76bab8243a980952301ad7dc5c9b7db83236d8de6ec5bf
```

The app is healthy, read-only, Linux x64/UID 1000 and exposed only at
`127.0.0.1:47956`. Runtime remains Node 24.22.0. All five bind mount
source/destination/access records match, including the actual completed-download
host override. Existing admin/data were retained. The one-shot bootstrap helper
confirmed the existing admin and was removed.

Startup applied **zero migrations**, verified **112 applied and zero pending**.
Readiness-only browser validation passed with provider/path prerequisites
retained. Its password-only temporary file was removed and absence verified.
The existing local CSRF opt-out remains a walkthrough configuration limit.

All **872 server, 155 client and 11 shared files**, their bytes and modes match
the preceding image. Client/shared bytes also match the final local build/source.
The 110 production npm packages and 147 OS package versions match. The generator
change is an authoring tool outside the packaged application; no runtime change
or dependency upgrade is inferred from a new image digest.

No recovery was armed in this installation. No provider search, transfer, import,
fresh install, destructive reset, managed overlay, image publication or release
qualification was performed. Those optional walkthrough paths are separate from
this preserved rebuild. Generator/policy proof is recorded in the
[authoring outcome](MIGRATION_SCAFFOLD_OUTCOME.md).

Next priority is qualification and pinning of Node 24.22.1 across the development,
CI and Docker baseline. This image remains on the earlier pinned runtime and is
not evidence of that security update. See the
[official research](MIGRATION_SCAFFOLD_RESEARCH_2026_10.md) and
[design tradeoffs](MIGRATION_SCAFFOLD_DESIGN.md).
