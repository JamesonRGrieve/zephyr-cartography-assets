// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { parseGalleryIndex } from './catalog';
import { EMBER, FIRE, INSTALL, ITEMS } from './fixtures';

const INDEX = { schemaVersion: 1, install: INSTALL, curator: 'Jameson Grieve', items: ITEMS };

describe('parseGalleryIndex', () => {
    it('requires the install facts, their addresses as URLs', () => {
        expect(parseGalleryIndex({ ...INDEX, install: undefined }).ok).toBe(false);
        expect(parseGalleryIndex({ ...INDEX, install: { ...INSTALL, manifest: 'module.json' } }).ok).toBe(false);
    });

    it('requires every piece’s credit (a link to its source) and its AI flag, AI-generated art included', () => {
        const [first] = ITEMS;
        expect(first?.ai).toBe(true);
        expect(first?.credit.source).toMatch(/^https:/u);
        expect(parseGalleryIndex({ ...INDEX, items: [{ ...first, credit: null }] }).ok).toBe(false);
        expect(parseGalleryIndex({ ...INDEX, items: [{ ...first, credit: { author: 'Someone', source: 'not a link' } }] }).ok).toBe(false);
        expect(parseGalleryIndex({ ...INDEX, items: [{ ...first, ai: undefined }] }).ok).toBe(false);
        // Work brought in from elsewhere can be AI-generated too.
        expect(parseGalleryIndex({ ...INDEX, items: [{ ...EMBER, ai: true }] }).ok).toBe(true);
    });

    it('requires every piece’s licence, an open one', () => {
        const [first] = ITEMS;
        expect(parseGalleryIndex({ ...INDEX, items: [EMBER] }).ok).toBe(true);
        expect(parseGalleryIndex({ ...INDEX, items: [{ ...first, license: undefined }] }).ok).toBe(false);
        expect(parseGalleryIndex({ ...INDEX, items: [{ ...EMBER, license: 'CC-BY-NC-4.0' }] }).ok).toBe(false);
        expect(parseGalleryIndex({ ...INDEX, items: [], sounds: [{ ...FIRE, credit: null }] }).ok).toBe(false);
        expect(parseGalleryIndex({ ...INDEX, items: [], sounds: [{ ...FIRE, ai: undefined }] }).ok).toBe(false);
    });

    it('reads a well-formed index', () => {
        const parsed = parseGalleryIndex(INDEX);
        expect(parsed.ok ? parsed.value.items.map((item) => item.id) : null).toEqual(ITEMS.map((item) => item.id));
    });

    it('says where an index is wrong: a missing field, an item with no images, an unknown key', () => {
        const parsed = parseGalleryIndex({ ...INDEX, curator: undefined, items: [{ ...ITEMS[0], variants: [] }], extra: true });
        expect(parsed.ok).toBe(false);
        expect(parsed.ok ? [] : parsed.issues.join('\n')).toMatch(/curator/u);
        expect(parsed.ok ? [] : parsed.issues.join('\n')).toMatch(/items\.0\.variants/u);
    });

    it('refuses an external item’s credit whose source is not a link', () => {
        const [first] = ITEMS;
        expect(parseGalleryIndex({ ...INDEX, items: [{ ...first, credit: { author: 'Someone', source: 'not a link' } }] }).ok).toBe(false);
        expect(parseGalleryIndex(null).ok).toBe(false);
    });
});
