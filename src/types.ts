export type PolicyStatus = 'ok' | 'warn' | 'over_inline' | 'error' | 'skipped';
 
export interface StatementBreakdown {
    sid: string;
    charCount: number;
    index: number;
    duplicateActions?: string[];     // actions that appear more than once in this statement
    duplicateActionSavings?: number; // chars saved if duplicates removed
    wildcardActions?: string[];      // action values that are or contain *
    wildcardResources?: string[];    // resource values that are *
}
 
export interface WildcardUsage {
    sid: string;           // which statement
    field: 'Action' | 'Resource';
    value: string;         // the wildcard value e.g. "s3:*" or "*"
}
 
export interface DuplicateAction {
    sid: string;           // which statement
    action: string;        // the duplicated action e.g. "ecr:CreateRepository"
    count: number;         // how many times it appears
    wastedChars: number;   // chars wasted by the extra occurrences
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
    wildcards?: WildcardUsage[];           // all wildcard usages found
    duplicateActions?: DuplicateAction[];  // all duplicate actions found
    totalDuplicateSavings?: number;        // total chars saved if all duplicates removed
}
 