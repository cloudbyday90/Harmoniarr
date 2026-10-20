# Random PR 51 local evaluation

Date: 2026-10-20. Fresh GitHub MCP open inventory [52, 51, 48] and random draw
0.6039993678958598 selected [PR 51](https://github.com/cloudbyday90/Harmoniarr/pull/51).
Reviewed head edf2825fa381d4f01f8b68434d90ff4a84c97fd9, base
6561d41c3683b70fc5d9df50edaa79bac4439cc8. Its single reviewed change replaces
slskd/slskd:0.26.0 with 0.26.1 in the managed-provider overlay.

## Design of the evaluation

Apply that exact line locally on main. Use the retained qualified app image and
real slskd image, disposable generated secrets, private authenticated API and
the existing account-free managed smoke. A private overlay limits app publication
to loopback and removes the unused Soulseek listener publication. Both provider
networks are internal; no live account, search or transfer is required. Require
acknowledged project-resource removal before deleting temporary bind data.

Read the actual application/version endpoint, then call the packaged app's real
createSlskdService.prepareDownloadDispatch with that same provider configuration.
Startup and API health alone cannot establish transport compatibility. Repeat
with the restored original image pin before assigning a regression to the PR.

## Observed result

| Image | Observed wire version | Startup/private API | Download preparation |
| --- | --- | --- | --- |
| Candidate slskd 0.26.1 | 0.26.1.0 | Healthy; authenticated 200 | Refused: slskd_download_version_unsupported |
| Restored slskd 0.26.0 | 0.26.0.0 | Healthy; authenticated 200 | Same refusal |

Pulled candidate immutable identity:
sha256:588af49abc3088d639c8f1174d3bfad6e92c093a275a593140e3ac9311ebf6c4.
Observed original identity:
sha256:ecd4026d4f8fb504e2cc55323efa2c1f5b56d20d3686b018249cc36b48ea17a6.
Both compatibility assertions fail and their collections are retained. The
restored image is not a passing download control. Existing policy maps exact
0.26.0 to batch and 0.25.1 to legacy, while these APIs return four components.
This is a demonstrated baseline compatibility gap, not proof that the patch
introduced it. No enqueue or provider POST was attempted.

Both smoke projects pass config permissions, private API, provider health and
egress-isolation checks. Resource cleanup is separately verified before workspace
removal. The managed overlay is restored byte-for-byte; no PR is merged, closed
or rebased, and no candidate provider pin remains in the commit.

Official [slskd release notes](https://github.com/slskd/slskd/releases), discovered
and opened through MCP, describe transfer and scheduling changes in 0.26.1.
A patch label does not qualify those contracts or justify accepting arbitrary
future versions. Next: bind reviewed transport support to actual stable wire
version forms, then prove batch admission, exact receipts and refusal semantics
against the real provider before considering this upgrade. Do not broadly strip
version suffixes or relax durable attempt binding as a workaround.

MCP code search also located the current upstream
[version controller](https://github.com/slskd/slskd/blob/6a450e411a2e03a57aa6f7ae95e62252d847ec71/src/slskd/Core/API/Controllers/ApplicationController.cs),
which returns Program.SemanticVersion. This source lookup identifies the return
owner; the table's actual wire values come from the recorded container identities,
not an assumption that the default-branch commit equals either released image.

Private evidence is under .tmp/server-builder-2026-10-20. The independent
[server-builder outcome](SERVER_BUILDER_OUTCOME.md) owns final packaging validation.
