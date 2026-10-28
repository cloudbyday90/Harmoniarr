# Saved authorization status design

October 28, 2026. Implements the next item from the
[command outcome](PROVIDER_AUTHORIZATION_ACTIONS_OUTCOME.md). See separate
[research/tradeoffs](PROVIDER_AUTHORIZATION_STATUS_RESEARCH_2026_10.md),
[outcome](PROVIDER_AUTHORIZATION_STATUS_OUTCOME.md) and
[Docker design](LOCAL_DOCKER_PROVIDER_AUTHORIZATION_STATUS_DESIGN.md).

Create a small scoped ESM read owner. After an uncertain Spotify/YouTube command
result or accepted persisted handoff return, record the provider and perform one
bounded current-session GET followed by the existing provider-status GET. Check
the same administrator identity, password-change state and CSRF context before
reading/projecting saved status. Do not write the global session store from these
background responses. Each server endpoint retains its independent current
authorization; these two reads do not form a transaction or authorize a command.

Only the current owner may project present/absent from the existing bounded
saved-link policy. Update the target provider's saved linked observation without
applying settings, copying arbitrary response fields, changing drafts/secrets or
claiming that linking completed successfully. Unknown/malformed/partial-unavailable
results preserve the older card observation and report that the check failed.
Session mismatch/failure refuses further local command admission until an
explicit check establishes the current context; no automatic login or POST replay.

Duplicate read activation does nothing. Newer commands, settings load/save,
reactive session changes and scope disposal invalidate and abort the GET owner.
Publication fencing also handles transports that ignore abort. A bounded deadline
releases read admission, removes the timer and suppresses late completion. Retry
is an explicit read, never a command. Ordinary pageshow and unsettled commands
remain outside the persisted-handoff trigger.

Keep the command outcome visible separately from read progress/result. Render a
small dedicated component with a persistent role=status/aria-atomic paragraph and
native Check saved status button. Use guarded aria-disabled to retain focus;
never restore focus over a later user move. Keep existing saved command flags and
API/session/CSRF/state owners. No additional deployed service or schema refresh.

Verify actual GET order, bounded projection, session refusal/change, ignored abort,
timeouts, disposal, newer command/settings precedence, duplicate retry and dirty
draft retention. Exercise held responses and session/status failures in the built
browser with locally controlled replies, no forwarded account commands, both
themes and three widths. Keep native cache restoration and manual AT/device
acceptance distinct. Finish focused review before one stable complete fast gate;
compare packaged identity before retaining unrelated native proof.
