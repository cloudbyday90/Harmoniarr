# PR 50 local Router evaluation

Date: 2026-10-19. GitHub MCP returned the live open list [50, 48, 45]. Unfiltered
random draw 0.08879716025644124 selected
[PR 50](https://github.com/cloudbyday90/Harmoniarr/pull/50), Router 5.2.0 to 5.4.0.
Immutable head: c495563d102325551ff13842953fbfa179709073;
base: f8299100f4b3192fb5d59f8126e69ef9adf5c717.

## Design and execution

Apply the exact proposed package pair in a disposable local copy of main after
asserting its opening bytes match the PR base. Keep original package backups and
hashes, install with npm ci and lifecycle scripts disabled, and exercise the real
installed Vue 3.5.44/Router 5.4.0 pair in Chromium. No PR merge or branch is needed.

The previously reviewed [issue 2851](https://github.com/vuejs/router/issues/2851)
is now closed upstream. That status alone does not qualify the published version.
The exact candidate still raises the null getRootNode exception when nested
navigation synchronously renders an async-setup component as the route's only
root under a previously resolved ancestor Suspense. A fresh-page wrapping-element
control renders the same eventual content without that exception.

## Outcome

Reject adoption of this exact candidate and restore the original package pair
and installation. Main's package files remain unchanged. The actual application
does not currently use the reproduction's Suspense trigger; this is a vendor
composition failure, not a reproduced Harmoniarr route failure.

A supplementary restored-5.2 UMD diagnostic could not initialize because that
distribution requires the nostics browser global. Retain that failed probe and
do not call it a passing same-shape baseline. The 5.4 wrapping control and final
built-application browser checks are separate evidence with their stated scopes.

Keep Router 5.2.0 until a candidate that passes this composition is qualified.
Published dependencies are not patched, and no unnecessary product wrapper is
introduced. Original/candidate hashes, installation logs and Chromium results
are retained through the security plugin's target-bound evidence collection.
The [CSRF outcome](CSRF_DEFAULT_PROTECTION_OUTCOME.md) records final application
validation. No PR was merged, closed or rebased by this evaluation; no release
or tag is created.
