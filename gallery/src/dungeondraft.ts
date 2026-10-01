// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The Dungeondraft asset pack (`.dungeondraft_pack`): a Godot 3 package
 * (PCK v1) of the pack's art as Dungeondraft reads it, after the reference
 * packer (Dungeondraft-GoPackager, BSD-3-Clause). Pure: the build script
 * reads the images and writes the file.
 *
 * - Its header: "GDPC", format 1, Godot 3.4.2, sixteen reserved words and
 *   the file count, little-endian 32-bit words.
 * - Then an index, an entry per file: its `res://` path's byte length, the
 *   path (unpadded), its offset and size (64-bit) and its MD5.
 * - Then each file's bytes, in index order.
 * - `res://packs/<id>.json` is the pack's `pack.json`; everything else is
 *   under `res://packs/<id>/`: `textures/objects/` (art at 256 px a grid
 *   square), `textures/terrain/`, `data/default.dungeondraft_tags`, and a
 *   thumbnail per texture at `thumbnails/<md5 of its res path>.png`.
 */

/** Dungeondraft's art scale: pixels per grid square. */
export const DD_PX_PER_SQUARE = 256;

const MAGIC = 0x43504447;
const PACK_FORMAT = 1;
const GODOT = [3, 4, 2] as const;
const RESERVED_WORDS = 16;
const MD5_BYTES = 16;

/** One file of the package: its `res://` path, its bytes, and their MD5. */
export interface PckEntry {
    readonly path: string;
    readonly data: Uint8Array;
    readonly md5: Uint8Array;
}

/** The package of `entries`, in their order, as bytes. */
export function encodePck(entries: readonly PckEntry[]): Uint8Array {
    const encoder = new TextEncoder();
    const paths = entries.map((entry) => encoder.encode(entry.path));
    const headerSize = 4 * (5 + RESERVED_WORDS + 1);
    const indexSize = paths.reduce((sum, path) => sum + 4 + path.length + 8 + 8 + MD5_BYTES, 0);
    const dataSize = entries.reduce((sum, entry) => sum + entry.data.length, 0);
    const out = new Uint8Array(headerSize + indexSize + dataSize);
    const view = new DataView(out.buffer);
    let at = 0;
    const u32 = (value: number): void => {
        view.setUint32(at, value, true);
        at += 4;
    };
    const u64 = (value: number): void => {
        view.setBigUint64(at, BigInt(value), true);
        at += 8;
    };
    for (const word of [MAGIC, PACK_FORMAT, ...GODOT]) {
        u32(word);
    }
    at += 4 * RESERVED_WORDS;
    u32(entries.length);
    let offset = headerSize + indexSize;
    entries.forEach((entry, i) => {
        const path = paths[i] ?? new Uint8Array();
        u32(path.length);
        out.set(path, at);
        at += path.length;
        u64(offset);
        u64(entry.data.length);
        out.set(entry.md5, at);
        at += MD5_BYTES;
        offset += entry.data.length;
    });
    for (const entry of entries) {
        out.set(entry.data, at);
        at += entry.data.length;
    }
    return out;
}

/** A path inside the pack, as its `res://` path. */
export const resPath = (packId: string, relative: string): string => `res://packs/${packId}/${relative}`;

/** A file name's safe form: lower case, words joined by `_`. */
export const safeName = (text: string): string =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '_')
        .replace(/^_|_$/gu, '');

/** An object's size in Dungeondraft px, from its placed size in the pack's px at `referenceGridSize` a square. */
export function objectSize(width: number, height: number, referenceGridSize: number): { readonly width: number; readonly height: number } {
    const scale = DD_PX_PER_SQUARE / referenceGridSize;
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Grid squares one tile of a texture spans along its shorter side, where its set does not say (as the engine's canvas). */
export const DEFAULT_TILE_SQUARES = 2;

/** Whether a texture-set role is ground Dungeondraft paints as terrain: every role but the walls (`wall.*`). */
export const isTerrainRole = (role: string): boolean => !role.startsWith('wall.');

/** A terrain texture's size in Dungeondraft px: its proportions, its shorter side `squares` squares. */
export function terrainSize(width: number, height: number, squares: number): { readonly width: number; readonly height: number } {
    const scale = (squares * DD_PX_PER_SQUARE) / Math.min(width, height);
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** The pack's `pack.json`, as Dungeondraft reads it. */
export function packJson(packId: string, title: string, version: string, author: string, keywords: readonly string[]): Record<string, string | boolean> {
    return {
        name: title,
        id: packId,
        version,
        author,
        keywords: keywords.join(','),
        allow_3rd_party_mapping_software_to_read: true,
    };
}

/** The pack's tags file: each tag with its objects (paths within the pack), and tag sets grouping tags. */
export function tagsFile(tags: ReadonlyMap<string, readonly string[]>, sets: ReadonlyMap<string, readonly string[]>): string {
    const sorted = (map: ReadonlyMap<string, readonly string[]>): Record<string, string[]> =>
        Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => [key, [...new Set(values)].sort()]));
    return `${JSON.stringify({ tags: sorted(tags), sets: sorted(sets) }, null, 1)}\n`;
}

/** Which stamps Dungeondraft takes as objects: battlemap-scale art seen from above (it draws every object top-down). */
export function isDungeondraftObject(stamp: { readonly scale: string; readonly perspective: string }): boolean {
    return ['interior', 'exterior'].includes(stamp.scale) && ['orthographic', 'top-down', 'central'].includes(stamp.perspective);
}
