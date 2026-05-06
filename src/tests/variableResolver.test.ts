/**
 * Unit tests for VariableResolver
 *
 * These test pure logic methods that do not touch the VSCode API.
 * They run with plain Node.js — no Extension Development Host needed.
 *
 * Run with: npm test
 */

import * as assert from 'assert';
import { VariableResolver } from '../variableResolver';

// VariableResolver needs a session Map — give it an empty one for tests
// that don't care about caching, or a pre-filled one for cache tests.
function makeResolver(sessionVars?: Map<string, string>): VariableResolver {
    return new VariableResolver(sessionVars ?? new Map());
}

// ─────────────────────────────────────────────────────────────────────────────
// extractVariables
// ─────────────────────────────────────────────────────────────────────────────

suite('VariableResolver — extractVariables', () => {

    test('finds a single variable', () => {
        const resolver = makeResolver();
        const vars = resolver.extractVariables('{"Resource": "${bucket_name}"}');
        assert.deepStrictEqual(vars, ['bucket_name']);
    });

    test('finds multiple different variables', () => {
        const resolver = makeResolver();
        const content = '{"Resource": "arn:aws:s3:::${bucket_name}/${project_name}/*"}';
        const vars = resolver.extractVariables(content);
        assert.ok(vars.includes('bucket_name'), 'should include bucket_name');
        assert.ok(vars.includes('project_name'), 'should include project_name');
        assert.strictEqual(vars.length, 2);
    });

    test('deduplicates variables that appear multiple times', () => {
        const resolver = makeResolver();
        // bucket_name appears twice — should only be returned once
        const content = '"${bucket_name}/a", "${bucket_name}/b"';
        const vars = resolver.extractVariables(content);
        assert.strictEqual(vars.filter(v => v === 'bucket_name').length, 1);
    });

    test('returns empty array when no variables present', () => {
        const resolver = makeResolver();
        const vars = resolver.extractVariables('{"Version": "2012-10-17"}');
        assert.deepStrictEqual(vars, []);
    });

    test('handles empty string', () => {
        const resolver = makeResolver();
        const vars = resolver.extractVariables('');
        assert.deepStrictEqual(vars, []);
    });

    test('finds variable with underscores and numbers', () => {
        const resolver = makeResolver();
        const vars = resolver.extractVariables('${aws_account_id_123}');
        assert.deepStrictEqual(vars, ['aws_account_id_123']);
    });

});

// ─────────────────────────────────────────────────────────────────────────────
// applySubstitutions
// ─────────────────────────────────────────────────────────────────────────────

suite('VariableResolver — applySubstitutions', () => {

    test('replaces a single variable', () => {
        const resolver = makeResolver();
        const subs = new Map([['bucket_name', 'my-real-bucket']]);
        const result = resolver.applySubstitutions(
            '{"Resource": "arn:aws:s3:::${bucket_name}/*"}',
            subs
        );
        assert.ok(result.includes('my-real-bucket'));
        assert.ok(!result.includes('${bucket_name}'));
    });

    test('replaces all occurrences of the same variable', () => {
        const resolver = makeResolver();
        const subs = new Map([['region', 'eu-central-1']]);
        const result = resolver.applySubstitutions(
            '"${region}" and "${region}" again',
            subs
        );
        // Both occurrences replaced
        assert.strictEqual(result, '"eu-central-1" and "eu-central-1" again');
    });

    test('replaces multiple different variables', () => {
        const resolver = makeResolver();
        const subs = new Map([
            ['region', 'eu-central-1'],
            ['account_id', '123456789012']
        ]);
        const result = resolver.applySubstitutions(
            '"${region}:${account_id}"',
            subs
        );
        assert.strictEqual(result, '"eu-central-1:123456789012"');
    });

    test('leaves content unchanged when substitutions map is empty', () => {
        const resolver = makeResolver();
        const original = '{"Resource": "${bucket_name}"}';
        const result = resolver.applySubstitutions(original, new Map());
        assert.strictEqual(result, original);
    });

    test('handles variable whose value contains special regex characters', () => {
        const resolver = makeResolver();
        // Value contains dots and slashes which are special in regex
        const subs = new Map([['arn', 'arn:aws:iam::123456789012:role/my.role']]);
        const result = resolver.applySubstitutions('"${arn}"', subs);
        assert.strictEqual(result, '"arn:aws:iam::123456789012:role/my.role"');
    });

});

