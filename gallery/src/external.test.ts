// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import { bundledPath, isExternal, relinked } from './external';

describe('isExternal', () => {
    it('tells web links from files in the module', () => {
        expect(isExternal('https://dl.polyhaven.org/file/a.jpg')).toBe(true);
        expect(isExternal('HTTP://example.com/b.ogg')).toBe(true);
        expect(isExternal('ai/stamps/interior/crate_01.webp')).toBe(false);
        expect(isExternal('/abs/path.png')).toBe(false);
    });
});

describe('bundledPath', () => {
    it('files a link under external/<host>/<path>, with safe segments', () => {
        expect(bundledPath('https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/grass/grass_diff_1k.jpg')).toBe(
            'external/dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/grass/grass_diff_1k.jpg',
        );
        expect(bundledPath('https://example.com/sounds/fire%20loop%20(1).ogg')).toBe('external/example.com/sounds/fire_loop__1_.ogg');
    });

    it('folds a query into the file name, so two links never share a path', () => {
        expect(bundledPath('https://example.com/get?file=a.zip')).toBe('external/example.com/get_file_a.zip');
        expect(bundledPath('https://example.com/img.png?v=2')).toBe('external/example.com/img_v_2.png');
        expect(bundledPath('https://example.com/')).toBe('external/example.com/index');
    });
});

describe('relinked', () => {
    it('replaces every string that is a linked asset with its bundled path, however deep', () => {
        const map = new Map([['https://x/a.png', 'external/x/a.png']]);
        expect(relinked({ stamps: [{ variants: [{ image: 'https://x/a.png' }, { image: 'ai/b.webp' }] }], n: 1, ok: true, none: null }, map)).toEqual({
            stamps: [{ variants: [{ image: 'external/x/a.png' }, { image: 'ai/b.webp' }] }],
            n: 1,
            ok: true,
            none: null,
        });
    });
});
