# slskd 0.26.1 research and recommendation stack

Consulted October 20, 2026. URLs were discovered through GitHub MCP repository,
release, PR and source metadata and MCP web search, then opened directly.

| Source and status | Applicable decision |
| --- | --- |
| [slskd 0.26.1 release](https://github.com/slskd/slskd/releases/tag/0.26.1), vendor release notes | Timeout cancellation, upload UI retry change, and newly enabled disk logging need separate applicability review. |
| [Timeout fix PR 1827](https://github.com/slskd/slskd/pull/1827), vendor implementation | Adds cancellation of the actual download token when remote enqueue acknowledgment exceeds three minutes. |
| [Released download service](https://api.github.com/repos/slskd/slskd/contents/src/slskd/Transfers/Downloads/DownloadService.cs?ref=71dcc7a60650b5a61d1d2a35609b65f3467d1396), immutable implementation | Pin source review to release commit, not default branch. Existing retry options remain relevant; cancellation must retire internal work before explicit retry. |
| [Upload retry PR 1857](https://github.com/slskd/slskd/pull/1857), vendor implementation | UI action eligibility changes for uploads; it is not a download retry fix and is outside Harmoniarr's consumer path. |
| [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), IETF standard | Preserve conservative handling of unknown non-idempotent POST results and GET-based receipt recovery. |
| [Compose networks](https://docs.docker.com/reference/compose-file/networks/), Docker documentation | Inspect one internal network and absent published ports for native qualification. |
| [Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html), OWASP informative guidance | Apply non-root execution, read-only filesystems, capability removal and bounded resources to disposable fixtures. |
| [Data on the Web Best Practices](https://www.w3.org/TR/dwbp/), W3C Recommendation | Version and provenance guidance informs fixture evidence design; this is a design inference, not W3C certification of private transport tests. |
| [Node October security announcement](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases?trk=public_post_comment-text), vendor announcement | HIGH fixes are scheduled on or after October 21 for 24/26/22. No unissued patch or remediation claim on October 20. |

Released slskd commit `71dcc7a60650b5a61d1d2a35609b65f3467d1396` still links
Soulseek.NET 10.0.2. The enqueue guard is hardcoded to three minutes. The fixture
must extend the separate peer inactivity setting beyond that guard to isolate
the changed behavior; leaving the default 15 seconds would test a different
failure. Disk logging is now enabled by default with 14-day retention; deployments
must account for bounded writable storage. The native test keeps it disposable.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Upgrade from release notes alone | Minimal work | Does not prove internal cancellation, receipt identity or no-resend behavior | Reject |
| Stay on 0.26.0 indefinitely | Existing admission evidence | Retains the known timeout cleanup gap | Use only if candidate qualification fails |
| Qualify actual 0.26.1 with old-image control | Proves relevant behavioral difference with immutable binaries | Dedicated test takes at least three minutes per image | Recommend |
| Add timeout test to every fast run | Frequent coverage | Adds minutes to unrelated edits | Reject; keep opt-in |

Recommended stack: narrow ESM protocol policy; exact raw-version/provider binding;
existing durable attempts and GET reconciliation; isolated native admission lane;
separate explicit three-minute cancellation lane; focused PostgreSQL authority
tests; fast static/unit/build gate. Retain runtime 24 LTS for the application and
track the announced security patch separately. No framework or database migration
is needed for this provider qualification.
