# Contributing to IAM Policy Budget Checker

Thanks for your interest in contributing. This is a VSCode extension built for DevOps engineers working with AWS IAM policies and Terraform.

---

## Before You Start

- Check the [open issues](../../issues) to see if your idea or bug is already being tracked
- For large changes, open an issue first to discuss the approach before writing code
- All contributions must pass the existing 47 unit tests and any new tests you add

---

## Setting Up Locally

```bash
git clone https://github.com/KARTIKEYA47JAIN/iam-policy-budget-checker.git
cd iam-policy-budget-checker
npm install
npm run compile
```

Press **F5** in VSCode to launch the Extension Development Host with the extension loaded.

Run tests:
```bash
npm test
```

---

## Making Changes

### Branch naming

```
feature/short-description     # new feature
fix/short-description         # bug fix
docs/short-description        # documentation only
test/short-description        # tests only
ci/short-description          # CI/CD changes
```

Example:
```bash
git checkout -b feature/add-github-actions-integration
```

### Commit message format

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short description in present tense

feat: add support for JSON policy files without .tftpl extension
fix: correct cache not invalidating when file is edited on Windows
docs: add FAQ entry about escaped characters in variable values
test: add edge case for empty Statement array
chore: update @types/vscode to 1.80.0
ci: add Node 20 to test matrix
refactor: extract minification logic into separate utility function
```

**Rules:**
- Use present tense — "add feature" not "added feature"
- Keep the first line under 72 characters
- No capital letter at the start
- No full stop at the end

### What needs a test

Any change to these files needs a corresponding test:
- `src/variableResolver.ts` — add to `src/tests/variableResolver.test.ts`
- Size calculation logic — add to `src/tests/sizeLogic.test.ts`

Changes to `resultsPanel.ts`, `codeLensProvider.ts`, `diagnosticsProvider.ts` are UI changes that are harder to unit test — manual testing via F5 is acceptable for those.

---

## Pull Request Process

1. Fork the repo and create your branch from `main`
2. Make your changes
3. Run `npm test` — all tests must pass
4. Run `npm run compile` — no TypeScript errors
5. Update `CHANGELOG.md` with what you changed under a new `[Unreleased]` section
6. Open a pull request with a clear description of what changed and why

---

## Reporting Bugs

Open an issue with:
- Your VSCode version
- The content of your `.tftpl` file (or a simplified version that reproduces the bug)
- What the extension showed vs what you expected
- Any error messages from the Problems panel (`Ctrl+Shift+M`)

---

## Ideas Worth Contributing

These are things that would make this extension genuinely more useful:

- Support for detecting policy type automatically from Terraform `.tf` files
- GitHub Actions step that runs the check in CI before `terraform apply`
- Export the budget report as CSV for team audits
- Support for checking JSON policy files directly (without `.tftpl` extension)
- Windows path handling improvements

---

*This project was built by a DevOps engineer to solve a real deployment problem. AI-assisted implementation — contributions from the community are welcome.*