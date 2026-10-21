# Migration scaffold research, October 2026

Consulted October 21, 2026 through MCP search and official navigation. This
checkout uses Node 24.22.0/npm 12.0.2; no runtime or dependency update is proposed.

| Official source | Status and applicable guidance | Project decision |
| --- | --- | --- |
| [GNU license application guidance](https://www.gnu.org/licenses/gpl-howto.html) | Official GNU guidance; MCP search returned the file-level copyright and permission-notice recommendations. Direct page and language-variant retrieval timed out, so a fresh full-page review is unverified. | Retain the existing repository-approved GPL notice and owner rather than authoring new licensing language. |
| [SPDX handling license information](https://spdx.dev/learn/handling-license-info/) | Official informative guidance, opened through MCP. Short-form identifiers improve machine-readable license identification; copyright notices remain separate information. | SPDX-only conversion is a possible separate policy project, not a replacement for the current copyright checker. |
| [Node file-system documentation](https://nodejs.org/api/fs.html) | Official vendor API contract, opened through MCP; the unversioned page displays v26.12.1. Exclusive `wx` creation refuses an existing path, and FileHandles need explicit closure. These APIs predate the installed Node 24 runtime. | Preserve the generator's existing exclusive open and finally-close ownership. No check-then-overwrite path. |

The implementation recommendation is a project inference: reuse the canonical
SQL notice helper and verify its actual generated output with the existing
checker. Official licensing guidance does not define Harmoniarr's owner/year
policy; the maintained helper and policy checks do. This round does not change
license choice or claim comprehensive legal compliance.

W3C web interaction/accessibility standards were considered for applicability.
The generator produces SQL comments and a local filename, with no HTML, HTTP,
focus or status-region changes. No new W3C conformance work is implied. Relevant
practices here are consistent source metadata, single policy ownership, exclusive
filesystem creation and testing the actual tool consumer. The
[design](MIGRATION_SCAFFOLD_DESIGN.md) compares the alternatives and final stack.

## Next runtime priority

MCP search and page retrieval also identified the official
[Node 24.22.1 release](https://nodejs.org/en/blog/release/v24.22.1/), published
October 21 as a security release with high-severity TLS, DNS and Brotli fixes.
The checkout/image remain pinned to 24.22.0 in this authoring-only change.
Next, qualify and update the local/CI/Docker runtime baseline together, including
native TLS identity/refusal and affected HTTP consumers. Application-specific
exploitability has not been assessed by this scaffold qualification.
