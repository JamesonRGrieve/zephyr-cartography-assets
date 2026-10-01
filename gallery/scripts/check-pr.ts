// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The pull-request guard, as the `pr-guard` workflow runs it: every file the
 * pull request adds or changes (against `--base`) is checked for protected
 * terms in its path and, for text files, its contents; the title too; and,
 * with `--require-assertions`, every statement of the pull-request template
 * must be ticked in its body. The title and body come from the environment
 * (`PR_TITLE`, `PR_BODY`), never the command line. Exits non-zero, listing
 * each problem, when any is found.
 *
 * Run from the repository root, where the changed paths are:
 *
 *   node gallery/scripts/check-pr.ts --base origin/main [--require-assertions]
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { type ChangedFile, protectedTermsIn, untickedAssertions } from '../src/contribution.ts';

/** How much of a file is read to tell text from binary: a NUL byte in it marks binary, as git judges. */
const SNIFF_BYTES = 8000;

const { values: args } = parseArgs({ options: { 'base': { type: 'string' }, 'require-assertions': { type: 'boolean', default: false } } });
if (args.base === undefined) {
    throw new Error('--base <ref> is required: the branch the pull request merges into');
}

/** A changed file read from disk: its text, or null where it is binary. */
function readChanged(path: string): ChangedFile {
    const bytes = readFileSync(path);
    return { path, text: bytes.subarray(0, SNIFF_BYTES).includes(0) ? null : bytes.toString('utf8') };
}

const paths = execFileSync('git', ['diff', '--name-only', '-z', '--diff-filter=ACMR', `${args.base}...HEAD`], { encoding: 'utf8' })
    .split('\0')
    .filter((path) => path !== '');
const problems = [
    ...protectedTermsIn(process.env['PR_TITLE'] ?? '', paths.map(readChanged)).map((found) => `protected term in ${found}`),
    ...(args['require-assertions'] ? untickedAssertions(process.env['PR_BODY'] ?? '').map((statement) => `not ticked in the description: "${statement}"`) : []),
];
if (problems.length > 0) {
    console.error(`${problems.length} problem(s) with this pull request (see CONTRIBUTING.md):\n${problems.join('\n')}`);
    process.exit(1);
}
console.warn(`${paths.length} changed file(s) checked: no protected terms${args['require-assertions'] ? ', every statement ticked' : ''}.`);
