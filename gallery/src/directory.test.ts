// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import MORE_ASSETS from '../public/more-assets.json?raw';
import { type DirectoryPack, parseDirectory, renderDirectory } from './directory';

const PACK: DirectoryPack = {
    name: 'Zeta Dungeon Props',
    author: 'Someone',
    url: 'https://example.com/zeta',
    description: 'Hand-drawn dungeon furniture.',
    classes: ['stamps', 'textures'],
    license: 'Custom: free for personal use, no redistribution',
    licenseUrl: 'https://example.com/zeta/terms',
    ai: null,
    aiUrl: null,
    note: 'Its licence forbids redistribution.',
};

describe('parseDirectory', () => {
    it('reads the packs, and reports a malformed entry', () => {
        expect(parseDirectory({ packs: [PACK] })).toEqual({ ok: true, value: [PACK] });
        expect(parseDirectory({ packs: [] })).toEqual({ ok: true, value: [] });
        const bad = parseDirectory({ packs: [{ ...PACK, url: 'not a link' }] });
        expect(bad.ok ? [] : bad.issues.join('\n')).toMatch(/url/u);
        expect(parseDirectory({ packs: [{ ...PACK, preview: 'x.png' }] }).ok).toBe(false);
        expect(parseDirectory({ packs: [{ ...PACK, classes: ['weather'] }] }).ok).toBe(false);
        expect(parseDirectory({ packs: [{ ...PACK, ai: undefined }] }).ok).toBe(false);
        // A disclosure links to where the author states it; an undisclosed one links nowhere.
        expect(parseDirectory({ packs: [{ ...PACK, ai: true }] }).ok).toBe(false);
        expect(parseDirectory({ packs: [{ ...PACK, aiUrl: 'https://example.com/x' }] }).ok).toBe(false);
        expect(parseDirectory({ packs: [{ ...PACK, licenseUrl: undefined }] }).ok).toBe(false);
    });

    it('accepts the site’s own directory file', () => {
        const parsed = parseDirectory(JSON.parse(MORE_ASSETS));
        expect(parsed.ok ? 'valid' : parsed.issues.join('\n')).toBe('valid');
    });
});

describe('renderDirectory', () => {
    it('lists one tile per pack by name, with its classes, licence, AI disclosure and note, linking to its author', () => {
        const list = document.createElement('ul');
        renderDirectory(list, [
            { ...PACK, classes: ['stamps', 'textures'] },
            { ...PACK, name: 'Alpha Trees', classes: ['stamps'], ai: false, aiUrl: 'https://example.com/alpha/about' },
        ]);
        const tiles = [...list.querySelectorAll('li.pack')];
        expect(tiles.map((tile) => tile.querySelector('h3')?.textContent)).toEqual(['Alpha Trees', 'Zeta Dungeon Props']);
        expect(tiles[0]?.querySelector('.facts')?.textContent).toBe('By Someone · Stamps');
        // The licence and AI disclosure are chips under the title.
        expect(tiles[0]?.querySelector('h3 + ul.pack-chips')).not.toBeNull();
        expect([...(tiles[0]?.querySelectorAll('.pack-chips li') ?? [])].map((chip) => chip.textContent)).toEqual([
            'Custom: free for personal use, no redistribution',
            'Not AI-generated',
        ]);
        expect(tiles[0]?.querySelector('.terms')?.textContent).toBe('Its licence forbids redistribution.');
        // Each chip links to where it is stated; an undisclosed AI use is plain text.
        expect(tiles[0]?.querySelector('.pack-chips li.license a')?.getAttribute('href')).toBe('https://example.com/zeta/terms');
        expect(tiles[0]?.querySelector('.pack-chips li:not(.license) a')?.getAttribute('href')).toBe('https://example.com/alpha/about');
        expect(tiles[1]?.querySelector('.pack-chips li:not(.license) a')).toBeNull();
        expect(tiles[1]?.querySelector('.facts')?.textContent).toBe('By Someone · Stamps, Textures');
        expect(tiles[1]?.querySelector('.pack-chips')?.textContent).toContain('AI use: not disclosed');
        const link = tiles[0]?.querySelector<HTMLAnchorElement>('a.button');
        expect(link?.getAttribute('href')).toBe('https://example.com/zeta');
        expect(link?.getAttribute('target')).toBe('_blank');
        renderDirectory(list, [{ ...PACK, ai: true, aiUrl: 'https://example.com/zeta/ai' }]);
        expect(list.querySelector('.pack-chips li.ai')?.textContent).toBe('AI-generated');
        expect(list.querySelector('.pack-chips li.ai a')?.getAttribute('href')).toBe('https://example.com/zeta/ai');
        renderDirectory(list, []);
        expect(list.textContent).toBe('No packs listed yet.');
    });
});
