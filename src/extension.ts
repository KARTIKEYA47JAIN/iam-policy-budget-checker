import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PolicyAnalyzer } from './analyzer';
import { ResultsPanelProvider } from './resultsPanel';
import { CodeLensProvider } from './codeLensProvider';
import { DiagnosticsProvider } from './diagnosticsProvider';
import { VariableResolver } from './variableResolver';

// Session-level variable cache
export const sessionVariables: Map<string, string> = new Map();

export function activate(context: vscode.ExtensionContext) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('terraform-iam-policy-checker');
    const diagnosticsProvider = new DiagnosticsProvider(diagnosticCollection);
    const variableResolver = new VariableResolver(sessionVariables);
    const analyzer = new PolicyAnalyzer(variableResolver);
    const codeLensProvider = new CodeLensProvider(analyzer, variableResolver);

    // Register CodeLens for .tftpl files
    const codeLensDisposable = vscode.languages.registerCodeLensProvider(
        { pattern: '**/*.tftpl' },
        codeLensProvider
    );

    // Command: Check current open file (from Command Palette)
    const checkCurrentFile = vscode.commands.registerCommand(
        'terraform-iam-policy-checker.checkCurrentFile',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('No active editor. Open a .tftpl file first.');
                return;
            }
            if (!editor.document.fileName.endsWith('.tftpl')) {
                vscode.window.showWarningMessage('Active file is not a .tftpl file.');
                return;
            }
            await runCheckOnFiles([editor.document.uri], diagnosticsProvider, analyzer);
        }
    );

    // Command: Check specific file (from explorer context menu)
    const checkFile = vscode.commands.registerCommand(
        'terraform-iam-policy-checker.checkFile',
        async (uri: vscode.Uri) => {
            if (!uri) {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('No file selected.');
                    return;
                }
                uri = editor.document.uri;
            }
            await runCheckOnFiles([uri], diagnosticsProvider, analyzer);
        }
    );

    // Command: Check all .tftpl files in a folder
    const checkFolder = vscode.commands.registerCommand(
        'terraform-iam-policy-checker.checkFolder',
        async (uri: vscode.Uri) => {
            if (!uri) {
                vscode.window.showErrorMessage('No folder selected.');
                return;
            }
            const tftplFiles = findTftplFiles(uri.fsPath);
            if (tftplFiles.length === 0) {
                vscode.window.showInformationMessage('No .tftpl files found in selected folder');
                return;
            }
            const fileUris = tftplFiles.map(f => vscode.Uri.file(f));
            await runCheckOnFiles(fileUris, diagnosticsProvider, analyzer);
        }
    );

    // Command: Check all .tftpl files in workspace
    const checkWorkspace = vscode.commands.registerCommand(
        'terraform-iam-policy-checker.checkWorkspace',
        async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showErrorMessage('No workspace folder open.');
                return;
            }
            const allFiles: vscode.Uri[] = [];
            for (const folder of workspaceFolders) {
                const files = findTftplFiles(folder.uri.fsPath);
                allFiles.push(...files.map(f => vscode.Uri.file(f)));
            }
            if (allFiles.length === 0) {
                vscode.window.showInformationMessage('No .tftpl files found in workspace');
                return;
            }
            await runCheckOnFiles(allFiles, diagnosticsProvider, analyzer);
        }
    );

    // Command: Open settings
    const openSettings = vscode.commands.registerCommand(
        'terraform-iam-policy-checker.openSettings',
        () => {
            vscode.commands.executeCommand(
                'workbench.action.openSettings',
                'terraformPolicyIamChecker'
            );
        }
    );

    // Command: Clear session variables
    const clearSessionVars = vscode.commands.registerCommand(
        'terraform-iam-policy-checker.clearSessionVariables',
        () => {
            sessionVariables.clear();
            vscode.window.showInformationMessage('IAM Policy Checker: Session variables cleared.');
        }
    );

    // Auto-check on save
    const onSaveDisposable = vscode.workspace.onDidSaveTextDocument(async (doc) => {
        const config = vscode.workspace.getConfiguration('terraformPolicyIamChecker');
        if (config.get<boolean>('autoCheckOnSave') && doc.fileName.endsWith('.tftpl')) {
            await runCheckOnFiles([doc.uri], diagnosticsProvider, analyzer);
        }
    });

    // Refresh CodeLens when active editor changes
    const onEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(() => {
        codeLensProvider.refresh();
    });

    context.subscriptions.push(
        diagnosticCollection,
        codeLensDisposable,
        checkCurrentFile,
        checkFile,
        checkFolder,
        checkWorkspace,
        openSettings,
        clearSessionVars,
        onSaveDisposable,
        onEditorChangeDisposable
    );
}

async function runCheckOnFiles(
    fileUris: vscode.Uri[],
    diagnosticsProvider: DiagnosticsProvider,
    analyzer: PolicyAnalyzer
): Promise<void> {
    const results = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Checking ${fileUris.length} IAM policy file(s)...`,
            cancellable: false
        },
        async (progress) => {
            const allResults = [];
            for (let i = 0; i < fileUris.length; i++) {
                progress.report({
                    message: `Analyzing ${path.basename(fileUris[i].fsPath)} (${i + 1}/${fileUris.length})`,
                    increment: (100 / fileUris.length)
                });
                const result = await analyzer.analyzeFile(fileUris[i]);
                allResults.push(result);
            }
            return allResults;
        }
    );

    // Update diagnostics
    for (const result of results) {
        diagnosticsProvider.updateDiagnostics(result);
    }

    // Show results panel
    ResultsPanelProvider.show(results);
}

function findTftplFiles(dirPath: string): string[] {
    const results: string[] = [];
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                results.push(...findTftplFiles(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.tftpl')) {
                results.push(fullPath);
            }
        }
    } catch (err) {
        // Skip unreadable directories
    }
    return results;
}

export function deactivate() {}