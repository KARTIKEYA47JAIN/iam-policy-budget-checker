import * as vscode from 'vscode';
import { PolicyAnalysisResult } from './types';

export class DiagnosticsProvider {
    private collection: vscode.DiagnosticCollection;

    constructor(collection: vscode.DiagnosticCollection) {
        this.collection = collection;
    }

    updateDiagnostics(result: PolicyAnalysisResult): void {
        const uri = vscode.Uri.file(result.filePath);
        const diagnostics: vscode.Diagnostic[] = [];

        if (result.status === 'error') {
            const line = result.errorLine ?? 0;
            const col = result.errorColumn ?? 0;
            const range = new vscode.Range(line, col, line, col + 10);
            const diag = new vscode.Diagnostic(
                range,
                result.errorMessage || 'IAM Policy error',
                vscode.DiagnosticSeverity.Error
            );
            diag.source = 'IAM Policy Checker';
            diagnostics.push(diag);
        } else if (result.status === 'over_inline') {
            const overBy = result.renderedSize - result.inlineLimit;
            const range = new vscode.Range(0, 0, 0, 0);
            const diag = new vscode.Diagnostic(
                range,
                `IAM Policy is ${overBy.toLocaleString()} chars over inline limit (${result.inlineLimit.toLocaleString()}). Policy must be split.`,
                vscode.DiagnosticSeverity.Error
            );
            diag.source = 'IAM Policy Checker';
            diagnostics.push(diag);
        } else if (result.status === 'warn') {
            const overBy = result.renderedSize - result.managedLimit;
            const range = new vscode.Range(0, 0, 0, 0);
            const diag = new vscode.Diagnostic(
                range,
                `IAM Policy is ${overBy.toLocaleString()} chars over managed limit. Consider aws_iam_role_policy (inline).`,
                vscode.DiagnosticSeverity.Warning
            );
            diag.source = 'IAM Policy Checker';
            diagnostics.push(diag);
        } else if (result.status === 'skipped') {
            const range = new vscode.Range(0, 0, 0, 0);
            const diag = new vscode.Diagnostic(
                range,
                'IAM Policy check skipped - unresolved variables',
                vscode.DiagnosticSeverity.Information
            );
            diag.source = 'IAM Policy Checker';
            diagnostics.push(diag);
        }

        // Warn for unresolved variables
        if (result.unresolvedVariables && result.unresolvedVariables.length > 0) {
            const range = new vscode.Range(0, 0, 0, 0);
            const diag = new vscode.Diagnostic(
                range,
                `Unresolved template variables: ${result.unresolvedVariables.map(v => `\${${v}}`).join(', ')}`,
                vscode.DiagnosticSeverity.Warning
            );
            diag.source = 'IAM Policy Checker';
            diagnostics.push(diag);
        }

        // Warn for no Statement key
        if (result.noStatements) {
            const range = new vscode.Range(0, 0, 0, 0);
            const diag = new vscode.Diagnostic(
                range,
                'No Statement array found - is this an IAM policy document?',
                vscode.DiagnosticSeverity.Warning
            );
            diag.source = 'IAM Policy Checker';
            diagnostics.push(diag);
        }

        this.collection.set(uri, diagnostics);
    }

    clear(uri?: vscode.Uri): void {
        if (uri) {
            this.collection.delete(uri);
        } else {
            this.collection.clear();
        }
    }
}
