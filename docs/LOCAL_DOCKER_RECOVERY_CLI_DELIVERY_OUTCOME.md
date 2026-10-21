# Local Docker recovery CLI delivery rebuild

Completed October 21, 2026 following the preserved-installation path in
[LOCAL_DOCKER_WALKTHROUGH.md](LOCAL_DOCKER_WALKTHROUGH.md). An invocation-owned
BuildKit builder rebuilt the pinned Dockerfile with `--pull --no-cache --load`.
The local walkthrough tag was replaced and Compose recreated the app with
`up -d --wait --no-build`. The builder and inventory/probe containers were removed
and their retirement verified.

Previous image:

```text
sha256:1018eb093f161313f940d365d93a8c33e7a31915706bddb639770c777edf1efc
```

Current local image:

```text
sha256:dd6a19914a6fa3ea76aee85f284f6444d80f64436f380651a75dfbcc18ae20fd
```

## Preserved installation

The app is healthy, read-only and bound to `127.0.0.1:47956`. Runtime remains
Linux x64, Node 24.22.0, UID 1000. All five bind mount source/destination/access
records match the previous container, including the actual completed-download
host override. Existing admin/data were retained. The one-shot bootstrap helper
confirmed the existing admin and was removed.

Startup applied **zero migrations**, verified **112 applied and zero pending**.
Readiness-only browser validation passed with provider configuration/path mapping
requirements retained. Its password-only temporary file was removed and absence
verified. The existing walkthrough CSRF opt-out remains a local configuration
limit; this is not production security qualification.

Packaged inventory is **872 server, 155 client and 11 shared files**. Exactly six
server paths changed and match the frozen source bytes:

- `cli/cli-output.js`
- `cli/cli-runtime.js`
- `cli/harmoniarrctl.js`
- `cli/recovery-command-output.js`
- `cli/recovery-command-runtime.js`
- `cli/recovery-commands.js`

All other server/shared bytes and existing file modes match. Client bytes match
both the preceding image and final local build. Production npm inventory remains
110 packages; OS inventory remains 147 package versions. No dependency update.

## Isolated Linux output proof

Separate network-disabled, read-only containers invoked the actual packaged
Node runtime and CLI modules. They did not use the installation database.

| Probe | Observed result |
| --- | --- |
| Previous writer, deliberately large benign record | Exited 3 before returning to its caller; delivered 80,640 of 4,194,305 bytes |
| Candidate writer with parent-held stdout reading | Returned a pending write with actual `writableNeedDrain=true`; after reader release delivered all 4,194,305 bytes and exited 3 |
| Candidate arm adapter with synthetic service and actual closed child stdout reader | Native EPIPE; service success retained, output failure reported, exactly one cleanup call, bounded secret-free stderr, exit 1 |
| Child process/stdio and container lifetime | Actual close/exit observed; exact probe containers retired |

The large benign payload qualifies the writer's lifecycle contract; it does not
reproduce loss of an actual small recovery JSON record. The synthetic service
in the EPIPE probe proves packaged CLI delivery behavior, not database mutation.
Actual committed-state and full CLI process tests used disposable PostgreSQL;
see the [owning outcome](RECOVERY_CLI_DELIVERY_OUTCOME.md).

No recovery was armed in the preserved installation. No provider search,
transfer, import, fresh-install/reset, managed overlay, image publication or
release qualification is claimed. The walkthrough's destructive reset and
optional strict provider/release checks do not apply to this preserved rebuild.

Next implementation follow-up is the migration scaffold copyright header;
manual screen-reader/device acceptance remains deferred. See the
[design](RECOVERY_CLI_DELIVERY_DESIGN.md) and
[official research](RECOVERY_CLI_DELIVERY_RESEARCH_2026_10.md).