// ─────────────────────────────────────────────────────────────────────────────
// findUnresolved
// ─────────────────────────────────────────────────────────────────────────────

suite('VariableResolver — findUnresolved', () => {

    test('returns empty array when all variables resolved', () => {
        const resolver = makeResolver();
        const result = resolver.findUnresolved('{"Resource": "arn:aws:s3:::my-bucket/*"}');
        assert.deepStrictEqual(result, []);
    });

    test('returns remaining variable names after partial substitution', () => {
        const resolver = makeResolver();
        // bucket_name was substituted but region was not
        const result = resolver.findUnresolved('"my-bucket/${region}/object"');
        assert.deepStrictEqual(result, ['region']);
    });

    test('detects multiple unresolved variables', () => {
        const resolver = makeResolver();
        const result = resolver.findUnresolved('"${region}:${account_id}"');
        assert.ok(result.includes('region'));
        assert.ok(result.includes('account_id'));
        assert.strictEqual(result.length, 2);
    });

});

// ─────────────────────────────────────────────────────────────────────────────
// findMalformed
// ─────────────────────────────────────────────────────────────────────────────

suite('VariableResolver — findMalformed', () => {

    test('returns empty array for well-formed template', () => {
        const resolver = makeResolver();
        const content = '{\n  "Resource": "${bucket_name}/*"\n}';
        const result = resolver.findMalformed(content);
        assert.deepStrictEqual(result, []);
    });

    test('detects unclosed ${ on a line', () => {
        const resolver = makeResolver();
        // Line 1 (index 0) has ${bucket_name with no closing }
        const content = '"arn:aws:s3:::${bucket_name"';
        const result = resolver.findMalformed(content);
        assert.ok(result.length > 0, 'should detect malformed template');
    });

    test('returns empty array when file has no variables at all', () => {
        const resolver = makeResolver();
        const content = '{"Version": "2012-10-17", "Statement": []}';
        const result = resolver.findMalformed(content);
        assert.deepStrictEqual(result, []);
    });

});

// ─────────────────────────────────────────────────────────────────────────────
// getPlaceholder
// ─────────────────────────────────────────────────────────────────────────────

suite('VariableResolver — getPlaceholder', () => {

    test('returns account ID format for account_id variable', () => {
        const resolver = makeResolver();
        const ph = resolver.getPlaceholder('aws_account_id');
        assert.strictEqual(ph, '123456789012');
    });

    test('returns region format for region variable', () => {
        const resolver = makeResolver();
        const ph = resolver.getPlaceholder('region');
        assert.ok(ph.includes('-'), 'region placeholder should look like eu-central-1');
    });

    test('returns ARN format for arn variable', () => {
        const resolver = makeResolver();
        const ph = resolver.getPlaceholder('role_arn');
        assert.ok(ph.startsWith('arn:aws:'), 'ARN placeholder should start with arn:aws:');
    });

    test('returns bucket name format for bucket variable', () => {
        const resolver = makeResolver();
        const ph = resolver.getPlaceholder('state_bucket_name');
        assert.ok(ph.length > 5, 'bucket placeholder should be a realistic length');
    });

    test('returns KMS ARN for kms variable', () => {
        const resolver = makeResolver();
        const ph = resolver.getPlaceholder('kms_key_id');
        assert.ok(ph.startsWith('arn:aws:kms:'), 'KMS placeholder should be a KMS ARN');
    });

    test('returns fallback for unknown variable name', () => {
        const resolver = makeResolver();
        const ph = resolver.getPlaceholder('some_random_variable_xyz');
        assert.strictEqual(ph, 'dummy-value-xyz');
    });

});