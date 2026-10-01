// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import ASSET_CLASS_FORM from '../../.github/ISSUE_TEMPLATE/asset-class-request.yml?raw';
import PROBLEM_FORM from '../../.github/ISSUE_TEMPLATE/stamp-problem.yml?raw';
import REQUEST_FORM from '../../.github/ISSUE_TEMPLATE/stamp-request.yml?raw';
import LABELS from '../../.github/labels.yml?raw';
import { CRATE } from './fixtures';
import { ASSET_CLASS_URL, problemUrl, REQUEST_URL } from './issues';

describe('problemUrl', () => {
    it('opens the problem form on the asset pack’s repository, the stamp and its image filled in and encoded', () => {
        const [shut] = CRATE.variants;
        expect(shut).toBeDefined();
        if (shut === undefined) {
            return;
        }
        const url = new URL(problemUrl({ ...CRATE, name: 'Wooden Crate & Lid' }, shut));
        expect(`${url.origin}${url.pathname}`).toBe('https://github.com/JamesonRGrieve/zephyr-cartography-assets/issues/new');
        expect(Object.fromEntries(url.searchParams)).toEqual({
            template: 'stamp-problem.yml',
            title: '[Asset problem] Wooden Crate & Lid',
            stamp: 'Wooden Crate & Lid',
            image: 'stamps/interior/crate_01.png',
        });
        expect(url.search).toContain('Wooden+Crate+%26+Lid');
    });
});

describe('REQUEST_URL', () => {
    it('opens the request form', () => {
        expect(REQUEST_URL).toBe('https://github.com/JamesonRGrieve/zephyr-cartography-assets/issues/new?template=stamp-request.yml');
    });
});

describe('ASSET_CLASS_URL', () => {
    it('opens the asset class request form, which exists among the issue forms', () => {
        expect(ASSET_CLASS_URL).toBe('https://github.com/JamesonRGrieve/zephyr-cartography-assets/issues/new?template=asset-class-request.yml');
        expect(ASSET_CLASS_FORM).toContain('name: New asset class request');
    });
});

describe('the issue forms', () => {
    it('each apply a label the repository declares in .github/labels.yml', () => {
        const declared = [...LABELS.matchAll(/^- name: (\S+)$/gmu)].map((match) => match[1]);
        const applied = [ASSET_CLASS_FORM, PROBLEM_FORM, REQUEST_FORM].map((form) => /^labels: \['([^']+)'\]$/mu.exec(form)?.[1]);
        expect(applied).toEqual(['asset-class-request', 'asset-problem', 'asset-request']);
        for (const label of applied) {
            expect(declared).toContain(label);
        }
    });
});
