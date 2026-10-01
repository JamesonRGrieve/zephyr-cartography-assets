// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import TEMPLATE from '../../.github/pull_request_template.md?raw';
import { ASSERTIONS, GUARD_FILES, protectedTermsIn, untickedAssertions } from './contribution';

const ticked = (statements: readonly string[]): string => statements.map((statement) => `- [x] ${statement}`).join('\n');

describe('the pull-request template', () => {
    it('carries every statement word for word, unticked', () => {
        for (const statement of ASSERTIONS) {
            expect(TEMPLATE).toContain(`- [ ] ${statement}\n`);
        }
        expect(untickedAssertions(TEMPLATE)).toEqual([...ASSERTIONS]);
    });
});

describe('untickedAssertions', () => {
    it('passes a description with every statement ticked, in either case of x and with Windows line ends', () => {
        expect(untickedAssertions(ticked(ASSERTIONS))).toEqual([]);
        expect(untickedAssertions(ASSERTIONS.map((statement) => `* [X] ${statement}  `).join('\r\n'))).toEqual([]);
    });

    it('names each statement left unticked, missing, or reworded', () => {
        const [first, second, third] = ASSERTIONS;
        expect(untickedAssertions(`- [x] ${first}\n- [ ] ${second}`)).toEqual([second, third]);
        expect(untickedAssertions(`- [x] ${first.toUpperCase()}\n${ticked([second, third])}`)).toEqual([first]);
        expect(untickedAssertions('')).toEqual([...ASSERTIONS]);
    });
});

describe('protectedTermsIn', () => {
    it('finds protected terms in the title, in changed paths, and in text files’ contents', () => {
        expect(
            protectedTermsIn('Add necron pylons', [
                { path: 'stamps/interior/recaf_mug_01.png', text: null },
                { path: 'pack.json', text: '{"name": "Imperial Altar"}' },
            ]),
        ).toEqual(['pull request title: "necron"', 'stamps/interior/recaf_mug_01.png (path): "recaf"', 'pack.json: "imperial"']);
    });

    it('passes clean changes, binary contents unread, and the guard’s own term lists', () => {
        expect(protectedTermsIn('Add coffee mugs', [{ path: 'stamps/interior/coffee_mug_01.png', text: null }])).toEqual([]);
        expect(
            protectedTermsIn(
                'Extend the guard',
                GUARD_FILES.map((path) => ({ path, text: 'necron, recaf' })),
            ),
        ).toEqual([]);
    });
});
