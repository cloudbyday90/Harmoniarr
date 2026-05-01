# Harmoniarr Deferred V1.1 Task List

Implementation source: `docs/harmoniarr.md`
Master execution tracker: `docs/IMPLEMENTATION_TASK_LIST.md`

## Purpose

This file tracks intentionally deferred work so it stays explicit and does not drift back into V1 by accident.

## Deferred From Initial V1 Scope

### Platform And Deployment

- [ ] Multi-node or distributed worker deployment.
- [ ] Non-default split-database or externally managed Postgres deployment guidance beyond the primary Docker-first path.

### Product Surface

- [ ] Mobile-native clients.
- [ ] Broad plugin ecosystem or arbitrary third-party execution hooks.
- [ ] Hosted-service or multi-tenant control-plane behavior.

### Automation And Advanced Capability

- [ ] More autonomous destructive automation beyond review-first operator approval.
- [ ] Optional embeddings/vector-search work if that becomes a real requirement later.
- [ ] Additional transcoding policy sophistication beyond the initial documented presets and confirmation rules.

### Database And Performance Enhancements

- [ ] Postgres tuning beyond the default accepted baseline once real workload data exists.
- [ ] Later-query-pressure features such as additional trigram or temporal constraint work not justified yet for V1.

## Re-Entry Rules

- [ ] Any deferred item must name its prerequisite evidence before it can move into active scope.
- [ ] Any deferred item that changes auth, recovery, or destructive filesystem semantics must update the main implementation plan first.
- [ ] Deferred items do not become V1 scope through implementation convenience alone.

## Done Criteria

- [ ] The V1 boundary remains explicit.
- [ ] Follow-up work can be promoted intentionally without reopening solved V1 assumptions.