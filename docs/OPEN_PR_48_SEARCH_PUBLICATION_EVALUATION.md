# Open PR 48: search-publication evaluation

October 20, 2026. GitHub MCP repository metadata supplied the open-PR collection
URL. The pool was `[48]`; random draw 0.30509356606556715 selected
[PR 48](https://github.com/cloudbyday90/Harmoniarr/pull/48). MCP fetched its full
two-file patch. Head remains `9898af07e914b132b7eb953eb96cde30d6ee865c`.

The patch changes TypeScript 6.0.3 to native TypeScript 7.0.2, adds platform
packages and removes the tsserver executable. The identical candidate was
already installed locally and failed the real Vue/language-server consumer
because tsserver.js was absent. The prior passing control used TypeScript 6.0.3,
typescript-language-server 6.0.2, @vue/language-server 3.3.13 and
@vue/typescript-plugin 3.3.13. Current package/lock and actual installed consumer
versions are checked against retained evidence before reusing it.

Benefit: the native compiler is a potential performance improvement. Cost:
compiler CLI execution does not establish compatibility with our language-server
integration. Reinstalling the identical failed candidate adds no new evidence.
Leave this PR unapplied and open; a rebase does not supply the missing consumer
implementation. No merge, force push, closure or branch deletion is justified.
The retained local candidate/control and applicability method are described in
the preceding [evaluation](OPEN_PR_48_NATIVE_SEARCH_EVALUATION.md).
