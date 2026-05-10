# Changelog

All notable changes to Terraform IAM Policy Checker will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html):
- **Patch** `1.0.x` — bug fixes, no new features
- **Minor** `1.x.0` — new features, backwards compatible
- **Major** `x.0.0` — breaking changes

---

## [1.0.0] — 2026-05-07

### Added
- Check AWS IAM policy `.tftpl` files against managed limit (6,144 chars) and inline limit (10,240 chars)
- Variable substitution for Terraform `templatefile()` `${variable}` patterns
- Smart placeholder suggestions based on variable name (account_id, region, arn, bucket, kms)
- Session caching — variable values remembered within a single check run
- Persist variable values to workspace settings for future sessions
- Visual report panel with animated progress bars showing usage percentage for both limits
- Per-statement size breakdown sorted largest first — helps identify what to trim
- Status colours: green (ok), yellow (over managed), red (over inline), gray (error)
- CodeLens inline hint above line 1 of every `.tftpl` file showing current sizes
- Gutter warning/error icons with hover tooltips
- Problems panel integration with red squiggles on error lines
- Right-click context menu on `.tftpl` files → Check IAM Policy Budget
- Right-click context menu on folders → Check All IAM Policies in Folder
- Command Palette: `IAM Policy: Check Budget`, `IAM Policy: Check All in Workspace`
- Auto-check on save (optional, disabled by default)
- File modification time cache — re-check always reads fresh file content
- 47 unit tests covering size logic, variable resolution, and substitution

### Settings introduced
- `terraformPolicyIamChecker.variableSubstitutions` — pre-configure variable values
- `terraformPolicyIamChecker.managedPolicyLimit` — configurable managed limit (default 6144)
- `terraformPolicyIamChecker.inlinePolicyLimit` — configurable inline limit (default 10240)
- `terraformPolicyIamChecker.autoCheckOnSave` — auto-check on file save (default false)
- `terraformPolicyIamChecker.warnThresholdPercent` — warning threshold percentage (default 90)
- `terraformPolicyIamChecker.rememberSessionVariables` — session variable caching (default true)

---

## How to add an entry

When you make changes, add a new section at the top following this format:

```markdown
## [1.1.0] — YYYY-MM-DD

### Added
- New features go here

### Changed
- Changes to existing features go here

### Fixed
- Bug fixes go here

### Removed
- Removed features go here
```