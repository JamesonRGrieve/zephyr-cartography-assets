// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { NO_FILTERS } from './filter';
import { itemLink, START, searchOf, type View, viewOf } from './link';
import { kindOfTab } from './view';

const PAGE = 'https://example.github.io/gallery/';

describe('searchOf', () => {
    it('writes nothing for the page as it starts', () => {
        expect(searchOf(START)).toBe('');
    });

    it('writes the tab, the search, each filter chosen, every tag, the resolution, hidden AI and the open piece', () => {
        const view: View = {
            tab: 'scenes',
            filters: {
                ...NO_FILTERS,
                kind: 'scene',
                query: 'wreck field',
                category: 'Sci-Fi Battlemaps',
                setting: 'setting-scifi',
                tags: ['ship', 'crash'],
                minResolution: 2048,
                hideAi: true,
            },
            item: 'scene-wreck-field',
        };
        expect(searchOf(view)).toBe(
            '?tab=scenes&q=wreck+field&category=Sci-Fi+Battlemaps&setting=setting-scifi&tag=ship&tag=crash&res=2048&ai=hide&item=scene-wreck-field',
        );
    });
});

describe('viewOf', () => {
    it('reads a bare address as the page’s start', () => {
        expect(viewOf('', kindOfTab)).toEqual(START);
    });

    it('reads back every view it writes', () => {
        const view: View = {
            tab: 'stamps',
            filters: { ...NO_FILTERS, query: 'crate', scale: 'interior', perspective: 'orthographic', license: 'CC0-1.0', style: 'painted', tags: ['wood'] },
            item: 'stamp-23c3fa3d266b',
        };
        expect(viewOf(searchOf(view), kindOfTab)).toEqual(view);
        const tokens: View = { tab: 'tokens', filters: { ...NO_FILTERS, kind: 'token', look: 'style-ink' }, item: null };
        expect(viewOf(searchOf(tokens), kindOfTab)).toEqual(tokens);
    });

    it('browses the kind its tab shows, and the stamps for a tab that browses none', () => {
        expect(viewOf('?tab=textures', kindOfTab).filters.kind).toBe('texture');
        expect(viewOf('?tab=music', kindOfTab)).toEqual({ ...START, tab: 'music' });
    });

    it('ignores what it does not understand rather than refusing the link', () => {
        expect(viewOf('?tab=nowhere&res=big&ai=yes&setting=&tag=&tag=wood&tag=wood&item=', kindOfTab)).toEqual({
            ...START,
            filters: { ...NO_FILTERS, tags: ['wood'] },
        });
        expect(viewOf('?res=-512', kindOfTab).filters.minResolution).toBeNull();
    });
});

describe('itemLink', () => {
    it('is the page’s address with the piece alone', () => {
        expect(itemLink(PAGE, 'scene-wreck-field')).toBe(`${PAGE}?item=scene-wreck-field`);
    });
});
