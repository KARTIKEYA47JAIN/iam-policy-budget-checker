import * as vscode from 'vscode';
import { PolicyAnalysisResult } from './types';
 
export class ResultsPanelProvider {
    private static panel: vscode.WebviewPanel | undefined;
 
    static show(results: PolicyAnalysisResult[]): void {
        const column = vscode.ViewColumn.Beside;
 
        if (ResultsPanelProvider.panel) {
            ResultsPanelProvider.panel.reveal(column);
            ResultsPanelProvider.panel.webview.html = ResultsPanelProvider.buildHtml(results);
        } else {
            ResultsPanelProvider.panel = vscode.window.createWebviewPanel(
                'iamPolicyBudgetReport',
                'IAM Policy Characters Report',
                column,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );
            ResultsPanelProvider.panel.onDidDispose(() => {
                ResultsPanelProvider.panel = undefined;
            });
            ResultsPanelProvider.panel.webview.html = ResultsPanelProvider.buildHtml(results);
        }
 
        ResultsPanelProvider.panel.webview.onDidReceiveMessage((msg) => {
            if (msg.command === 'openFile') {
                vscode.commands.executeCommand('vscode.open', vscode.Uri.file(msg.filePath));
            } else if (msg.command === 'openSettings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'terraformPolicyIamChecker');
            }
        });
    }
 
