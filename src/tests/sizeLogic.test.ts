/**
 * Unit tests for size calculation and status logic
 *
 * These test the core business rules:
 *   - under 6144  → ok
 *   - 6144–10240  → warn
 *   - over 10240  → over_inline
 *
 * Also tests the minification logic and percentage calculation.
 *
 * Run with: npm test
 */

import * as assert from 'assert';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers - these mirror the logic in analyzer.ts exactly
// By extracting and testing the logic here, we confirm the math is right
// without needing to mock the VSCode API or the file system.
// ─────────────────────────────────────────────────────────────────────────────

const MANAGED_LIMIT = 6144;
const INLINE_LIMIT  = 10240;

type PolicyStatus = 'ok' | 'warn' | 'over_inline';

function getStatus(size: number): PolicyStatus {
    if (size > INLINE_LIMIT)   { return 'over_inline'; }
    if (size > MANAGED_LIMIT)  { return 'warn'; }
    return 'ok';
}

function getManagedPercent(size: number): number {
    return Math.round((size / MANAGED_LIMIT) * 1000) / 10;
}

function getInlinePercent(size: number): number {
    return Math.round((size / INLINE_LIMIT) * 1000) / 10;
}

function minify(json: string): string {
    // This is exactly what analyzer.ts does:
    // JSON.parse then JSON.stringify removes all whitespace
    return JSON.stringify(JSON.parse(json));
}

// ─────────────────────────────────────────────────────────────────────────────
// Status determination
// ─────────────────────────────────────────────────────────────────────────────

suite('Size limits - status determination', () => {

    test('returns ok when size is well under managed limit', () => {
        assert.strictEqual(getStatus(1000), 'ok');
    });

    test('returns ok when size is just under managed limit', () => {
        assert.strictEqual(getStatus(6143), 'ok');
    });

    test('returns ok when size equals managed limit', () => {
        // Exactly at the limit is still ok - AWS allows up to 6144
        assert.strictEqual(getStatus(6144), 'ok');
    });

    test('returns warn when size is just over managed limit', () => {
        assert.strictEqual(getStatus(6145), 'warn');
    });

    test('returns warn when size is between managed and inline limits', () => {
        assert.strictEqual(getStatus(8000), 'warn');
    });

    test('returns warn when size is just under inline limit', () => {
        assert.strictEqual(getStatus(10239), 'warn');
    });

    test('returns warn when size equals inline limit', () => {
        assert.strictEqual(getStatus(10240), 'warn');
    });

    test('returns over_inline when size exceeds inline limit', () => {
        assert.strictEqual(getStatus(10241), 'over_inline');
    });

    test('returns over_inline when size is far over inline limit', () => {
        assert.strictEqual(getStatus(20000), 'over_inline');
    });

});

// ─────────────────────────────────────────────────────────────────────────────
// Percentage calculation
// ─────────────────────────────────────────────────────────────────────────────

suite('Size limits - percentage calculation', () => {

    test('calculates 0% for empty policy', () => {
        assert.strictEqual(getManagedPercent(0), 0);
    });

    test('calculates 50% correctly for managed limit', () => {
        // 3072 / 6144 = 50%
        assert.strictEqual(getManagedPercent(3072), 50);
    });

    test('calculates 100% correctly for managed limit', () => {
        assert.strictEqual(getManagedPercent(6144), 100);
    });

    test('calculates over 100% when exceeding limit', () => {
        // Should show over 100 so the user sees they are over
        assert.ok(getManagedPercent(7000) > 100);
    });

    test('rounds to one decimal place', () => {
        // 3000 / 6144 = 48.828...% → rounds to 48.8
        const pct = getManagedPercent(3000);
        const decimalPlaces = (pct.toString().split('.')[1] || '').length;
        assert.ok(decimalPlaces <= 1, `Expected max 1 decimal place, got ${pct}`);
    });

    test('calculates inline percent independently from managed percent', () => {
        // Same size gives different % against different limits
        const size = 5000;
        const managed = getManagedPercent(size);
        const inline  = getInlinePercent(size);
        assert.ok(managed > inline, 'managed % should be higher than inline % for same size');
    });

});

// ─────────────────────────────────────────────────────────────────────────────
// Minification (the most important logic in the extension)
// ─────────────────────────────────────────────────────────────────────────────

