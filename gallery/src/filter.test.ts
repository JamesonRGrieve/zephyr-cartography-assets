// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { categoryCounts, choicesOf, narrow, NO_FILTERS, settingCounts, settingLabel, tagCounts, toggledTag, valueLabel } from './filter';
import { ITEMS } from './fixtures';

const names = (items: readonly { readonly name: string }[]): string[] => items.map((item) => item.name);

describe('narrow', () => {
    it('shows every item of the kind, by name, with no other filters', () => {
        expect(names(narrow(ITEMS, NO_FILTERS))).toEqual(['Grimdark Residence Block', 'Iron Chest', 'Stone Altar', 'Wooden Crate']);
        expect(names(narrow(ITEMS, { ...NO_FILTERS, kind: 'texture' }))).toEqual(['Grassland']);
        expect(narrow(ITEMS, { ...NO_FILTERS, kind: 'particle' })).toEqual([]);
    });

    it('needs every word searched somewhere in the name, category or tags, whatever the case', () => {
        expect(names(narrow(ITEMS, { ...NO_FILTERS, query: 'CRA' }))).toEqual(['Wooden Crate']);
        expect(names(narrow(ITEMS, { ...NO_FILTERS, query: 'storage loot' }))).toEqual(['Iron Chest', 'Wooden Crate']);
        expect(names(narrow(ITEMS, { ...NO_FILTERS, query: 'storage stone' }))).toEqual([]);
        expect(names(narrow(ITEMS, { ...NO_FILTERS, query: '   ' }))).toHaveLength(ITEMS.length - 1);
        // From the start of a word only: "rate" is inside "crate", not the start of a word.
        expect(names(narrow(ITEMS, { ...NO_FILTERS, query: 'rate' }))).toEqual([]);
    });

    it('keeps one category, items carrying every chosen tag, and a scale and perspective', () => {
        expect(names(narrow(ITEMS, { ...NO_FILTERS, category: 'Storage' }))).toEqual(['Iron Chest', 'Wooden Crate']);
        expect(names(narrow(ITEMS, { ...NO_FILTERS, tags: ['loot', 'wood'] }))).toEqual(['Wooden Crate']);
        expect(names(narrow(ITEMS, { ...NO_FILTERS, scale: 'city' }))).toEqual(['Grimdark Residence Block']);
        expect(names(narrow(ITEMS, { ...NO_FILTERS, perspective: 'isometric' }))).toEqual(['Stone Altar']);
        expect(names(narrow(ITEMS, { ...NO_FILTERS, setting: 'setting-fantasy' }))).toEqual(['Iron Chest', 'Wooden Crate']);
    });
});

describe('categoryCounts', () => {
    it('counts each category among the items the other filters leave, whatever category or tags are chosen', () => {
        expect(categoryCounts(ITEMS, { ...NO_FILTERS, category: 'Storage', tags: ['wood'] })).toEqual([
            { name: 'Furniture', count: 1 },
            { name: 'Storage', count: 2 },
            { name: 'Structural', count: 1 },
        ]);
        expect(categoryCounts(ITEMS, { ...NO_FILTERS, kind: 'texture' })).toEqual([{ name: 'Textures (Poly Haven)', count: 1 }]);
        expect(categoryCounts(ITEMS, { ...NO_FILTERS, query: 'stone' })).toEqual([
            { name: 'Furniture', count: 1 },
            { name: 'Structural', count: 1 },
        ]);
    });
});

describe('tagCounts', () => {
    it('offers tags at least two items in view share, the chosen ones aside, the most shared first', () => {
        expect(tagCounts(ITEMS, NO_FILTERS)).toEqual([
            { name: 'loot', count: 2 },
            { name: 'stone', count: 2 },
        ]);
        expect(tagCounts(ITEMS, { ...NO_FILTERS, category: 'Storage' })).toEqual([{ name: 'loot', count: 2 }]);
        expect(tagCounts(ITEMS, { ...NO_FILTERS, tags: ['loot'] })).toEqual([]);
    });
});

describe('settings', () => {
    it('names each setting friendly, its family before a colon', () => {
        expect(settingLabel('setting-grimdark-human')).toBe('Grimdark: Human');
        expect(settingLabel('setting-fantasy')).toBe('Fantasy');
        expect(settingLabel('setting-scifi')).toBe('Sci-Fi');
        expect(valueLabel('interior')).toBe('Interior');
        expect(valueLabel('top-down')).toBe('Top-Down');
    });

    it('counts each setting among the items the other filters leave, by name, whatever setting is chosen', () => {
        expect(settingCounts(ITEMS, { ...NO_FILTERS, setting: 'setting-fantasy' })).toEqual([
            { name: 'setting-fantasy', count: 2 },
            { name: 'setting-grimdark-human', count: 1 },
        ]);
    });

    it('keeps settings out of the tag chips', () => {
        expect(tagCounts(ITEMS, NO_FILTERS).map((c) => c.name)).not.toContain('setting-fantasy');
    });
});

describe('choicesOf', () => {
    it('lists each scale or perspective once, sorted, skipping items without one', () => {
        expect(choicesOf(ITEMS, 'scale')).toEqual(['city', 'interior']);
        expect(choicesOf(ITEMS, 'perspective')).toEqual(['isometric', 'orthographic']);
    });
});

describe('toggledTag', () => {
    it('adds a tag not chosen, and takes away one that is', () => {
        const once = toggledTag(NO_FILTERS, 'loot');
        expect(once.tags).toEqual(['loot']);
        expect(toggledTag(once, 'loot').tags).toEqual([]);
    });
});
