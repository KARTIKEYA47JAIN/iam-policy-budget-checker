# Terraform IAM Policy Checker

### Author's Note
*To be honest, if you ask me to explain the `.ts` files line by line, I genuinely cannot. 😅*

*But here's what I can tell you: I had a real problem. I kept hitting AWS IAM policy size limits mid-deploy and wanted a tool that would catch it before `terraform apply` - without asking AI to count characters for me every single time.*

**(At the very least, I didn't want to see that `LimitExceeded` message for something this preventable.)**

*I'm a DevOps engineer. TypeScript is nowhere on my learning list right now 🥲. I'm already a jack of many trades and honestly proud of it. But I knew exactly what I wanted to build and why - and that turned out to be enough.*

*P.S. Yes, I used AI to write the code. I had the idea and the problem - AI had the TypeScript. Fair trade. So yups, the irony of "not depending on the world" while depending on AI is not lost on me. 🤣*

---

> **Stop IAM policy size errors from breaking your Terraform deploys.**  
> Check your AWS IAM policies are within size limits - before `terraform apply` ever runs.

![VSCode](https://img.shields.io/badge/VSCode-1.75+-blue?logo=visualstudiocode)
![AWS](https://img.shields.io/badge/AWS-IAM-orange?logo=amazonaws)
![Terraform](https://img.shields.io/badge/Terraform-.tftpl-purple?logo=terraform)

---

## The Problem This Solves

You write an IAM policy in Terraform. `terraform plan` looks fine. You run `terraform apply` and halfway through it fails:

```
Error: LimitExceeded: Policy document exceeds the maximum allowed size
```

Now you are doing an emergency rollback.

The frustrating part - AWS only checks the size limit at **apply time**, not at plan time. And if your policies use Terraform's `templatefile()` function with `${variable}` placeholders, you cannot even measure the real size just by looking at the file - the variables are shorter than the real values they become.

**This extension fixes that.** It substitutes your variables with realistic values, minifies the JSON exactly the way AWS does, and tells you how close you are to the limits - right inside VSCode, before you deploy anything.

It also catches two common policy mistakes that waste characters and introduce security risk: **duplicate actions** and **wildcard permissions**.

---

## AWS IAM Size Limits (What This Checks)

| Policy Type | Terraform Resource | Size Limit |
|-------------|-------------------|------------|
| **Managed** | `aws_iam_policy` | **6,144 characters** |
| **Inline** | `aws_iam_role_policy` | **10,240 characters** |

These limits apply to the **minified JSON** - the version with all spaces and newlines removed. That is what AWS counts, and that is what this extension measures.

---

## Quick Start (2 minutes)

### Step 1 - Install

**Option A: From VSIX file**
1. Download `terraform-iam-policy-checker-1.0.0.vsix` from the [Releases page](https://github.com/KARTIKEYA47JAIN/terraform-iam-policy-checker/releases)
2. Open VSCode
3. Press `Ctrl+Shift+P` → type `Extensions: Install from VSIX`
4. Select the downloaded file
5. Restart VSCode

**Option B: Terminal**  
```bash
code --install-extension terraform-iam-policy-checker-1.0.0.vsix
```

### Step 2 - Open your Terraform policy folder

Open the folder containing your `.tftpl` policy files in VSCode.

### Step 3 - Run a check

Right-click any `.tftpl` file in the Explorer sidebar:

```
Right-click → Check IAM Policy Characters
```

That's it. A report panel opens showing you exactly where you stand.

---

## What You Will See

When you run a check, a report panel opens on the right side of your editor:

```
🛡️ IAM Policy Characters Report
Checked at 14:32:05 · 3 files analyzed          ✅ 3/3 within managed limit

┌─────────────────────────────────────────────────────┐
│ s3_access_policy.tftpl                              │ 
│                                                     │
│ Rendered size:    3,711 chars                       │
│                                                     │
│ MANAGED  6,144   ████████████░░░░░░░░  60.4%        │
│ INLINE  10,240   ███████░░░░░░░░░░░░░  36.2%        │
│                                                     │
│ WITHIN MANAGED LIMIT  (+2,433 chars remaining)      |
│                                                     │
│ Issues found                                        │
│   ⚠️ Wildcard in ECR     Action: ecr:*              │
│   ⚠️ Wildcard in S3      Action: s3:*               │
│   🔁 Duplicate in ECRRepo  ecr:CreateRepository 3x  │
│      Remove 2 duplicates - saves ~52 chars           │
│   💡 Removing all duplicates saves ~52 chars total  │
│                                                      │
│ Statement breakdown (17 statements · 3 with issues) ▼│
└──────────────────────────────────────────────────────┘
```

### Status colours
| Colour | Bar | Meaning | What to do |
|--------|-----|---------|------------|
| 🟢 **Green**  | Either | Below warn threshold % of that limit | Safe for that policy type |
| 🟡 **Yellow** | Either | Above warn threshold % but within hard limit | Approaching limit - review size |
| 🔴 **Red**    | Managed | Over 6,144 chars | Cannot use `aws_iam_policy` - switch to inline |
| 🔴 **Red**    | Inline  | Over 10,240 chars | Must split into multiple policies |
| ⚪ **Gray**   | Either | File has an error | Check the error message shown |

Each bar (Managed and Inline) is evaluated **independently**. One bar can be yellow while the other stays green.

---

## Policy Quality Checks

Every analysis automatically runs two additional checks beyond size measurement.

### Wildcard detection

Any statement using `*` or service wildcards like `s3:*`, `ec2:*` in its Action or Resource field is flagged:

```
⚠️ Wildcard in S3     Action: s3:*
⚠️ Wildcard in EC2    Action: ec2:*  Resource: *
```

This is a **warning, never an error**. Wildcards are sometimes intentional - a `Deny` statement scoped to `Resource: *` is correct and expected. The flag is there so you consciously confirm each wildcard is deliberate rather than a copy-paste leftover from a broader policy.

### Duplicate action detection

Any action that appears more than once in the same statement is flagged with the exact character savings:

```
🔁 Duplicate in ECRRepo   ecr:CreateRepository appears 3x
                          Remove 2 duplicates - saves ~52 chars
```

When removing duplicates would bring an over-limit policy back under the limit, the extension tells you directly:

```
💡 Removing all duplicates saves ~52 chars total
   would bring policy to 6,092 chars - within managed limit
```

Both checks run automatically on every analysis - no extra configuration needed.

---

## Variable Substitution - How It Works

Your `.tftpl` files look like this:

```json
{
  "Resource": "arn:aws:s3:::${state_bucket_name}/*"
}
```

The variable `${state_bucket_name}` is only 19 characters. But your real bucket name might be `my-company-terraform-state-prod-eu-central-1` - 44 characters. That difference adds up across hundreds of statements and gives you a false sense of safety.

**The extension asks you for a realistic value the first time it sees each variable:**

```
Variable substitution required
Enter a dummy value for ${state_bucket_name}
> my-company-terraform-state-prod-eu-central-1    [Enter]

Save this value?
> ✓ Save to settings   (remember forever)
  ✗ Just this session  (forget when VSCode closes)
```

Once saved, you are never asked again for that variable.

### Pre-configure your variables (recommended)

Save all your variable values in VSCode settings so you are never prompted at all.

Open your workspace settings (`Ctrl+Shift+P` → `Open Workspace Settings (JSON)`) and add:

```json
{
  "terraformPolicyIamChecker.variableSubstitutions": {
    "region": "eu-central-1",
    "aws_account_id": "123456789012",
    "environment": "production",
    "state_bucket_name": "my-company-terraform-state-prod-eu-central-1",
    "project_name": "my-actual-project-name"
  }
}
```

---

## All the Ways to Run a Check

### Right-click in Explorer (most common)

| What you right-click | What happens |
|---------------------|-------------|
| A single `.tftpl` file | Checks that one file |
| A folder | Checks all `.tftpl` files inside it |

### Command Palette (`Ctrl+Shift+P`)

| Command | What it does |
|---------|-------------|
| `IAM Policy: Check Characters` | Checks the file currently open in the editor |
| `IAM Policy: Check All in Workspace` | Scans your entire workspace |
| `IAM Policy: Open Settings` | Opens the extension settings |
| `IAM Policy: Clear Session Variables` | Forgets all variable values entered this session |

### Auto-check on save (optional)

Enable this setting to automatically re-check every time you save a `.tftpl` file:

```json
{
  "terraformPolicyIamChecker.autoCheckOnSave": true
}
```

> **Why I kept this off by default:** Auto-check on save sounds ideal but has a catch - if your variables aren't pre-configured in settings, every Ctrl+S triggers input prompts mid-edit. That's more annoying than helpful. My recommendation: set up your `variableSubstitutions` first, then enable this. Once your variables are saved, Ctrl+S silently updates the CodeLens bar above your file with the latest size - no clicks needed, no interruptions.

### CodeLens (inline editor hint)

When you open a `.tftpl` file that has been checked, a summary line appears above line 1:

```
✅ Size: 3,711 chars   ·   aws_iam_policy limit: 6,144 (60.4%)   ·   aws_iam_role_policy limit: 10,240 (36.2%)
```

---

## All Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `terraformPolicyIamChecker.variableSubstitutions` | `{}` | Your variable values - set these to avoid being prompted |
| `terraformPolicyIamChecker.managedPolicyLimit` | `6144` | AWS managed policy limit. Only change if AWS updates this |
| `terraformPolicyIamChecker.inlinePolicyLimit` | `10240` | AWS inline policy limit. Only change if AWS updates this |
| `terraformPolicyIamChecker.autoCheckOnSave` | `false` | Re-check automatically when you save |
| `terraformPolicyIamChecker.warnThresholdPercent` | `90` | Show a warning in the Problems panel when over this % |
| `terraformPolicyIamChecker.rememberSessionVariables` | `true` | Remember values you type in during the current session |

---

## Frequently Asked Questions

**Q: My file has no `${variables}` - will it still work?**  
Yes. If there are no variables, the extension skips the substitution step and measures the file directly.

**Q: I pressed Escape on the variable prompt. What happens?**  
That file is skipped and shown as "Skipped - user cancelled" in the report. All other files in the same run are still checked.

**Q: The size shown seems wrong.**  
The most common reason is that your variable values in settings are shorter than the real values used in deployment. Open Settings and make sure `terraformPolicyIamChecker.variableSubstitutions` contains values that match your real environment as closely as possible.

**Q: What does the Statement breakdown show?**  
Each IAM statement's individual size contribution, sorted largest first. This tells you exactly which statements to trim or split if you are over the limit.

**Q: Can I use this without Terraform?**  
Yes - any JSON file saved with a `.tftpl` extension will be analysed. The variable substitution step is simply skipped if there are no `${...}` patterns.

**Q: How does the warn threshold percentage work?**  
Each bar is evaluated independently against its own limit. If your policy is at 78% of the managed limit and your threshold is set to 50%, the managed bar turns yellow. If the same policy is at 47% of the inline limit, the inline bar stays green. The threshold applies to both bars separately - it is not a single global toggle.

**Q: When does a bar turn red?**  
Red means the policy has exceeded the hard AWS limit for that policy type - over 6,144 chars for `aws_iam_policy` (managed bar) or over 10,240 chars for `aws_iam_role_policy` (inline bar). Yellow means you are approaching the limit based on your threshold setting but have not exceeded it yet.

**Q: I have wildcards in my policy but they are intentional. Can I suppress the warning?**  
Not currently - the wildcard flag is always shown when wildcards exist. It is a prompt to confirm intentionality, not a blocker. A future version may add a way to mark specific wildcards as acknowledged.

**Q: The duplicate detection shows character savings but I still need those actions - why?**  
Duplicate actions in JSON are collapsed by the parser - only the last occurrence is kept. So the duplicates are not actually doing anything. Removing them reduces your character count with no change in effective permissions.

---

## For Developers

> This section explains how the extension is built internally. You do not need to read this to use the extension.

### Building from Source

```bash
git clone https://github.com/KARTIKEYA47JAIN/terraform-iam-policy-checker
cd terraform-iam-policy-checker
npm install
npm run compile
```

Press `F5` in VSCode to launch the Extension Development Host with the extension loaded.

To package as a `.vsix`:
```bash
npm install -g @vscode/vsce
vsce package --no-dependencies
```

### Project Structure

```
src/
├── extension.ts          Entry point. Registers all commands and listeners.
├── analyzer.ts           Core logic. Reads files, resolves variables, measures size,
│                         detects wildcards and duplicate actions.
├── variableResolver.ts   Handles ${variable} extraction, prompts, and caching.
├── resultsPanel.ts       Builds the Webview HTML report panel.
├── codeLensProvider.ts   Shows inline size summary above line 1 of .tftpl files.
├── diagnosticsProvider.ts Writes to the VSCode Problems panel.
└── types.ts              Shared TypeScript interfaces.
```

### How It All Works - Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         package.json                            │
│   Declares commands, menus, settings, activation events         │
│   VSCode reads this at install time - no code runs yet          │
└───────────────────────────────┬─────────────────────────────────┘
                                │ workspace contains *.tftpl
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│                        extension.ts                              │
│   activate() runs once. Creates all providers and registers      │
│   commands. Pushes everything into context.subscriptions         │
│   for automatic cleanup.                                         │
└──────┬──────────────────────────────────┬────────────────────────┘
       │ user triggers command            │ file saved (autoCheck)
       ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    runCheckOnFiles()                            │
│   Loops through selected files. Calls analyzer.analyzeFile()    │
│   for each one. Collects all results.                           │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       analyzer.ts                               │
│                                                                 │
│  1. Read file from disk (fs.readFileSync)                       │
│  2. Check for empty file / malformed ${                         │
│  3. Extract all ${variable} names via regex                     │
│  4. Pass to variableResolver → get substitution Map             │
│  5. Apply substitutions (replace every ${var} with value)       │
│  6. JSON.parse() → catch errors with line/col position          │
│  7. JSON.stringify() ← this IS the minification                 │
│     .length = what AWS counts                                   │
│  8. Compare against limits → status: ok/warn/over_inline        │
│  9. Per-statement size breakdown, sorted largest first          │
│ 10. Detect wildcards in Action and Resource fields              │
│ 11. Detect duplicate actions and calculate char savings         │
│ 12. Store result in cache with file mtime                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │ PolicyAnalysisResult
              ┌────────────────┼─────────────────┐
              ▼                ▼                 ▼
┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐
│diagnostics      │  │ resultsPanel.ts  │  │codeLensProvider   │
│Provider.ts      │  │                  │  │.ts                │
│                 │  │ Builds HTML      │  │                   │
│ Writes to       │  │ string for the   │  │ Reads result      │
│ Problems panel  │  │ Webview panel.   │  │ cache. Redraws    │
│ (Ctrl+Shift+M)  │  │ Opens or reuses  │  │ the size line     │
│                 │  │ the panel.       │  │ above line 1 of   │
│ Red squiggles   │  │                  │  │ the open file.    │
│ on error lines  │  │ Shows size bars, │  └───────────────────┘
└─────────────────┘  │ issues section,  │
                     │ statement badges │
                     └──────────────────┘
```

### Variable Resolution - Decision Flow

```
For each ${variable} found in the file:
│
├── Is it in terraformPolicyIamChecker.variableSubstitutions settings?
│   YES → use that value, move to next variable
│   NO  ↓
│
├── Is it in the session cache (already entered this run)?
│   YES → use cached value, move to next variable
│   NO  ↓
│
├── Show showInputBox() prompt to user
│   ESCAPE → return null → skip entire file
│   ENTER  ↓
│
├── Store in session cache (if rememberSessionVariables: true)
│
└── Show QuickPick: "Save to settings?" 
    YES → write to workspace settings.json permanently
    NO  → value lives only for this session
```

### Why `JSON.stringify()` is the Minification

AWS measures IAM policy size against the minified JSON - all whitespace removed. `JSON.parse()` followed by `JSON.stringify()` with no extra arguments does exactly this:

```typescript
const minified = JSON.stringify(JSON.parse(rendered));
// minified.length === what AWS counts
```

This is the most important line in the entire extension.

### Cache Invalidation

Results are cached per file path alongside the file's `mtimeMs` (modification timestamp). Before returning a cached result, the current `mtime` is checked:

```typescript
const stat = fs.statSync(uri.fsPath);
if (stat.mtimeMs !== entry.mtimeMs) {
    // File changed since last check - discard cache
    this.resultCache.delete(uri.fsPath);
}
```

This means editing a file and re-running the check always produces a fresh result.

### Tech Stack

- **Language:** TypeScript
- **Runtime:** VSCode Extension Host (Node.js)
- **UI:** VSCode Webview API (HTML/CSS/JS panel) + CodeLens API
- **Dependencies:** VSCode API and Node.js built-ins only - zero npm runtime dependencies

---

*Built by a DevOps engineer to solve a real deployment problem.*  
*AI-assisted implementation. Problem definition, specification, and testing by the author.*