    private static buildHtml(results: PolicyAnalysisResult[]): string {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const withinManaged = results.filter(r => r.status === 'ok').length;
        const total = results.length;
        const cardsHtml = results.map((r, idx) => ResultsPanelProvider.buildCard(r, idx)).join('');
 
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>IAM Policy Characters Report</title>
<style>
  :root {
    --bg: var(--vscode-editor-background, #1e1e2e);
    --bg-card: var(--vscode-sideBar-background, #181825);
    --bg-card2: var(--vscode-editorWidget-background, #1e1e2e);
    --border: var(--vscode-panel-border, #313244);
    --text: var(--vscode-editor-foreground, #cdd6f4);
    --text-dim: var(--vscode-descriptionForeground, #6c7086);
    --text-head: var(--vscode-titleBar-activeForeground, #cba6f7);
    --green: #a6e3a1;
    --yellow: #f9e2af;
    --red: #f38ba8;
    --blue: #89b4fa;
    --surface0: #313244;
    --overlay0: #6c7086;
    --font-mono: var(--vscode-editor-font-family, 'JetBrains Mono', 'Cascadia Code', monospace);
    --font-ui: var(--vscode-font-family, 'Segoe UI', system-ui, sans-serif);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: var(--font-ui); font-size: 13px; line-height: 1.5; }
 
  .header { background: var(--bg-card); border-bottom: 1px solid var(--border); padding: 16px 20px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; position: sticky; top: 0; z-index: 100; }
  .header-left { display: flex; align-items: center; gap: 10px; }
  .header-icon { font-size: 20px; }
  .header-title { font-size: 15px; font-weight: 600; color: var(--text-head); }
  .header-subtitle { font-size: 11px; color: var(--text-dim); margin-top: 1px; }
  .header-right { display: flex; align-items: center; gap: 10px; }
 
  .summary-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; border: 1px solid; }
  .summary-badge.all-ok { background: rgba(166,227,161,0.12); border-color: rgba(166,227,161,0.35); color: var(--green); }
  .summary-badge.some-fail { background: rgba(243,139,168,0.10); border-color: rgba(243,139,168,0.30); color: var(--red); }
 
  .btn-settings { background: var(--surface0); border: 1px solid var(--border); color: var(--text-dim); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; font-family: var(--font-ui); transition: all 0.15s; }
  .btn-settings:hover { background: var(--overlay0); color: var(--text); }
 
  .content { padding: 16px 20px 40px; display: flex; flex-direction: column; gap: 14px; max-width: 900px; }
 
  .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .card.status-ok    { border-left: 3px solid var(--green); }
  .card.status-warn  { border-left: 3px solid var(--yellow); }
  .card.status-over  { border-left: 3px solid var(--red); }
  .card.status-error { border-left: 3px solid var(--overlay0); }
  .card.status-skip  { border-left: 3px solid var(--overlay0); opacity: 0.7; }
 
  .card-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px 10px; gap: 10px; }
  .card-filename { display: flex; align-items: center; gap: 7px; font-family: var(--font-mono); font-size: 12px; font-weight: 600; color: var(--blue); cursor: pointer; text-decoration: none; }
  .card-filename:hover { text-decoration: underline; }
  .file-icon { font-size: 14px; }
 
  .card-body { padding: 0 16px 14px; display: flex; flex-direction: column; gap: 10px; }
 
  .size-display { display: flex; align-items: baseline; gap: 6px; }
  .size-label { font-size: 11px; color: var(--text-dim); min-width: 100px; }
  .size-value { font-family: var(--font-mono); font-size: 20px; font-weight: 700; color: var(--text); letter-spacing: -0.03em; }
  .size-unit { font-size: 11px; color: var(--text-dim); }
 
  .divider { height: 1px; background: var(--border); margin: 2px 0; }
 
  .bars-section { display: flex; flex-direction: column; gap: 7px; }
  .bar-row { display: grid; grid-template-columns: 70px 1fr 44px; align-items: center; gap: 8px; }
  .bar-label { font-size: 10px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em; text-align: right; line-height: 1.2; }
  .bar-label span { display: block; font-weight: 600; color: var(--overlay0); font-size: 9px; }
  .bar-track { height: 10px; background: var(--surface0); border-radius: 5px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 5px; transition: width 0.4s cubic-bezier(0.4,0,0.2,1); min-width: 2px; }
  .bar-fill.green  { background: var(--green); }
  .bar-fill.yellow { background: var(--yellow); }
  .bar-fill.red    { background: var(--red); }
  .bar-fill.gray   { background: var(--overlay0); }
  .bar-pct { font-family: var(--font-mono); font-size: 11px; font-weight: 600; text-align: right; }
  .bar-pct.green  { color: var(--green); }
  .bar-pct.yellow { color: var(--yellow); }
  .bar-pct.red    { color: var(--red); }
  .bar-pct.gray   { color: var(--overlay0); }
 
  .status-line { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 5px; font-size: 12px; font-weight: 600; }
  .status-line.ok   { background: rgba(166,227,161,0.08); border: 1px solid rgba(166,227,161,0.2); color: var(--green); }
  .status-line.warn { background: rgba(249,226,175,0.08); border: 1px solid rgba(249,226,175,0.2); color: var(--yellow); }
  .status-line.over { background: rgba(243,139,168,0.08); border: 1px solid rgba(243,139,168,0.2); color: var(--red); }
  .status-line.error { background: rgba(108,112,134,0.12); border: 1px solid rgba(108,112,134,0.2); color: var(--text-dim); }
  .status-icon { font-size: 15px; }
  .status-note { font-size: 11px; font-weight: 400; opacity: 0.8; margin-top: 1px; display: block; }
 
  /* ── Issues section (wildcards + duplicates) ── */
  .issues-section { display: flex; flex-direction: column; gap: 6px; }
  .issues-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); margin-bottom: 2px; }
 
  .issue-row { display: flex; align-items: flex-start; gap: 8px; padding: 7px 10px; border-radius: 5px; font-size: 11px; }
  .issue-row.wildcard { background: rgba(249,226,175,0.06); border: 1px solid rgba(249,226,175,0.18); }
  .issue-row.duplicate { background: rgba(137,180,250,0.06); border: 1px solid rgba(137,180,250,0.18); }
 
  .issue-icon { font-size: 13px; flex-shrink: 0; margin-top: 1px; }
  .issue-body { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .issue-main { color: var(--text); font-weight: 500; }
  .issue-detail { color: var(--text-dim); font-size: 10px; font-family: var(--font-mono); }
  .issue-saving { color: var(--blue); font-size: 10px; font-weight: 600; margin-top: 1px; }
 
  .savings-callout { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 5px; font-size: 11px; background: rgba(137,180,250,0.08); border: 1px solid rgba(137,180,250,0.22); color: var(--blue); font-weight: 600; }
 
  /* ── Statement breakdown ── */
  .breakdown-toggle { display: flex; align-items: center; justify-content: space-between; cursor: pointer; padding: 6px 12px; border-radius: 5px; background: var(--bg-card2); border: 1px solid var(--border); font-size: 11px; color: var(--text-dim); user-select: none; transition: all 0.15s; }
  .breakdown-toggle:hover { border-color: var(--overlay0); color: var(--text); }
  .breakdown-toggle .toggle-arrow { transition: transform 0.2s; font-size: 10px; }
  .breakdown-toggle.open .toggle-arrow { transform: rotate(180deg); }
  .breakdown-content { display: none; flex-direction: column; background: var(--bg-card2); border: 1px solid var(--border); border-top: none; border-radius: 0 0 5px 5px; overflow: hidden; }
  .breakdown-content.open { display: flex; }
 
  .stmt-row { display: grid; grid-template-columns: 1fr auto auto; align-items: start; gap: 10px; padding: 6px 12px; border-bottom: 1px solid rgba(49,50,68,0.5); }
  .stmt-row:last-child { border-bottom: none; }
  .stmt-row:hover { background: rgba(49,50,68,0.5); }
  .stmt-sid-col { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .stmt-sid { font-family: var(--font-mono); font-size: 11px; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .stmt-badges { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
  .stmt-badge { font-size: 9px; padding: 1px 5px; border-radius: 3px; font-family: var(--font-mono); }
  .stmt-badge.dup  { background: rgba(137,180,250,0.12); border: 1px solid rgba(137,180,250,0.25); color: var(--blue); }
  .stmt-badge.wild { background: rgba(249,226,175,0.12); border: 1px solid rgba(249,226,175,0.25); color: var(--yellow); }
  .stmt-chars { font-family: var(--font-mono); font-size: 11px; font-weight: 600; color: var(--blue); white-space: nowrap; }
  .stmt-mini-bar { width: 60px; height: 4px; background: var(--surface0); border-radius: 2px; overflow: hidden; margin-top: 4px; }
  .stmt-mini-fill { height: 100%; border-radius: 2px; background: var(--blue); opacity: 0.7; }
 
  .empty-state { text-align: center; padding: 60px 20px; color: var(--text-dim); }
  .empty-icon { font-size: 48px; margin-bottom: 12px; }
 
  .error-detail { font-family: var(--font-mono); font-size: 11px; background: var(--bg-card2); border: 1px solid var(--border); border-radius: 4px; padding: 8px 10px; color: var(--red); word-break: break-all; }
  .unresolved-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
  .unresolved-tag { font-family: var(--font-mono); font-size: 10px; background: rgba(249,226,175,0.12); border: 1px solid rgba(249,226,175,0.25); color: var(--yellow); padding: 1px 6px; border-radius: 3px; }
  .no-stmt-warn { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--yellow); padding: 5px 8px; background: rgba(249,226,175,0.06); border: 1px solid rgba(249,226,175,0.15); border-radius: 4px; }
 
  .subs-used { font-size: 10px; color: var(--text-dim); background: var(--bg-card2); border: 1px solid var(--border); border-radius: 4px; padding: 6px 10px; }
  .subs-used summary { cursor: pointer; user-select: none; color: var(--overlay0); font-size: 10px; }
  .subs-used summary:hover { color: var(--text-dim); }
  .subs-grid { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; margin-top: 6px; font-family: var(--font-mono); }
  .subs-key { color: var(--overlay0); }
  .subs-val { color: var(--text); overflow: hidden; text-overflow: ellipsis; }
 
  @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .card { animation: slideIn 0.2s ease both; }
  .card:nth-child(1) { animation-delay: 0.00s; }
  .card:nth-child(2) { animation-delay: 0.04s; }
  .card:nth-child(3) { animation-delay: 0.08s; }
  .card:nth-child(4) { animation-delay: 0.12s; }
  .card:nth-child(5) { animation-delay: 0.16s; }
  .card:nth-child(n+6) { animation-delay: 0.20s; }
</style>
</head>
<body>
 
<div class="header">
  <div class="header-left">
    <div class="header-icon">🛡️</div>
    <div>
      <div class="header-title">IAM Policy Characters Report</div>
      <div class="header-subtitle">Checked at ${timeStr} &nbsp;·&nbsp; ${total} file${total !== 1 ? 's' : ''} analyzed</div>
    </div>
  </div>
  <div class="header-right">
    ${ResultsPanelProvider.buildSummaryBadge(withinManaged, total)}
    <button class="btn-settings" onclick="openSettings()">⚙ Settings</button>
  </div>
</div>
 
<div class="content">
${total === 0
    ? `<div class="empty-state"><div class="empty-icon">🗂️</div><div>No files to display</div></div>`
    : cardsHtml}
</div>
 
<script>
  const vscode = acquireVsCodeApi();
  function openFile(fp)   { vscode.postMessage({ command: 'openFile', filePath: fp }); }
  function openSettings() { vscode.postMessage({ command: 'openSettings' }); }
 
  function toggleBreakdown(id) {
    const btn  = document.getElementById('toggle-' + id);
    const pane = document.getElementById('content-' + id);
    if (!btn || !pane) return;
    const open = btn.classList.toggle('open');
    pane.classList.toggle('open', open);
  }
 
  document.querySelectorAll('.bar-fill').forEach(el => {
    const w = el.dataset.width;
    el.style.width = '0%';
    requestAnimationFrame(() => setTimeout(() => { el.style.width = w + '%'; }, 50));
  });
</script>
</body>
</html>`;
    }
 
    private static buildSummaryBadge(withinManaged: number, total: number): string {
        const allOk = withinManaged === total;
        return `<div class="summary-badge ${allOk ? 'all-ok' : 'some-fail'}">${allOk ? '✅' : '⚠️'} ${withinManaged}/${total} within managed limit</div>`;
    }
 
    private static buildCard(result: PolicyAnalysisResult, idx: number): string {
        const statusClass = ({ ok: 'status-ok', warn: 'status-warn', over_inline: 'status-over', error: 'status-error', skipped: 'status-skip' } as any)[result.status] || 'status-error';
 
        const header = `
        <div class="card-header">
          <a class="card-filename" onclick="openFile(${JSON.stringify(result.filePath)})" title="${escapeHtml(result.filePath)}">
            <span class="file-icon">📄</span>${escapeHtml(result.fileName)}
          </a>
        </div>`;
 
        if (result.status === 'error' || result.status === 'skipped') {
            return `<div class="card ${statusClass}">
              ${header}
              <div class="card-body">
                <div class="status-line error">
                  <span class="status-icon">⚪</span>
                  <div>
                    <span>${result.isEmpty ? 'Empty file - nothing to check' : result.skipped ? 'Skipped - unresolved variables' : 'Error'}</span>
                    ${result.errorMessage ? `<span class="status-note">${escapeHtml(result.errorMessage)}</span>` : ''}
                  </div>
                </div>
                ${result.unresolvedVariables && result.unresolvedVariables.length > 0 ? `
                  <div>
                    <div style="font-size:11px;color:var(--text-dim);margin-bottom:4px;">Unresolved variables:</div>
                    <div class="unresolved-list">${result.unresolvedVariables.map(v => `<span class="unresolved-tag">\${${escapeHtml(v)}}</span>`).join('')}</div>
                  </div>` : ''}
                ${result.errorLine !== undefined ? `<div class="error-detail">Line ${result.errorLine + 1}${result.errorColumn !== undefined ? `, col ${result.errorColumn + 1}` : ''}: ${escapeHtml(result.errorMessage || 'Parse error')}</div>` : ''}
              </div>
            </div>`;
        }
 
        const mColor = result.renderedSize > result.managedLimit ? 'red'
            : result.managedPercent >= result.warnThresholdPercent ? 'yellow'
            : 'green';
        const iColor = result.renderedSize > result.inlineLimit ? 'red'
            : result.inlinePercent >= result.warnThresholdPercent ? 'yellow'
            : 'green';
        const mPct = Math.min(result.managedPercent, 100);
        const iPct = Math.min(result.inlinePercent, 100);
 
        const statusLine = ResultsPanelProvider.buildStatusLine(result);
        const issuesSection = ResultsPanelProvider.buildIssuesSection(result);
        const stmtBreakdown = result.statements.length > 0 ? ResultsPanelProvider.buildStatementBreakdown(result, idx) : '';
        const subsSection = Object.keys(result.substitutionsUsed).length > 0 ? ResultsPanelProvider.buildSubstitutionsSection(result.substitutionsUsed) : '';
        const noStmtWarn = result.noStatements ? `<div class="no-stmt-warn">⚠️ No Statement array found - is this an IAM policy document?</div>` : '';
 
        return `<div class="card ${statusClass}">
          ${header}
          <div class="card-body">
            <div class="size-display">
              <span class="size-label">Rendered size</span>
              <span class="size-value">${result.renderedSize.toLocaleString()}</span>
              <span class="size-unit">chars</span>
            </div>
            <div class="divider"></div>
            <div class="bars-section">
              <div class="bar-row">
                <div class="bar-label">Managed<span>${result.managedLimit.toLocaleString()}</span></div>
                <div class="bar-track"><div class="bar-fill ${mColor}" data-width="${mPct}" style="width:0%"></div></div>
                <div class="bar-pct ${mColor}">${result.managedPercent}%</div>
              </div>
              <div class="bar-row">
                <div class="bar-label">Inline<span>${result.inlineLimit.toLocaleString()}</span></div>
                <div class="bar-track"><div class="bar-fill ${iColor}" data-width="${iPct}" style="width:0%"></div></div>
                <div class="bar-pct ${iColor}">${result.inlinePercent}%</div>
              </div>
            </div>
            <div class="divider"></div>
            ${statusLine}
            ${issuesSection}
            ${noStmtWarn}
            ${stmtBreakdown}
            ${subsSection}
          </div>
        </div>`;
    }
 
    private static buildIssuesSection(result: PolicyAnalysisResult): string {
        const hasWildcards = result.wildcards && result.wildcards.length > 0;
        const hasDuplicates = result.duplicateActions && result.duplicateActions.length > 0;
 
        if (!hasWildcards && !hasDuplicates) { return ''; }
 
        const rows: string[] = [];
 
        // ── Wildcard rows ─────────────────────────────────────────────────
        if (hasWildcards && result.wildcards) {
            // Group by sid for cleaner display
            const bySid = new Map<string, { actions: string[], resources: string[] }>();
            for (const w of result.wildcards) {
                if (!bySid.has(w.sid)) { bySid.set(w.sid, { actions: [], resources: [] }); }
                if (w.field === 'Action') { bySid.get(w.sid)!.actions.push(w.value); }
                else { bySid.get(w.sid)!.resources.push(w.value); }
            }
 
            bySid.forEach((fields, sid) => {
                const details: string[] = [];
                if (fields.actions.length > 0) {
                    details.push(`Action: ${fields.actions.map(a => escapeHtml(a)).join(', ')}`);
                }
                if (fields.resources.length > 0) {
                    details.push(`Resource: *`);
                }
                rows.push(`<div class="issue-row wildcard">
                  <span class="issue-icon">⚠️</span>
                  <div class="issue-body">
                    <span class="issue-main">Wildcard in <strong>${escapeHtml(sid)}</strong></span>
                    <span class="issue-detail">${details.join(' · ')}</span>
                  </div>
                </div>`);
            });
        }
 
        // ── Duplicate rows ────────────────────────────────────────────────
        if (hasDuplicates && result.duplicateActions) {
            for (const dup of result.duplicateActions) {
                rows.push(`<div class="issue-row duplicate">
                  <span class="issue-icon">🔁</span>
                  <div class="issue-body">
                    <span class="issue-main">Duplicate action in <strong>${escapeHtml(dup.sid)}</strong></span>
                    <span class="issue-detail">${escapeHtml(dup.action)} appears ${dup.count}x</span>
                    <span class="issue-saving">Remove ${dup.count - 1} duplicate${dup.count > 2 ? 's' : ''} - saves ~${dup.wastedChars} chars</span>
                  </div>
                </div>`);
            }
 
            // Show total savings callout if meaningful
            if (result.totalDuplicateSavings && result.totalDuplicateSavings > 0) {
                const wouldBe = result.renderedSize - result.totalDuplicateSavings;
                const underManaged = wouldBe <= result.managedLimit;
                const savingsNote = underManaged
                    ? `would bring policy to ${wouldBe.toLocaleString()} chars - within managed limit`
                    : `would reduce policy to ${wouldBe.toLocaleString()} chars`;
 
                rows.push(`<div class="savings-callout">
                  <span>💡</span>
                  <span>Removing all duplicates saves ~${result.totalDuplicateSavings} chars total · ${savingsNote}</span>
                </div>`);
            }
        }
 
        return `<div class="issues-section">
          <div class="issues-title">Issues found</div>
          ${rows.join('')}
        </div>`;
    }
 
    private static buildStatusLine(result: PolicyAnalysisResult): string {
        if (result.status === 'ok') {
            const rem = result.managedLimit - result.renderedSize;
            return `<div class="status-line ok"><span class="status-icon">✅</span>
              <div>WITHIN MANAGED LIMIT <span class="status-note">+${rem.toLocaleString()} chars remaining</span></div>
            </div>`;
        } else if (result.status === 'warn') {
            const over = result.renderedSize - result.managedLimit;
            const remI = result.inlineLimit - result.renderedSize;
            return `<div class="status-line warn"><span class="status-icon">⚠️</span>
              <div>OVER MANAGED LIMIT
                <span class="status-note">+${over.toLocaleString()} over managed · ${remI.toLocaleString()} remaining inline</span>
                <span class="status-note">Use <code>aws_iam_role_policy</code> (inline) instead of <code>aws_iam_policy</code> (managed)</span>
              </div>
            </div>`;
        } else if (result.status === 'over_inline') {
            const over = result.renderedSize - result.inlineLimit;
            return `<div class="status-line over"><span class="status-icon">🔴</span>
              <div>OVER INLINE LIMIT
                <span class="status-note">+${over.toLocaleString()} over inline limit</span>
                <span class="status-note">Must split into multiple policies</span>
              </div>
            </div>`;
        }
        return '';
    }
 
    private static buildStatementBreakdown(result: PolicyAnalysisResult, idx: number): string {
        const id = `breakdown-${idx}`;
 
        // Count how many statements have issues for the toggle label
        const stmtsWithIssues = result.statements.filter(
            s => (s.duplicateActions && s.duplicateActions.length > 0) ||
                 (s.wildcardActions && s.wildcardActions.length > 0) ||
                 (s.wildcardResources && s.wildcardResources.length > 0)
        ).length;
 
        const toggleLabel = stmtsWithIssues > 0
            ? `Statement breakdown (${result.statements.length} statements · ${stmtsWithIssues} with issues)`
            : `Statement breakdown (${result.statements.length} statements)`;
 
        const rows = result.statements.map(stmt => {
            const pct = Math.min(Math.round((stmt.charCount / result.renderedSize) * 100), 100);
 
            // Build badges for this statement
            const badges: string[] = [];
            if (stmt.duplicateActions && stmt.duplicateActions.length > 0) {
                badges.push(`<span class="stmt-badge dup">🔁 ${stmt.duplicateActions.length} dup</span>`);
            }
            if ((stmt.wildcardActions && stmt.wildcardActions.length > 0) ||
                (stmt.wildcardResources && stmt.wildcardResources.length > 0)) {
                const wCount = (stmt.wildcardActions?.length || 0) + (stmt.wildcardResources?.length || 0);
                badges.push(`<span class="stmt-badge wild">⚠️ ${wCount} wildcard</span>`);
            }
 
            return `<div class="stmt-row">
              <div class="stmt-sid-col">
                <span class="stmt-sid">${escapeHtml(stmt.sid)}</span>
                ${badges.length > 0 ? `<div class="stmt-badges">${badges.join('')}</div>` : ''}
              </div>
              <div class="stmt-chars">${stmt.charCount.toLocaleString()} chars</div>
              <div class="stmt-mini-bar"><div class="stmt-mini-fill" style="width:${pct}%"></div></div>
            </div>`;
        }).join('');
 
        return `<div>
          <div class="breakdown-toggle" id="toggle-${id}" onclick="toggleBreakdown('${id}')">
            <span class="toggle-label">${toggleLabel}</span>
            <span class="toggle-arrow">▼</span>
          </div>
          <div class="breakdown-content" id="content-${id}">${rows}</div>
        </div>`;
    }
 
    private static buildSubstitutionsSection(subs: Record<string, string>): string {
        const entries = Object.entries(subs);
        if (entries.length === 0) { return ''; }
        const rows = entries.map(([k, v]) =>
            `<div class="subs-key">\${${escapeHtml(k)}}</div><div class="subs-val">${escapeHtml(v)}</div>`
        ).join('');
        return `<details class="subs-used">
          <summary>▸ Substitutions used (${entries.length})</summary>
          <div class="subs-grid">${rows}</div>
        </details>`;
    }
}
 
function escapeHtml(str: string): string {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}