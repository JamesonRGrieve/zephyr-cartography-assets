// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * What a pull request must satisfy before it can be merged: every statement of
 * the pull-request template ticked by its author, and no protected term in any
 * changed file's path or text. Pure: `scripts/check-pr.ts` reads the pull
 * request and the files, and this judges them.
 */
// The .ts extension lets Node run scripts/check-pr.ts without a build.
import { coinedWordsIn } from './trademarks.ts';

/**
 * The statements a contributor must tick, word for word as they stand in
 * the repository's `.github/pull_request_template.md` (a test keeps the two in
 * step).
 */
export const ASSERTIONS = [
    'I have the legal right to release everything in this pull request under CC0 1.0.',
    'It contains no trademarked or copyrighted names, text, logos, emblems or other iconography belonging to anyone else.',
    'I dedicate my contribution to the public domain under CC0 1.0 Universal.',
] as const;

/** The files that list the protected terms in order to catch them, and so carry them by design. */
export const GUARD_FILES: readonly string[] = ['gallery/src/trademarks.ts', 'gallery/src/trademarks.test.ts', 'gallery/src/contribution.test.ts'];

/** A changed file: its path, and its text where it is a text file (null for an image or other binary). */
export interface ChangedFile {
    readonly path: string;
    readonly text: string | null;
}

/** The statements in `body` that are not ticked: missing, or left as `- [ ]`. */
export function untickedAssertions(body: string): string[] {
    const ticked = new Set(
        body
            .split(/\r?\n/u)
            .map((line) => /^\s*[-*]\s+\[[xX]\]\s+(.+?)\s*$/u.exec(line)?.[1])
            .filter((statement) => statement !== undefined),
    );
    return ASSERTIONS.filter((statement) => !ticked.has(statement));
}

/** Every protected term in the pull request's title and changed files, each as "where: term". */
export function protectedTermsIn(title: string, files: readonly ChangedFile[]): string[] {
    const found = (where: string, text: string): string[] => coinedWordsIn(text).map((word) => `${where}: "${word}"`);
    return [
        ...found('pull request title', title),
        ...files
            .filter((file) => !GUARD_FILES.includes(file.path))
            .flatMap((file) => [...found(`${file.path} (path)`, file.path), ...(file.text === null ? [] : found(file.path, file.text))]),
    ];
}
