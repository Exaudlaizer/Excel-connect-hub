# Contributing

Thanks for helping build Excel Connect Hub. Start with [AGENT.md](AGENT.md) for the repo map, commands and conventions.

## Workflow

1. Create a branch from `main`: `feat/<short-name>`, `fix/<short-name>`, or `docs/<short-name>`.
2. Make small, focused changes.
3. Run the checks (below).
4. Open a pull request describing **what changed, why, and how you verified it**. Note anything you could not test.
5. Address review comments; squash-merge when approved and CI is green.

## Commit messages

The history so far is mostly "commit", which makes it impossible to review or bisect. Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(jobs): close listings automatically after deadline
fix(auth): reject suspended users on token refresh
docs: update API reference
chore(deps): bump next to 14.2.35
```

## Checks before opening a PR

```bash
# backend
cd backend && npm ci && JWT_SECRET=$(openssl rand -hex 32) node -e 'require("./src/app"); process.exit(0)'
npm audit --omit=dev            # no new high/critical
# frontend
cd frontend && npm ci && npm run lint && npm run build
```

Once the test suite exists (docs/TESTING.md), `npm test` must pass as well.

## Code review checklist

- Authorization: does every new route have `protect` and the right `authorize`? Is ownership checked?
- Input: validated and bounded? Pagination clamped?
- Moderation: does new public content start `pending`?
- Secrets/PII: nothing sensitive logged or committed?
- Migration: does a schema change come with an idempotent `db:migrate` step?
- Docs: API.md / FEATURES.md / SECURITY.md updated where relevant?

## Reporting security issues

Do not file public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).
