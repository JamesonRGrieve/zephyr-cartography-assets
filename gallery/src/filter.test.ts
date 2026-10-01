// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
    categoryCounts,
    choicesOf,
    longSideOf,
    narrow,
    NO_FILTERS,
    RESOLUTION_STEPS,
    resolutionChoices,
    resolutionLabel,
    stepPx,
    settingCounts,
    settingLabel,
    tagCounts,
    toggledTag,
    valueLabel,
    visibleSounds,
} from './filter';
import { CRATE, EMBER, FIRE, ITEMS, variant } from './fixtures';

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

describe('the licence filter', () => {
    it('keeps the items under the licence chosen, and lists every licence once', () => {
        const all = [...ITEMS, EMBER];
        expect(names(narrow(all, { ...NO_FILTERS, kind: 'particle', license: 'CC-BY-4.0' }))).toEqual(['Ember']);
        expect(narrow(all, { ...NO_FILTERS, license: 'CC-BY-4.0' })).toEqual([]);
        expect(choicesOf(all, 'license')).toEqual(['CC-BY-4.0', 'CC0-1.0']);
    });
});

describe('hiding AI-generated pieces', () => {
    it('hides AI-generated items and sounds by their own flag, whoever made them', () => {
        expect(names(narrow(ITEMS, { ...NO_FILTERS, kind: 'texture', hideAi: true }))).toEqual(['Grassland']);
        expect(narrow(ITEMS, { ...NO_FILTERS, hideAi: true })).toEqual([]);
        expect(narrow([{ ...EMBER, ai: true }], { ...NO_FILTERS, kind: 'particle', hideAi: true })).toEqual([]);
        const sounds = [FIRE, { ...FIRE, id: 'sound-ai', ai: true }];
        expect(visibleSounds(sounds, { ...NO_FILTERS, hideAi: true }).map((sound) => sound.id)).toEqual(['sound-fire']);
        expect(visibleSounds(sounds, NO_FILTERS)).toHaveLength(2);
    });
});

describe('the minimum-resolution filter', () => {
    const sized = (id: string, sides: readonly (readonly [number | null, number | null])[]) => ({
        ...CRATE,
        id,
        name: id,
        variants: sides.map(([width, height], i) => ({ ...variant(`v${i}`, `${id}_${i}.png`), width, height })),
    });
    const big = sized('big', [
        [2048, 1024],
        [4096, 4096],
    ]);
    const small = sized('small', [[600, 300]]);
    const linked = sized('linked', [[null, null]]);

    it('measures a piece by its smallest image’s long side; unknown when an image is linked', () => {
        expect(longSideOf(big)).toBe(2048);
        expect(longSideOf(small)).toBe(600);
        expect(longSideOf(linked)).toBeNull();
    });

    it('takes an image’s recorded resolution step first, a linked one included', () => {
        const stepped = { ...linked, variants: [{ ...variant('v', 'x.png'), width: null, height: null, resolution: '2K' }] };
        expect(longSideOf(stepped)).toBe(2048);
        expect(longSideOf({ ...big, variants: [{ ...variant('v', 'y.png'), width: 3000, height: 100, resolution: '512' }] })).toBe(512);
        expect(names(narrow([stepped, small], { ...NO_FILTERS, minResolution: 2048 }))).toEqual(['linked']);
        expect([stepPx('512'), stepPx('1K'), stepPx('8K'), stepPx('huge')]).toEqual([512, 1024, 8192, null]);
    });

    it('keeps pieces whose every image reaches the minimum, leaving out those of unknown size', () => {
        expect(names(narrow([big, small, linked], { ...NO_FILTERS, minResolution: 1024 }))).toEqual(['big']);
        expect(names(narrow([big, small, linked], { ...NO_FILTERS, minResolution: 512 }))).toEqual(['big', 'small']);
        expect(names(narrow([big, small, linked], NO_FILTERS))).toEqual(['big', 'linked', 'small']);
    });

    it('offers only the steps some piece reaches, labelled as resolutions are named', () => {
        expect(resolutionChoices([big, small])).toEqual([512, 1024, 2048]);
        expect(resolutionChoices([linked])).toEqual([]);
        expect(RESOLUTION_STEPS.map(resolutionLabel)).toEqual(['512 px+', '1K+', '2K+', '4K+']);
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
