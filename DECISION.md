# seekfeek — Decision Record

## Upstream review
- **Parent:** deepseek-ai/deepseek-harness (fork: true)
- **Upstream license:** MIT (Copyright (c) 2026 DeepSeek)
- **This fork's license:** none declared (inherits MIT from upstream)

## Decision
**Archive + keep as reference.** Reasons:
1. No documented value-add over upstream (no commits beyond fork baseline).
2. 110 MB repo size suggests build artifacts / node_modules committed (cleanup needed).
3. Upstream is actively maintained by DeepSeek; contributing there is higher leverage than maintaining a fork.

## Actions
- [ ] Remove committed artifacts (node_modules, dist) via .gitignore + history cleanup.
- [ ] If a real value-add is later identified, fork again cleanly and open a PR upstream.
- [ ] Otherwise archive this repo (read-only) to reduce maintenance surface.

## Status
Decision recorded 2026-10-27. Pending execution.

## History cleanup plan
- Run: git filter-repo --path node_modules --path dist --invert-paths
- Then: git push --force-with-lease origin main
- Verify: repo size < 20 MB after cleanup.