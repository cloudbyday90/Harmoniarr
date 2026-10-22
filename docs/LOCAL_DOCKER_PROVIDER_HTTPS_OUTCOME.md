# Local Docker provider HTTPS outcome

Completed October 21, 2026 following the preserved-data flow in
[the walkthrough](LOCAL_DOCKER_WALKTHROUGH.md). Native provider HTTPS evidence is
recorded separately in [the owning outcome](PROVIDER_HTTPS_OUTCOME.md).

## Build and installation

A unique invocation-owned BuildKit builder performed `--pull --no-cache --load`
from the existing pinned Dockerfile. Its removal and absence were verified.
Compose then ran `up -d --wait --no-build` and the explicit disposable bootstrap
helper. No reset, data deletion, new deployment topology or release was involved.

Previous image:

```text
sha256:de1675ac7882d8684a667afa11872c162cae3e61904f9fa5717b30a54f0ca66c
```

Qualified current image:

```text
sha256:ee765700649188011314006b63e4478af781dcfc2619f0bc0b61543e9736306e
```

The existing installation is healthy, read-only, UID 1000, Linux amd64, exposed
only at `127.0.0.1:47956`. All five bind mount source/destination/access records
match before and after recreation, including the existing host completed-download
override. Existing admin/data remain. Bootstrap confirmed the existing admin,
exited successfully and left no helper container.

Startup applied **0 migrations**, verified **112 applied**, and reported
**0 pending**. The configured provider/path readiness-only browser command
passed. Its password-only temporary file was removed and absence verified.
Readiness can read configured provider status; it does not establish a search,
transfer, import or recovery result. Existing CSRF configuration was preserved.

## Artifact and runtime proof

Before/after inventory containers were retired. Across 872 packaged server,
155 client and 11 shared files, the only changed runtime file is
`integrations/providers/provider-json-request-service.js`, matching the tested
source hash. Other runtime file bytes/modes remain identical. Client files match
the final local build, and shared files match source.

Node **24.22.1**, npm **12.0.2**, OpenSSL **3.5.9**, bundled Undici **7.30.1**
and the actual Node executable hash remain unchanged. Root package/lock metadata,
110 production npm package versions and 147 OS package versions also match.
No runtime/test CA or environment proxy configuration was added to the deployment.

A separate read-only, network-none, UID-1000 container imported the actual
packaged service. Its malformed-URL probe produced only the approved provider
diagnostic, without input, cause or synthetic sentinel. Default TLS verification
remained enabled. Exact container removal and absence were verified.

The eight native HTTPS tests also passed in a separately bounded, network-none
Node-base Linux container. They use loopback fixtures and child-local trust;
this packaged-service probe and the preserved-installation readiness check own
different claims. A new fresh-install, backup/restore, full release matrix,
arm64 or live-provider qualification was not required for this diagnostic fix.

Private build, runtime, mount, readiness and cleanup evidence remains under
`.tmp/provider-https-2026-10-21`. The source fingerprint matches the owning
outcome throughout the final fast gate and image qualification.
