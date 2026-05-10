import * as vscode from 'vscode';

export class VariableResolver {
    private sessionVars: Map<string, string>;

    constructor(sessionVars: Map<string, string>) {
        this.sessionVars = sessionVars;
    }

    /**
     * Extracts all unique ${variable} names from template content.
     */
    extractVariables(content: string): string[] {
        const pattern = /\$\{([^}]+)\}/g;
        const found = new Set<string>();
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
            found.add(match[1]);
        }
        return Array.from(found);
    }

    /**
     * Returns a realistic placeholder value based on the variable name.
     * These match the approximate length of real AWS values so size
     * estimates are accurate.
     */
    getPlaceholder(varName: string): string {
        const lower = varName.toLowerCase();
        if (lower.includes('account_id') || lower.includes('account-id')) {
            return '123456789012';
        }
        if (lower.includes('region')) {
            return 'eu-central-1';
        }
        if (lower.includes('arn')) {
            return 'arn:aws:iam::123456789012:role/dummy-role';
        }
        if (lower.includes('bucket')) {
            return 'my-example-bucket-name';
        }
        if (lower.includes('key_id') || lower.includes('kms')) {
            return 'arn:aws:kms:eu-central-1:123456789012:key/mrk-00000000000000000000000000000000';
        }
        if (lower.includes('name')) {
            return 'my-example-resource-name';
        }
        if (lower.includes('env') || lower.includes('environment')) {
            return 'production';
        }
        if (lower.includes('prefix') || lower.includes('suffix')) {
            return 'my-prefix';
        }
        return 'dummy-value-xyz';
    }

    /**
     * Resolves all variables using (in order):
     * 1. Extension settings map
     * 2. Session cache
     * 3. User input prompt
     *
     * Returns null if the user cancels any prompt.
     */
    async resolveVariables(variables: string[]): Promise<Map<string, string> | null> {
        const config = vscode.workspace.getConfiguration('terraformPolicyIamChecker');
        const settingsMap = config.get<Record<string, string>>('variableSubstitutions') || {};
        const resolved = new Map<string, string>();

        for (const varName of variables) {
            // 1. Settings
            if (settingsMap[varName] !== undefined) {
                resolved.set(varName, settingsMap[varName]);
                continue;
            }

            // 2. Session cache
            if (this.sessionVars.has(varName)) {
                resolved.set(varName, this.sessionVars.get(varName)!);
                continue;
            }

            // 3. Prompt user
            const placeholder = this.getPlaceholder(varName);
            const value = await vscode.window.showInputBox({
                title: 'Variable substitution required',
                prompt: `Enter a dummy value for \${${varName}} - used for size estimation only`,
                placeHolder: placeholder,
                ignoreFocusOut: true
            });

            // Escape pressed
            if (value === undefined) {
                return null;
            }

            if (value.trim() === '') {
                vscode.window.showWarningMessage(
                    `Empty value for \${${varName}} may produce an inaccurate size estimate.`
                );
            }

            resolved.set(varName, value);

            // Cache in session if setting is enabled
            const rememberSession = config.get<boolean>('rememberSessionVariables', true);
            if (rememberSession) {
                this.sessionVars.set(varName, value);
            }

            // Ask if user wants to persist to settings
            const save = await vscode.window.showQuickPick(
                [
                    { label: '$(check) Save to settings', description: 'Remember for future sessions', value: true },
                    { label: '$(close) Just this session',  description: 'Forget after VSCode closes',   value: false }
                ],
                {
                    title: `Save "\${${varName}}" = "${value}" to settings?`,
                    ignoreFocusOut: true
                }
            );

            if (save?.value === true) {
                const updated = { ...settingsMap, [varName]: value };
                await config.update(
                    'variableSubstitutions',
                    updated,
                    vscode.ConfigurationTarget.Workspace
                );
            }
        }

        return resolved;
    }

    /**
     * Replaces all ${variable} occurrences in content with their resolved values.
     */
    applySubstitutions(content: string, substitutions: Map<string, string>): string {
        let result = content;
        substitutions.forEach((value, key) => {
            const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            result = result.replace(new RegExp(`\\$\\{${escaped}\\}`, 'g'), value);
        });
        return result;
    }

    /**
     * Returns any ${variable} patterns still present after substitution.
     */
    findUnresolved(content: string): string[] {
        const pattern = /\$\{([^}]+)\}/g;
        const unresolved = new Set<string>();
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
            unresolved.add(match[1]);
        }
        return Array.from(unresolved);
    }

    /**
     * Detects lines with ${ that has no closing } - malformed templates.
     */
    findMalformed(content: string): number[] {
        const lines = content.split('\n');
        const malformed: number[] = [];
        for (let i = 0; i < lines.length; i++) {
            // Line has ${ but no } after it - simple single-line heuristic
            if (/\$\{/.test(lines[i]) && !/\$\{[^}]*\}/.test(lines[i])) {
                malformed.push(i);
            }
        }
        return malformed;
    }
}