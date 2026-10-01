// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import ASSET_CLASS_FORM from '../../.github/ISSUE_TEMPLATE/asset-class-request.yml?raw';
import LISTING_FORM from '../../.github/ISSUE_TEMPLATE/listing-request.yml?raw';
import PROBLEM_FORM from '../../.github/ISSUE_TEMPLATE/stamp-problem.yml?raw';
import REQUEST_FORM from '../../.github/ISSUE_TEMPLATE/stamp-request.yml?raw';
import VARIANT_FORM from '../../.github/ISSUE_TEMPLATE/variant-request.yml?raw';
import LABELS from '../../.github/labels.yml?raw';
import { CRATE, EMBER } from './fixtures';
import { ASSET_CLASS_URL, LISTING_URL, problemUrl, REQUEST_URL, takesVariantRequests, variantRequestUrl } from './issues';

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
            title: 'Wooden Crate & Lid',
            stamp: 'Wooden Crate & Lid',
            image: 'stamps/interior/crate_01.png',
        });
        expect(url.search).toContain('Wooden+Crate+%26+Lid');
    });
});

describe('variantRequestUrl', () => {
    it('opens the variant request form with the asset’s name and its variants, each once, filled in', () => {
        const url = new URL(variantRequestUrl({ ...CRATE, name: 'Wooden Crate & Lid' }));
        expect(`${url.origin}${url.pathname}`).toBe('https://github.com/JamesonRGrieve/zephyr-cartography-assets/issues/new');
        expect(url.searchParams.get('template')).toBe('variant-request.yml');
        expect(url.searchParams.get('title')).toBe('Wooden Crate & Lid');
        expect(url.searchParams.get('asset')).toBe('Wooden Crate & Lid');
        expect(url.searchParams.get('existing')).toBe('shut\nsmashed');
        expect(VARIANT_FORM).toContain("labels: ['variant-request']");
        expect(VARIANT_FORM).toMatch(/id: asset\n/u);
        expect(VARIANT_FORM).toMatch(/id: existing\n/u);
    });

    it('takes requests for the pack’s own art alone, never other authors’ work; the form says so', () => {
        expect(takesVariantRequests(CRATE)).toBe(true);
        expect(takesVariantRequests(EMBER)).toBe(false);
        expect(takesVariantRequests({ credit: { author: 'Kenney', source: 'https://kenney.nl/assets/particle-pack' } })).toBe(false);
        expect(VARIANT_FORM).toMatch(/only of this pack's own assets/u);
    });
});

describe('LISTING_URL', () => {
    it('opens the listing request form, which asks whether the pack is the requester’s own', () => {
        expect(LISTING_URL).toBe('https://github.com/JamesonRGrieve/zephyr-cartography-assets/issues/new?template=listing-request.yml');
        expect(LISTING_FORM).toContain('- label: This is my asset pack.');
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
        const applied = [ASSET_CLASS_FORM, PROBLEM_FORM, REQUEST_FORM, VARIANT_FORM, LISTING_FORM].map((form) => /^labels: \['([^']+)'\]$/mu.exec(form)?.[1]);
        expect(applied).toEqual(['asset-class-request', 'asset-problem', 'asset-request', 'variant-request', 'listing-request']);
        for (const label of applied) {
            expect(declared).toContain(label);
        }
    });
});
