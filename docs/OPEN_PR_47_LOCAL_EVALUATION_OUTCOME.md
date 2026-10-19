# PR 47 local language-server evaluation

Date: 2026-10-19. [PR 47](https://github.com/cloudbyday90/Harmoniarr/pull/47)
updates typescript-language-server 5.3.0 to 6.0.2. It was selected from the live
open list [49, 48, 47, 45] with unfiltered random draw 0.580668129119606.
The selected immutable head is 3b9aa34b3dfc37f0444630520bb26115b4c389a6;
its base is 106d7b5692cd0dd1fc0bf7fa03184fdcf6acca70.

## Design and application

Apply its reviewed package JSON delta to current main rather than replacing
the entire older package pair. A recursive three-way comparison rejects any
conflicting changed leaf and preserves newer pg/music-metadata changes absent
from the PR base. Preserve opening/candidate bytes and their hashes privately.
Install with npm ci and lifecycle scripts disabled. TypeScript stays 6.0.3.
The [research](RUNTIME_DEPENDENCY_RESEARCH_2026_10.md) records the official Node
floor and alternatives; Node 24 satisfies the language server's requirement.

## Observed outcome

The installed 6.0.2 CLI accepts a real JSON-RPC initialize request over stdio,
opens an actual JavaScript document and returns a hover containing the declared
qualificationAnswer symbol. Shutdown returns null; exit closes with code 0 and
no signal. A bounded ESM probe owns framing, stderr and actual process close.
The version command is not the compatibility proof.

Retain the language-server update with TypeScript 6.0.3. This tests a JavaScript
hover consumer, not every LSP method, Vue tooling, editor plugin or TypeScript 7
compatibility. The earlier failed TypeScript 7 evaluation remains separate in
[PR 48's outcome](OPEN_PR_48_LOCAL_EVALUATION_OUTCOME.md).

Private bytes, integrity hashes, installation and JSON-RPC logs remain ignored
under .tmp/runtime-qualification-2026-10-19/. The final combined candidate's
application checks are recorded in the
[runtime outcome](RUNTIME_DEPENDENCY_QUALIFICATION_OUTCOME.md).
No PR was merged, closed or rebased; this is a local implementation on main.
No branch, tag or release is created.