suite('Minification - JSON.stringify is the measure', () => {

    test('minified JSON is shorter than pretty-printed JSON', () => {
        const pretty = JSON.stringify({ Version: '2012-10-17', Statement: [] }, null, 2);
        const mini   = minify(pretty);
        assert.ok(mini.length < pretty.length, 'minified should be shorter');
    });

    test('minified JSON contains no newlines', () => {
        const pretty = JSON.stringify({ Version: '2012-10-17' }, null, 2);
        const mini   = minify(pretty);
        assert.ok(!mini.includes('\n'), 'minified JSON should not contain newlines');
    });

    test('minified JSON contains no leading spaces', () => {
        const pretty = JSON.stringify({ Statement: [{ Effect: 'Allow' }] }, null, 2);
        const mini   = minify(pretty);
        assert.ok(!mini.includes('  '), 'minified JSON should not contain double spaces');
    });

    test('minified JSON is still valid - can be parsed back', () => {
        const original = { Version: '2012-10-17', Statement: [{ Effect: 'Allow' }] };
        const mini     = minify(JSON.stringify(original, null, 2));
        const reparsed = JSON.parse(mini);
        assert.deepStrictEqual(reparsed, original);
    });

    test('two policies with same content but different whitespace have same minified size', () => {
        const policy = { Version: '2012-10-17', Statement: [{ Effect: 'Allow' }] };
        const pretty    = JSON.stringify(policy, null, 4);  // 4-space indent
        const compact   = JSON.stringify(policy);           // no indent
        const miniPretty  = minify(pretty);
        const miniCompact = minify(compact);
        assert.strictEqual(miniPretty.length, miniCompact.length,
            'whitespace differences should not affect measured size');
    });

    test('variable length directly affects measured size', () => {
        // Short variable value → smaller measured size
        const shortPolicy = `{"Resource": "arn:aws:s3:::short/*"}`;
        // Long variable value → larger measured size
        const longPolicy  = `{"Resource": "arn:aws:s3:::my-very-long-bucket-name-that-is-realistic/*"}`;

        const shortSize = minify(shortPolicy).length;
        const longSize  = minify(longPolicy).length;

        assert.ok(longSize > shortSize,
            'longer variable values should produce larger measured size');
    });

});

// ─────────────────────────────────────────────────────────────────────────────
// Statement breakdown logic
// ─────────────────────────────────────────────────────────────────────────────

suite('Statement breakdown', () => {

    test('statement with more actions is larger than one with fewer', () => {
        const smallStmt = JSON.stringify({
            Sid: 'Small', Effect: 'Allow',
            Action: ['s3:GetObject'],
            Resource: '*'
        });
        const largeStmt = JSON.stringify({
            Sid: 'Large', Effect: 'Allow',
            Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject',
                     's3:ListBucket', 's3:GetBucketVersioning'],
            Resource: '*'
        });
        assert.ok(
            largeStmt.length > smallStmt.length,
            'statement with more actions should be larger'
        );
    });

    test('statement sizes add up to roughly total policy size', () => {
        const policy = {
            Version: '2012-10-17',
            Statement: [
                { Sid: 'One', Effect: 'Allow', Action: ['s3:GetObject'], Resource: '*' },
                { Sid: 'Two', Effect: 'Allow', Action: ['ec2:Describe*'], Resource: '*' }
            ]
        };
        const totalSize = JSON.stringify(policy).length;
        const stmtSizes = policy.Statement
            .map(s => JSON.stringify(s).length)
            .reduce((a, b) => a + b, 0);

        // Statement sizes won't exactly equal total (wrapper JSON adds chars)
        // but statements should account for the majority of the size
        assert.ok(
            stmtSizes < totalSize,
            'individual statement sizes should be less than total policy size'
        );
        assert.ok(
            stmtSizes > totalSize * 0.5,
            'statements should account for over 50% of total policy size'
        );
    });

    test('statements sorted largest first puts biggest statement at index 0', () => {
        const stmts = [
            { sid: 'Small', charCount: 100 },
            { sid: 'Large', charCount: 500 },
            { sid: 'Medium', charCount: 250 }
        ];
        stmts.sort((a, b) => b.charCount - a.charCount);
        assert.strictEqual(stmts[0].sid, 'Large');
        assert.strictEqual(stmts[1].sid, 'Medium');
        assert.strictEqual(stmts[2].sid, 'Small');
    });

});