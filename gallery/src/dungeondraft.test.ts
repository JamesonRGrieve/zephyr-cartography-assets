// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
    DD_PX_PER_SQUARE,
    DEFAULT_TILE_SQUARES,
    encodePck,
    isDungeondraftObject,
    isTerrainRole,
    objectSize,
    packJson,
    resPath,
    safeName,
    tagsFile,
    terrainSize,
} from './dungeondraft';

describe('encodePck', () => {
    it('writes Godot’s PCK v1: the header, an index entry per file, then the files in order', () => {
        const a = { path: 'res://packs/p.json', data: new Uint8Array([1, 2, 3]), md5: new Uint8Array(16).fill(7) };
        const b = { path: 'res://packs/p/x.png', data: new Uint8Array([9]), md5: new Uint8Array(16).fill(8) };
        const out = encodePck([a, b]);
        const view = new DataView(out.buffer);
        // "GDPC", format 1, Godot 3.4.2, sixteen reserved words, two files.
        expect([0, 4, 8, 12, 16].map((offsetOf) => view.getUint32(offsetOf, true))).toEqual([0x43504447, 1, 3, 4, 2]);
        expect(view.getUint32(20, true)).toBe(0);
        expect(view.getUint32(84, true)).toBe(2);
        let at = 88;
        const entries = [a, b].map((entry) => {
            const pathLength = view.getUint32(at, true);
            const path = new TextDecoder().decode(out.slice(at + 4, at + 4 + pathLength));
            at += 4 + pathLength;
            const offset = Number(view.getBigUint64(at, true));
            const size = Number(view.getBigUint64(at + 8, true));
            const md5 = [...out.slice(at + 16, at + 32)];
            at += 32;
            return { path, data: [...out.slice(offset, offset + size)], md5: md5[0], expected: entry };
        });
        expect(entries.map((e) => [e.path, e.data, e.md5])).toEqual([
            ['res://packs/p.json', [1, 2, 3], 7],
            ['res://packs/p/x.png', [9], 8],
        ]);
        expect(out.length).toBe(at + 4);
    });
});

describe('the pack’s contents', () => {
    it('places files under the pack id, safely named', () => {
        expect(resPath('abc123', 'textures/objects/furniture/brass_lamp.webp')).toBe('res://packs/abc123/textures/objects/furniture/brass_lamp.webp');
        expect(safeName('Brass Lamp (caged)')).toBe('brass_lamp_caged');
    });

    it('sizes an object at 256 px a square from its placed size', () => {
        expect(objectSize(100, 200, 100)).toEqual({ width: DD_PX_PER_SQUARE, height: 2 * DD_PX_PER_SQUARE });
        expect(objectSize(60, 59, 100)).toEqual({ width: 154, height: 151 });
    });

    it('paints ground as terrain at the squares a tile spans, never walls', () => {
        expect(isTerrainRole('floor.grass-1')).toBe(true);
        expect(isTerrainRole('grassland')).toBe(true);
        expect(isTerrainRole('wall.stone')).toBe(false);
        expect(terrainSize(1024, 1024, DEFAULT_TILE_SQUARES)).toEqual({ width: 512, height: 512 });
        expect(terrainSize(1000, 500, 6)).toEqual({ width: 3072, height: 1536 });
    });

    it('takes battlemap-scale art seen from above, never isometric or front art, or a map icon', () => {
        expect(isDungeondraftObject({ scale: 'interior', perspective: 'orthographic' })).toBe(true);
        expect(isDungeondraftObject({ scale: 'exterior', perspective: 'central' })).toBe(true);
        expect(isDungeondraftObject({ scale: 'interior', perspective: 'isometric' })).toBe(false);
        expect(isDungeondraftObject({ scale: 'interior', perspective: 'front' })).toBe(false);
        expect(isDungeondraftObject({ scale: 'regional', perspective: 'orthographic' })).toBe(false);
    });

    it('writes pack.json and the tags file Dungeondraft reads', () => {
        expect(packJson('abc123', 'Zephyr Cartography (CC0)', '1.0.0', 'Jameson Grieve', ['cc0', 'battlemap'])).toEqual({
            name: 'Zephyr Cartography (CC0)',
            id: 'abc123',
            version: '1.0.0',
            author: 'Jameson Grieve',
            keywords: 'cc0,battlemap',
            allow_3rd_party_mapping_software_to_read: true,
        });
        const tags = new Map([['Lighting', ['textures/objects/lighting/b.webp', 'textures/objects/lighting/a.webp']]]);
        expect(JSON.parse(tagsFile(tags, new Map([['Zephyr Cartography', ['Lighting']]])))).toEqual({
            tags: { Lighting: ['textures/objects/lighting/a.webp', 'textures/objects/lighting/b.webp'] },
            sets: { 'Zephyr Cartography': ['Lighting'] },
        });
    });
});
