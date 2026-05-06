module.exports = {
    workspace: {
        getConfiguration: function(_section) {
            return {
                get: function(key, defaultValue) {
                    var defaults = {
                        'variableSubstitutions': {},
                        'rememberSessionVariables': true,
                        'managedPolicyLimit': 6144,
                        'inlinePolicyLimit': 10240,
                        'warnThresholdPercent': 90
                    };
                    return key in defaults ? defaults[key] : defaultValue;
                },
                update: function() { return Promise.resolve(); }
            };
        }
    },
    window: {
        showInputBox: function() { return Promise.resolve(undefined); },
        showQuickPick: function() { return Promise.resolve(undefined); },
        showWarningMessage: function() {},
        showErrorMessage: function() {},
        showInformationMessage: function() {}
    },
    ConfigurationTarget: { Workspace: 2, Global: 1, WorkspaceFolder: 3 },
    Uri: {
        file: function(p) { return { fsPath: p, path: p }; },
        parse: function(s) { return { fsPath: s, toString: function() { return s; } }; }
    },
    Range: function(start, end) {
        this.start = start;
        this.end = end;
    },
    Position: function(line, character) {
        this.line = line;
        this.character = character;
    }
};