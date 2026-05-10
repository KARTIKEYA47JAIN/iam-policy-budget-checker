import * as vscode from 'vscode';
import { PolicyAnalyzer } from './analyzer';
import { VariableResolver } from './variableResolver';
import { PolicyAnalysisResult } from './types';

export class CodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

    private analyzer: PolicyAnalyzer;
    private variableResolver: VariableResolver;
    private decorationType: vscode.TextEditorDecorationType;
    private gutterWarning: vscode.TextEditorDecorationType;
    private gutterError: vscode.TextEditorDecorationType;

    constructor(analyzer: PolicyAnalyzer, variableResolver: VariableResolver) {
        this.analyzer = analyzer;
        this.variableResolver = variableResolver;

        this.decorationType = vscode.window.createTextEditorDecorationType({});

        this.gutterWarning = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.createGutterIcon('warning'),
            gutterIconSize: 'contain'
        });

        this.gutterError = vscode.window.createTextEditorDecorationType({
            gutterIconPath: this.createGutterIcon('error'),
            gutterIconSize: 'contain'
        });
    }

    refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    private createGutterIcon(type: 'warning' | 'error'): vscode.Uri {
        // Use VS Code's built-in theme icons via URI
        // We'll use a data URI for colored circle
        const color = type === 'warning' ? '%23f59e0b' : '%23ef4444';
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' width='16' height='16'><circle cx='8' cy='8' r='7' fill='${color}'/><text x='8' y='12' text-anchor='middle' font-size='10' fill='white' font-weight='bold'>${type === 'warning' ? '!' : '✕'}</text></svg>`;
        return vscode.Uri.parse(`data:image/svg+xml,${svg}`);
    }

    async provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): Promise<vscode.CodeLens[]> {
        if (!document.fileName.endsWith('.tftpl')) {
            return [];
        }

        const uri = document.uri;
        const cached = this.analyzer.getCachedResult(uri);

        if (!cached) {
            return [];
        }

        const lenses = this.buildCodeLenses(cached, uri);
        this.updateGutterDecorations(cached, document);
        return lenses;
    }

    private buildCodeLenses(result: PolicyAnalysisResult, uri: vscode.Uri): vscode.CodeLens[] {
        const range = new vscode.Range(0, 0, 0, 0);

        if (result.status === 'error' || result.status === 'skipped') {
            return [
                new vscode.CodeLens(range, {
                    title: `$(warning) IAM Policy: ${result.errorMessage || 'Error'}`,
                    command: ''
                })
            ];
        }

        let icon = '$(pass)';
        if (result.status === 'over_inline') {
            icon = '$(error)';
        } else if (result.status === 'warn') {
            icon = '$(warning)';
        }

        const title = `${icon} Size: ${result.renderedSize.toLocaleString()} chars   ·   aws_iam_policy limit: ${result.managedLimit.toLocaleString()} (${result.managedPercent}%)   ·   aws_iam_role_policy limit: ${result.inlineLimit.toLocaleString()} (${result.inlinePercent}%)`;

       return [
            new vscode.CodeLens(range, {
                title,
                command: ''
            })
        ];
    }

    private updateGutterDecorations(result: PolicyAnalysisResult, document: vscode.TextDocument): void {
        const editor = vscode.window.visibleTextEditors.find(
            e => e.document.uri.fsPath === document.uri.fsPath
        );
        if (!editor) { return; }

        // Clear existing decorations
        editor.setDecorations(this.gutterWarning, []);
        editor.setDecorations(this.gutterError, []);

        const range = new vscode.Range(0, 0, 0, 0);

        if (result.status === 'warn') {
            const overBy = result.renderedSize - result.managedLimit;
            editor.setDecorations(this.gutterWarning, [{
                range,
                hoverMessage: new vscode.MarkdownString(
                    `**Over managed policy limit** by ${overBy.toLocaleString()} chars.\n\nConsider switching to \`aws_iam_role_policy\` (inline limit: ${result.inlineLimit.toLocaleString()} chars).`
                )
            }]);
        } else if (result.status === 'over_inline') {
            const overBy = result.renderedSize - result.inlineLimit;
            editor.setDecorations(this.gutterError, [{
                range,
                hoverMessage: new vscode.MarkdownString(
                    `**Over inline policy limit** by ${overBy.toLocaleString()} chars. Policy must be split.`
                )
            }]);
        }
    }

    dispose(): void {
        this.decorationType.dispose();
        this.gutterWarning.dispose();
        this.gutterError.dispose();
        this._onDidChangeCodeLenses.dispose();
    }
}
