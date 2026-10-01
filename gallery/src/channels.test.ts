// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest';
import {
    ALL_LICENSE_NOTE,
    CHANNELS,
    channelFileName,
    channelFor,
    channelLinks,
    channelModule,
    channelPack,
    isAiFree,
    isCc0Only,
    type JsonObject,
    releaseLinks,
} from './channels';

const LINKS = {
    manifest: 'https://github.com/o/r/releases/latest/download/module.json',
    download: 'https://github.com/o/r/releases/download/v1.0.0/zephyr-cartography-assets.zip',
};

const ai = { source: 'Zephyr Cartography Assets', license: 'CC0-1.0', ai: true };
const cc0 = { source: 'Poly Haven', license: 'CC0-1.0', author: 'A', url: 'https://x', ai: false };
const ccBy = { source: 'Elsewhere', license: 'CC-BY-4.0', author: 'B', url: 'https://y', ai: false };

const PACK: JsonObject = {
    id: 'zephyr-cartography-assets',
    license: 'CC0-1.0',
    stamps: [
        { id: 'ai', provenance: ai, variants: [{ image: 'ai/a.webp' }] },
        { id: 'legacy', variants: [{ image: 'ai/b.webp' }] },
        { id: 'by', provenance: ccBy, variants: [{ image: 'ext/c.webp' }] },
        { id: 'photo', provenance: cc0, variants: [{ image: 'cc0/p.webp' }] },
        { id: 'voiced', provenance: cc0, variants: [{ image: 'cc0/d.webp' }], sound: { path: 'ext/hum.ogg', provenance: ccBy } },
    ],
    textureSets: [
        { id: 'painted', license: 'CC0-1.0', provenance: ai, textures: { floor: 'ai/floor.webp' } },
        {
            id: 'photo',
            license: 'CC0-1.0',
            textures: { floor: 'p/floor.jpg', wall: 'p/wall.jpg' },
            sources: { floor: cc0, wall: ccBy },
            resolutions: { floor: '1K', wall: '1K' },
        },
        { id: 'byset', license: 'CC-BY-4.0', provenance: ccBy, textures: { floor: 'q/floor.jpg' } },
    ],
    ambience: {
        sounds: { fire: { path: 'cc0/fire.ogg', provenance: cc0 }, hum: { path: 'ext/hum2.ogg', provenance: ccBy } },
        particles: {
            brazier: [
                { textures: ['cc0/smoke.webp'], provenance: cc0 },
                { textures: ['ext/spark.webp'], provenance: ccBy },
            ],
        },
    },
};

/** The ids of a pack's stamps or texture sets. */
function ids(pack: JsonObject, key: 'stamps' | 'textureSets'): unknown[] {
    const list = pack[key];
    return Array.isArray(list) ? list.map((entry) => (entry !== null && typeof entry === 'object' && !Array.isArray(entry) ? entry['id'] : null)) : [];
}

describe('the channels', () => {
    it('are CC0 or Everything, each also AI-free, chosen by the two boxes (none ticked: CC0, AI art included)', () => {
        expect(CHANNELS).toEqual(['cc0', 'everything', 'cc0-ai-free', 'everything-ai-free']);
        expect(channelFor({ everything: false, aiFree: false })).toBe('cc0');
        expect(channelFor({ everything: true, aiFree: false })).toBe('everything');
        expect(channelFor({ everything: false, aiFree: true })).toBe('cc0-ai-free');
        expect(channelFor({ everything: true, aiFree: true })).toBe('everything-ai-free');
        expect(CHANNELS.map((channel) => [isCc0Only(channel), isAiFree(channel)])).toEqual([
            [true, false],
            [false, false],
            [true, true],
            [false, true],
        ]);
    });

    it('name their files with their suffix before the extension, the default with none', () => {
        expect(CHANNELS.map((channel) => channelFileName('module.json', channel))).toEqual([
            'module.json',
            'module-everything.json',
            'module-ai-free.json',
            'module-everything-ai-free.json',
        ]);
        expect(channelLinks(LINKS, 'cc0')).toEqual(LINKS);
        expect(releaseLinks(LINKS)['everything-ai-free']).toEqual({
            manifest: 'https://github.com/o/r/releases/latest/download/module-everything-ai-free.json',
            download: 'https://github.com/o/r/releases/download/v1.0.0/zephyr-cartography-assets-everything-ai-free.zip',
        });
        expect(() => channelLinks({ ...LINKS, download: 'https://x/file.tar' }, 'everything')).toThrow(/\.zip/u);
    });
});

describe('channelPack', () => {
    it('ships everything in Everything', () => {
        expect(channelPack(PACK, 'everything')).toEqual(PACK);
    });

    it('leaves non-CC0 parts out of CC0: stamps, a kept stamp’s sound, texture roles and sets, ambience', () => {
        const out = channelPack(PACK, 'cc0');
        expect(JSON.stringify(out)).not.toContain('ext/');
        expect(ids(out, 'stamps')).toEqual(['ai', 'legacy', 'photo', 'voiced']);
        expect(JSON.stringify(out['stamps'])).not.toContain('"sound"');
        expect(ids(out, 'textureSets')).toEqual(['painted', 'photo']);
        expect(JSON.stringify(out['textureSets'])).toContain('"resolutions":{"floor":"1K"}');
        expect(out['ambience']).toEqual({
            sounds: { fire: { path: 'cc0/fire.ogg', provenance: cc0 } },
            particles: { brazier: [{ textures: ['cc0/smoke.webp'], provenance: cc0 }] },
        });
    });

    it('leaves out of the AI-free channels whatever its provenance flags as AI-generated, from any source', () => {
        const broughtIn = { ...PACK, stamps: [{ id: 'elsewhere-ai', provenance: { ...cc0, ai: true }, variants: [{ image: 'cc0/e.webp' }] }] };
        expect(ids(channelPack(broughtIn, 'cc0-ai-free'), 'stamps')).toEqual([]);
        expect(ids(channelPack(broughtIn, 'cc0'), 'stamps')).toEqual(['elsewhere-ai']);
    });

    it('leaves AI-generated parts out of the AI-free channels, a stamp recording no provenance among them', () => {
        expect(ids(channelPack(PACK, 'everything-ai-free'), 'stamps')).toEqual(['by', 'photo', 'voiced']);
        expect(ids(channelPack(PACK, 'everything-ai-free'), 'textureSets')).toEqual(['photo', 'byset']);
        const cc0AiFree = channelPack(PACK, 'cc0-ai-free');
        expect(ids(cc0AiFree, 'stamps')).toEqual(['photo', 'voiced']);
        expect(ids(cc0AiFree, 'textureSets')).toEqual(['photo']);
    });
});

describe('channelModule', () => {
    it('points each channel’s module.json at its own manifest and archive; beyond CC0 it says no one licence covers it', () => {
        const moduleJson = { id: 'zephyr-cartography-assets', license: 'CC0-1.0', manifest: 'old', download: 'old' };
        expect(channelModule(moduleJson, LINKS, 'cc0')).toEqual({ ...moduleJson, ...LINKS });
        expect(channelModule(moduleJson, LINKS, 'cc0-ai-free')).toEqual({ ...moduleJson, ...channelLinks(LINKS, 'cc0-ai-free') });
        expect(channelModule(moduleJson, LINKS, 'everything')).toEqual({ ...moduleJson, ...channelLinks(LINKS, 'everything'), license: ALL_LICENSE_NOTE });
    });
});
