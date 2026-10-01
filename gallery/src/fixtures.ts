// SPDX-License-Identifier: AGPL-3.0-or-later
/** Gallery items for the tests: a few stamps of different categories, tags, scales and perspectives, a credited texture, a sound, and the module's install facts. */
import type { GalleryInstall, GalleryItem, GallerySound } from './catalog';

export const INSTALL: GalleryInstall = {
    id: 'zephyr-cartography-assets',
    version: '1.0.0',
    manifest: 'https://github.com/JamesonRGrieve/zephyr-cartography-assets/releases/latest/download/module.json',
    download: 'https://github.com/JamesonRGrieve/zephyr-cartography-assets/releases/download/v1.0.0/zephyr-cartography-assets.zip',
};

export const variant = (state: string, file: string): GalleryItem['variants'][number] => ({
    state,
    file,
    thumb: `thumbs/${file.replace(/\.png$/u, '.webp')}`,
    preview: `previews/${file.replace(/\.png$/u, '.webp')}`,
    width: 100,
    height: 100,
});

const stamp = (id: string, over: Partial<GalleryItem>): GalleryItem => ({
    id,
    kind: 'stamp',
    origin: 'ai',
    credit: null,
    name: id,
    category: 'Furniture',
    tags: [],
    scale: 'interior',
    perspective: 'orthographic',
    variants: [variant('default', `stamps/interior/${id}_01.png`)],
    ...over,
});

export const CRATE = stamp('crate', {
    name: 'Wooden Crate',
    category: 'Storage',
    tags: ['wood', 'loot', 'setting-fantasy'],
    variants: [variant('shut', 'stamps/interior/crate_01.png'), variant('smashed', 'stamps/interior/crate_02.png')],
});
export const CHEST = stamp('chest', { name: 'Iron Chest', category: 'Storage', tags: ['iron', 'loot', 'setting-fantasy'] });
export const ALTAR = stamp('altar', {
    name: 'Stone Altar',
    category: 'Furniture',
    tags: ['stone', 'shrine', 'setting-grimdark-human'],
    perspective: 'isometric',
});
export const RESIDENCE = stamp('residence', { name: 'Grimdark Residence Block', category: 'Structural', tags: ['stone'], scale: 'city' });
export const GRASS = stamp('grass', {
    kind: 'texture',
    origin: 'external',
    credit: { author: 'Rob Tuytel', source: 'https://polyhaven.com/a/grass' },
    name: 'Grassland',
    category: 'Textures (Poly Haven)',
    tags: ['grassland'],
    scale: null,
    perspective: null,
});

export const ITEMS: readonly GalleryItem[] = [CRATE, CHEST, ALTAR, RESIDENCE, GRASS];

/** An ambient sound shared by two tags, credited to its author. */
export const FIRE: GallerySound = {
    id: 'sound-fire',
    name: 'Fire',
    file: 'zephyr-cartography-assets/cc0/sounds/fire.ogg',
    audio: 'audio/cc0/sounds/fire.ogg',
    triggers: ['brazier', 'campfire'],
    stamps: 9,
    radius: 5,
    credit: { author: 'PagDev', source: 'https://opengameart.org/content/fireplace-sound-loop' },
    license: 'CC0-1.0',
};
