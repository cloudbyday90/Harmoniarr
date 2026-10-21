# System history admission outcome

Date: 2026-10-21. Implements the [design](HISTORY_ROUTE_ACCESS_DESIGN.md) and
[official-source recommendations](HISTORY_ROUTE_ACCESS_RESEARCH_2026_10.md).

System history now joins the three reviewed source-policy destinations in the
shared ESM Activity admission policy. A current administrator session precedes
page mount. Other/unknown roles lose the diagnostic link, and direct navigation
returns to Home. Existing bootstrap/password-change/login precedence and bounded
verification-failure feedback remain. No API, schema or server permission changed.

All four Source/history destinations are now unavailable to non-admin roles, so
the existing projection omits that empty group and its heading. The immutable
admin inventory remains complete. Native disclosure and RouterLinks retain the
relative order of the three surviving groups.

## Executed validation

- Five focused policy/projection cases passed across all four reviewed routes,
  unknown roles, pending/error/null verification and unrelated routes without
  added session reads. The projection checks all surviving groups and preserves
  the immutable admin inventory.
- Fourteen PostgreSQL/browser cases passed together in 56.5 seconds: nine
  Activity admission cases, two controlled-payload history initial-load/retry controls, two canonical
  ignored-review return controls and one lazy Settings keyboard/history control.
  No new fixture process or duplicated owning test file was introduced.
- The owning admission cases hold actual native session responses before entry,
  prove zero reviewed-page reads while pending/refused and then observe authorized
  native destination responses. The new System history case reads its actual feed
  handler. Cached admin-to-operator revocation, password-change precedence and
  bounded failed-verification retry pass for all four destinations.
- Anonymous/operator/requester forged direct links are refused. Fourteen protected
  HTTP method/path contracts per actor return 401/403 independently of the browser,
  including the System history read and retained source detail/export/mutations.
  Opening review emits no source-policy/search mutation.
- Actual keyboard checks cover the native summary/first-link boundary and
  Request records/Monitored artists adjacency. Inspected 390px light and 800px
  dark/1280px light captures show the surviving groups. A focused role-refusal
  repeat passed in 9.7 seconds after adding mobile Tab geometry: Monitored artists
  stays fully above the fixed bottom navigation with visible focus. The earlier
  unfocused capture overlap did not reproduce keyboard obstruction, so no CSS
  change was needed. This is 14 unique cases plus one focused repeat, not 15 unique
  cases; it does not prove screen-reader output or general WCAG conformance.
- The stable final `npm run validate:fast` passed 10,702 tests: 5,592 server,
  4,413 client and 697 script cases, with zero failures, cancellations or skips.
  Static baseline/copyright/migration/schema/ESM/image/topology checks, full lint,
  test hygiene and both builds passed. Test phases took 68.2, 7.3 and 5.7 seconds.
  No exhaustive integration/media matrix, timing relaxation or worker increase
  was needed for this client admission boundary.
- The existing web-standards AI skill now records empty diagnostic groups, actual
  system-feed ownership, native versus controlled-payload evidence and mobile
  focus geometry. Skill structural validation passed.

Recorded source: 3,175 files,
`fcbdca12b266e775f61732c1524ecd0a3e826c7ab51249f2c38a9994917e8bbe`.
Four resulting code/test files are frozen for final byte verification. Browser
checks preceded whitespace preservation without logic changes; the stable fast
gate and packaged build use the final candidate. Private evidence is retained
under `.tmp/history-route-access-2026-10-21/`. The separate
[Docker outcome](LOCAL_DOCKER_HISTORY_ROUTE_ACCESS_OUTCOME.md) owns preserved
startup and readiness evidence.

## Random PR and stale-proposal cleanup

MCP refreshed two open PRs and randomly selected
[PR #48](https://github.com/cloudbyday90/Harmoniarr/pull/48), head
`9898af07e914b132b7eb953eb96cde30d6ee865c`. Its complete package/lock patches
match the retained TypeScript 7.0.2 candidate. The root lockfile hash and installed
TypeScript 6.0.3, typescript-language-server 6.0.2, Vue language-server 3.3.13 and
Vue TypeScript plugin 3.3.13 match the passing control inputs. Retained candidate
qualification is incomplete; the control completed the actual Vue language-service
bridge and editor queries. No consumer input changed to justify repeating the
dependency installation or promoting that incompatible patch.

The candidate is therefore not applied. Under the user's earlier stale-PR cleanup
instruction, PR #48 was closed without merging; its head remains unchanged and
no branch was deleted or rebased. MCP confirms `state: closed` and `merged: false`.
Mergeability differed between snapshots and was not the reason for this decision.
A future coordinated tooling proposal should qualify real Vue TS hover,
completion, diagnostics and bridge operations, plus the build, before replacing
the working TypeScript 6 dependency. Compiler version output alone is insufficient.

## Next item

The recommended Settings Connections follow-up is now completed in the
[Connections admission outcome](CONNECTIONS_ROUTE_ACCESS_OUTCOME.md). It uses
area-owned rules with a common session mechanism, preserves Account aliases and
qualifies the tab, global health link and real protected reads/commands.

Work remains on main. No release, tag, version bump or separate branch is created.
