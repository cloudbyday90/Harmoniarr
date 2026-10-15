# Media API scale research — October 14, 2026

Sources were discovered through connected search/GitHub MCP and opened or
fetched. Live host checks found Node 24.18.1 and Docker Engine 29.8.2/API 1.56.
Only Docker Desktop's WSL distribution is installed; its CLI explicitly refuses
direct use from that managed distribution. No extra distribution was installed.
The native proof therefore uses Linux Node in a trusted local container.

Docker documents that bind sources belong to the daemon host, not the client.
The proof mounts the daemon's Unix socket into a separate runner and privately
matches its native CLI/API daemon against the host target. It does not pretend
that a Linux container's arbitrary filesystem paths are daemon-host paths.
This is vendor API/runtime guidance, not an authorization grant.
[Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/),
[Engine API](https://docs.docker.com/reference/api/engine/)

Docker documents named image build contexts. The fixture copies an existing CLI
binary into the existing media runtime through reviewed image references. An
initial attempt to use CLI configuration IDs directly in `FROM` was rejected by
BuildKit as repository references; the corrected named-context build succeeded.
The failure is retained separately from native proof. No dependency installation
or application-image publication is needed.
[Buildx build contexts](https://docs.docker.com/reference/cli/docker/buildx/build/)

Docker daemon access carries privileged authority. A read-only socket mount
restricts filesystem writes, not API methods. The runner receives trusted
minimal project code/input, no host credentials, no network, dropped capabilities
and no-new-privileges, then is stopped/verified/removed. These controls limit its
surroundings; they do not create read-only daemon credentials or an untrusted-code
sandbox. Production and media containers keep their existing socket-free policy.
[Docker daemon security](https://docs.docker.com/engine/security/protect-access/)

Node's test runner defaults to process isolation and documents how concurrency
changes execution. We retain serial native cases, a literal selected test path,
registered actual completion and a separate fast gate. Test-runner cancellation
does not establish native container quiescence; the runner owner verifies it.
The reviewed reference is Node 24.17.0; host/native execution uses the verified
Node 24 line. This is a project validation choice grounded in runtime guidance.
[Node 24 test runner](https://nodejs.org/download/release/v24.17.0/docs/api/test.html)

W3C High Resolution Time remains the September 1, 2026 Working Draft. Its
monotonic measurement guidance supports separate command/seed/close windows,
not a cross-run causality or whole-CI speed claim. There is no UI behavior change
or new accessibility-conformance claim in this fixture slice.
[W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/)

OWASP recommends excluding sensitive data and exercising logging failures.
Daemon/container IDs, paths, raw snapshots and failed assertions stay private;
native stdout contains approved state/count/closure fields. Keep original
Error/null through failed observations and cleanup. This is informative security
guidance applied at the diagnostic boundary.
[OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## Open PR replay

GitHub MCP found one open PR, so the applicable random-selection set contained
only [PR #43](https://github.com/cloudbyday90/Harmoniarr/pull/43). It changes two
SARIF-upload references in one security workflow from CodeQL Action 4.30.8 to
4.38.3. We dereferenced the upstream annotated tag to commit
`24c54180a607b1449ed407dd24f251e4e9147c8d` and read its upload action manifest.
It uses Node 24 and requires `security-events: write`, already present in the
workflow. SARIF paths, categories, triggers and permissions remain unchanged.
[Verified action manifest](https://api.github.com/repos/github/codeql-action/contents/upload-sarif/action.yml?ref=24c54180a607b1449ed407dd24f251e4e9147c8d)

GitHub's security guidance favors full commit references verified against the
upstream repository. The replay preserves that convention and does not execute
or claim a hosted SARIF upload locally. The PR is not merged, rebased or commented
on; no release is created. Upstream release notes include CodeQL bundle changes
and a warning for old discontinued bundle versions; those are not evidence that
our local test tooling uses a CodeQL bundle.
[GitHub secure-use reference](https://docs.github.com/en/actions/reference/security/secure-use?ref=marcinhoppe.com)

The existing practical standards/testing skill references now distinguish native
socket proof from Linux media lifecycle coverage, explicit privilege from daemon
authorization, and a passing largest collection from historical diagnosis. See
the [design](MEDIA_API_SCALE_DESIGN.md) for pros/cons and the final stack, and the
[outcome](MEDIA_API_SCALE_OUTCOME.md) for executed results.
