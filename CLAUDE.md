# fe13-child-calc

## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues for `AttackOnTyler/fe13-child-calc`, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root (created lazily). See `docs/agents/domain.md`.

## Guide anchors

Controls the usage guide points at carry a `data-guide` anchor, added with `guide('x')` from `src/ui/guide.ts`. If you change the behaviour of a control that has a `guide('x')` anchor, reread every guide entry that targets `x` and update it in the same PR.
