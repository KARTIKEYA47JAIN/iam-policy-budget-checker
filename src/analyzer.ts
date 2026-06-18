import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { PolicyAnalysisResult, StatementBreakdown, PolicyStatus, WildcardUsage, DuplicateAction } from './types';
import { VariableResolver } from './variableResolver';
 
interface CacheEntry {
    result: PolicyAnalysisResult;
    mtimeMs: number;
}
 
export class PolicyAnalyzer {
    private variableResolver: VariableResolver;
    private resultCache: Map<string, CacheEntry> = new Map();
 
    constructor(variableResolver: VariableResolver) {
        this.variableResolver = variableResolver;
    }
 
    getCachedResult(uri: vscode.Uri): PolicyAnalysisResult | undefined {
        const entry = this.resultCache.get(uri.fsPath);
        if (!entry) { return undefined; }
 
        // Invalidate if file has been modified since last check
        try {
            const stat = fs.statSync(uri.fsPath);
            if (stat.mtimeMs !== entry.mtimeMs) {
                this.resultCache.delete(uri.fsPath);
                return undefined;
            }
        } catch {
            this.resultCache.delete(uri.fsPath);
            return undefined;
        }
 
        return entry.result;
    }
 
    clearCache(uri?: vscode.Uri): void {
        if (uri) {
            this.resultCache.delete(uri.fsPath);
        } else {
            this.resultCache.clear();
        }
    }
 
    private setCache(fsPath: string, result: PolicyAnalysisResult): void {
        try {
            const stat = fs.statSync(fsPath);
            this.resultCache.set(fsPath, { result, mtimeMs: stat.mtimeMs });
        } catch {
            this.resultCache.set(fsPath, { result, mtimeMs: 0 });
        }
    }
 
