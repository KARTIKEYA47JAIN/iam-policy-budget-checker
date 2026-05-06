export type PolicyStatus = 'ok' | 'warn' | 'over_inline' | 'error' | 'skipped';

export interface StatementBreakdown {
    sid: string;
    charCount: number;
    index: number;
}

export interface PolicyAnalysisResult {
    filePath: string;
    fileName: string;
    status: PolicyStatus;
    renderedSize: number;
    managedLimit: number;
    inlineLimit: number;
    managedPercent: number;
    inlinePercent: number;
    statements: StatementBreakdown[];
    errorMessage?: string;
    errorLine?: number;
    errorColumn?: number;
    unresolvedVariables?: string[];
    substitutionsUsed: Record<string, string>;
    skipped?: boolean;
    isEmpty?: boolean;
    noStatements?: boolean;
    warnThresholdPercent: number;
}
