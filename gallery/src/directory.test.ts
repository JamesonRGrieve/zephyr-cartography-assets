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
    ai: null,
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
            { ...PACK, name: 'Alpha Trees', classes: ['stamps'], ai: false },
        ]);
        const tiles = [...list.querySelectorAll('li.pack')];
        expect(tiles.map((tile) => tile.querySelector('h3')?.textContent)).toEqual(['Alpha Trees', 'Zeta Dungeon Props']);
        expect(tiles[0]?.querySelector('.facts')?.textContent).toBe('By Someone · Stamps');
        expect([...(tiles[0]?.querySelectorAll('.terms') ?? [])].map((p) => p.textContent)).toEqual([
            'Custom: free for personal use, no redistribution · Not AI-generated',
            'Its licence forbids redistribution.',
        ]);
        expect(tiles[1]?.querySelector('.facts')?.textContent).toBe('By Someone · Stamps, Textures');
        expect(tiles[1]?.querySelector('.terms')?.textContent).toContain('AI use: not disclosed');
        const link = tiles[0]?.querySelector<HTMLAnchorElement>('a.button');
        expect(link?.getAttribute('href')).toBe('https://example.com/zeta');
        expect(link?.getAttribute('target')).toBe('_blank');
        renderDirectory(list, [{ ...PACK, ai: true }]);
        expect(list.querySelector('.terms')?.textContent).toContain('AI-generated');
        renderDirectory(list, []);
        expect(list.textContent).toBe('No packs listed yet.');
    });
});