    async analyzeFile(uri: vscode.Uri): Promise<PolicyAnalysisResult> {
        const config = vscode.workspace.getConfiguration('terraformPolicyIamChecker');
        const managedLimit = config.get<number>('managedPolicyLimit', 6144);
        const inlineLimit = config.get<number>('inlinePolicyLimit', 10240);
        const warnThresholdPercent = config.get<number>('warnThresholdPercent', 90);
 
        const fileName = path.basename(uri.fsPath);
        const baseResult: Omit<PolicyAnalysisResult, 'status'> = {
            filePath: uri.fsPath,
            fileName,
            renderedSize: 0,
            managedLimit,
            inlineLimit,
            managedPercent: 0,
            inlinePercent: 0,
            statements: [],
            substitutionsUsed: {},
            warnThresholdPercent
        };
 
        // Read file
        let content: string;
        try {
            content = fs.readFileSync(uri.fsPath, 'utf-8');
        } catch (err) {
            const result: PolicyAnalysisResult = {
                ...baseResult,
                status: 'error',
                errorMessage: `Could not read file: ${err instanceof Error ? err.message : String(err)}`
            };
            this.setCache(uri.fsPath, result);
            return result;
        }
 
        // Empty file
        if (content.trim() === '') {
            const result: PolicyAnalysisResult = {
                ...baseResult,
                status: 'error',
                isEmpty: true,
                errorMessage: 'Empty file - nothing to check'
            };
            this.setCache(uri.fsPath, result);
            return result;
        }
 
        // Malformed ${ without closing }
        const malformedLines = this.variableResolver.findMalformed(content);
        if (malformedLines.length > 0) {
            const result: PolicyAnalysisResult = {
                ...baseResult,
                status: 'error',
                errorLine: malformedLines[0],
                errorMessage: `Malformed template: unclosed \${ on line ${malformedLines[0] + 1}`
            };
            this.setCache(uri.fsPath, result);
            return result;
        }
 
        // Extract and resolve variables
        const variables = this.variableResolver.extractVariables(content);
        let substitutions: Map<string, string> | null;
 
        if (variables.length === 0) {
            substitutions = new Map();
        } else {
            substitutions = await this.variableResolver.resolveVariables(variables);
        }
 
        // User cancelled variable prompt
        if (substitutions === null) {
            const result: PolicyAnalysisResult = {
                ...baseResult,
                status: 'skipped',
                skipped: true,
                errorMessage: 'Skipped - user cancelled variable input'
            };
            return result;
        }
 
        // Apply substitutions
        const rendered = this.variableResolver.applySubstitutions(content, substitutions);
 
        // Check for anything still unresolved
        const unresolved = this.variableResolver.findUnresolved(rendered);
        if (unresolved.length > 0) {
            const result: PolicyAnalysisResult = {
                ...baseResult,
                status: 'error',
                unresolvedVariables: unresolved,
                errorMessage: `Unresolved variables: ${unresolved.map(v => `\${${v}}`).join(', ')}`
            };
            this.setCache(uri.fsPath, result);
            return result;
        }
 
        // Parse JSON
        let parsed: any;
        try {
            parsed = JSON.parse(rendered);
        } catch (err) {
            const { line, column } = this.getJsonParseErrorPosition(rendered, err);
            const result: PolicyAnalysisResult = {
                ...baseResult,
                status: 'error',
                errorLine: line,
                errorColumn: column,
                errorMessage: `JSON syntax error on line ${line + 1}, col ${column + 1} - check for missing commas or brackets`
            };
            this.setCache(uri.fsPath, result);
            return result;
        }
 
        // No Statement array
        const noStatements = !parsed.Statement || !Array.isArray(parsed.Statement);
 
        // Minify and measure
        const minified = JSON.stringify(parsed);
        const renderedSize = minified.length;
        const managedPercent = Math.round((renderedSize / managedLimit) * 1000) / 10;
        const inlinePercent  = Math.round((renderedSize / inlineLimit)  * 1000) / 10;
 
        // Per-statement breakdown + duplicate + wildcard detection
        const statements: StatementBreakdown[] = [];
        const allWildcards: WildcardUsage[] = [];
        const allDuplicates: DuplicateAction[] = [];
 
        if (!noStatements) {
            (parsed.Statement as any[]).forEach((stmt, i) => {
                const sid = stmt.Sid || `Statement ${i + 1}`;
                const stmtMinified = JSON.stringify(stmt);
 
                // ── Duplicate action detection ────────────────────────────
                const duplicateActions: string[] = [];
                let duplicateActionSavings = 0;
 
                if (stmt.Action) {
                    const actions = Array.isArray(stmt.Action)
                        ? stmt.Action as string[]
                        : [stmt.Action as string];
 
                    // Count occurrences of each action
                    const actionCount = new Map<string, number>();
                    for (const action of actions) {
                        actionCount.set(action, (actionCount.get(action) || 0) + 1);
                    }
 
                    // Find duplicates
                    actionCount.forEach((count, action) => {
                        if (count > 1) {
                            duplicateActions.push(action);
                            // Each extra occurrence costs: length of action string
                            // + 2 for quotes + 1 for comma = quoted JSON element
                            const extraOccurrences = count - 1;
                            const wastedChars = extraOccurrences * (action.length + 3);
                            duplicateActionSavings += wastedChars;
 
                            allDuplicates.push({
                                sid,
                                action,
                                count,
                                wastedChars
                            });
                        }
                    });
                }
 
                // ── Wildcard detection ────────────────────────────────────
                const wildcardActions: string[] = [];
                const wildcardResources: string[] = [];
 
                // Check Action field for wildcards
                if (stmt.Action) {
                    const actions = Array.isArray(stmt.Action)
                        ? stmt.Action as string[]
                        : [stmt.Action as string];
 
                    for (const action of actions) {
                        if (action === '*' || action.endsWith(':*')) {
                            if (!wildcardActions.includes(action)) {
                                wildcardActions.push(action);
                                allWildcards.push({ sid, field: 'Action', value: action });
                            }
                        }
                    }
                }
 
                // Check Resource field for wildcards
                if (stmt.Resource) {
                    const resources = Array.isArray(stmt.Resource)
                        ? stmt.Resource as string[]
                        : [stmt.Resource as string];
 
                    for (const resource of resources) {
                        if (resource === '*') {
                            if (!wildcardResources.includes(resource)) {
                                wildcardResources.push(resource);
                                allWildcards.push({ sid, field: 'Resource', value: resource });
                            }
                        }
                    }
                }
 
                statements.push({
                    sid,
                    charCount: stmtMinified.length,
                    index: i,
                    duplicateActions: duplicateActions.length > 0 ? duplicateActions : undefined,
                    duplicateActionSavings: duplicateActionSavings > 0 ? duplicateActionSavings : undefined,
                    wildcardActions: wildcardActions.length > 0 ? wildcardActions : undefined,
                    wildcardResources: wildcardResources.length > 0 ? wildcardResources : undefined
                });
            });
 
            // Sort by size descending
            statements.sort((a, b) => b.charCount - a.charCount);
        }
 
        // Total chars saved if all duplicates removed
        const totalDuplicateSavings = allDuplicates.reduce((sum, d) => sum + d.wastedChars, 0);
 
        // Status
        let status: PolicyStatus;
        if (renderedSize > inlineLimit) {
            status = 'over_inline';
        } else if (renderedSize > managedLimit) {
            status = 'warn';
        } else {
            status = 'ok';
        }
 
        const substitutionsUsed: Record<string, string> = {};
        substitutions.forEach((v, k) => { substitutionsUsed[k] = v; });
 
        const result: PolicyAnalysisResult = {
            filePath: uri.fsPath,
            fileName,
            status,
            renderedSize,
            managedLimit,
            inlineLimit,
            managedPercent,
            inlinePercent,
            statements,
            substitutionsUsed,
            noStatements,
            warnThresholdPercent,
            wildcards: allWildcards.length > 0 ? allWildcards : undefined,
            duplicateActions: allDuplicates.length > 0 ? allDuplicates : undefined,
            totalDuplicateSavings: totalDuplicateSavings > 0 ? totalDuplicateSavings : undefined
        };
 
        this.setCache(uri.fsPath, result);
        return result;
    }
 
    private getJsonParseErrorPosition(json: string, err: unknown): { line: number; column: number } {
        const errMsg = err instanceof Error ? err.message : String(err);
        const posMatch = errMsg.match(/position (\d+)/);
 
        if (posMatch) {
            const pos = parseInt(posMatch[1], 10);
            const before = json.substring(0, pos);
            const line = (before.match(/\n/g) || []).length;
            const lastNewline = before.lastIndexOf('\n');
            return { line, column: pos - lastNewline - 1 };
        }
 
        return { line: 0, column: 0 };
    }
}