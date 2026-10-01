// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Build the Dungeondraft asset packs, one per release channel (CC0,
 * Everything, each also AI-free), from what that channel's pack manifest
 * carries (`channelPack`):
 *   - its stamps Dungeondraft can draw as objects (battlemap scale, seen from
 *     above), each variant resized to Dungeondraft's 256 px a grid square
 *     from its placed size, tagged by its category and its settings;
 *   - its texture sets' ground images (not their walls) as terrain, sized
 *     to the squares one tile spans;
 *   - a thumbnail of each, as Dungeondraft's own packer makes them.
 * Writes `release/<module id><suffix>.dungeondraft_pack`, beside the release's zip.
 * Linked (web) images are left out: a pack carries no one else's server.
 *
 *   node scripts/build-dungeondraft.ts [--assets <dir>]
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { z } from 'zod';
import { CHANNELS, type Channel, channelFileName, channelPack, type JsonObject, RELEASE_LABELS } from '../src/channels.ts';
import {
    DEFAULT_TILE_SQUARES,
    encodePck,
    isDungeondraftObject,
    isTerrainRole,
    objectSize,
    packJson,
    type PckEntry,
    resPath,
    safeName,
    tagsFile,
    terrainSize,
} from '../src/dungeondraft.ts';
import { isExternal } from '../src/external.ts';
import { settingLabel } from '../src/filter.ts';
import { DEFAULT_MODULE, readModule } from './packs.ts';

const HERE = resolve(import.meta.dirname, '..');
const RELEASE = join(HERE, 'release');
/** Object thumbnails' height and terrain thumbnails' height, in px, as the reference packer makes them. */
const OBJECT_THUMB = 64;
const TERRAIN_THUMB = 160;
/** WebP quality of the art (Dungeondraft reads WebP). */
const QUALITY = 90;
/** Images made at once. */
const WORKERS = 8;
/** The tag set every object's category tag belongs to, in Dungeondraft's asset browser. */
const TAG_SET = 'Zephyr Cartography';

const stampSchema = z.object({
    name: z.string(),
    category: z.string(),
    tags: z.array(z.string()),
    scale: z.string(),
    perspective: z.string(),
    variants: z.array(z.object({ state: z.string(), image: z.string(), width: z.number(), height: z.number() })),
});
const textureSetSchema = z.object({
    id: z.string(),
    textures: z.record(z.string(), z.string()),
    tileSquares: z.record(z.string(), z.number()).optional(),
});
const packSchema = z.object({ referenceGridSize: z.number(), stamps: z.array(stampSchema), textureSets: z.array(textureSetSchema) });

const { values: args } = parseArgs({ options: { assets: { type: 'string', default: DEFAULT_MODULE } } });
const assets = readModule(args.assets);
const moduleJson = z
    .object({ version: z.string(), authors: z.array(z.object({ name: z.string() })).optional() })
    .parse(JSON.parse(readFileSync(join(assets.dir, 'module.json'), 'utf8')));
const pack = z.record(z.string(), z.json()).parse(JSON.parse(assets.manifest));

const md5 = (data: Uint8Array | string): Uint8Array => new Uint8Array(createHash('md5').update(data).digest());

/** A pack id for `channel`: eight letters and digits fixed by the module and channel, as Dungeondraft's ids are. */
const packIdOf = (channel: Channel): string => createHash('sha256').update(`${assets.id}/${channel}`).digest('hex').slice(0, 8);

/** A file of the pack to make: its path within the pack and how its bytes are made. */
interface Job {
    readonly relative: string;
    readonly make: () => Promise<Buffer>;
}

/** Run `jobs` a few at a time, keeping their order. */
async function runAll(jobs: readonly Job[]): Promise<{ relative: string; data: Buffer }[]> {
    const out: { relative: string; data: Buffer }[] = [];
    let next = 0;
    const worker = async (): Promise<void> => {
        for (let i = next++; i < jobs.length; i = next++) {
            const job = jobs[i];
            if (job !== undefined) {
                // eslint-disable-next-line no-await-in-loop -- each worker makes its images one at a time
                out[i] = { relative: job.relative, data: await job.make() };
            }
        }
    };
    await Promise.all(Array.from({ length: WORKERS }, worker));
    return out;
}

/** `channel`'s Dungeondraft pack; how many objects and terrain textures it holds, and its file. */
async function buildChannel(channel: Channel): Promise<{ objects: number; terrain: number; out: string }> {
    const shipped = packSchema.parse(channelPack(pack, channel) satisfies JsonObject);
    const packId = packIdOf(channel);
    const jobs: Job[] = [];
    const tags = new Map<string, string[]>();
    const tag = (tagName: string, relative: string): void => {
        tags.set(tagName, [...(tags.get(tagName) ?? []), relative]);
    };
    const used = new Set<string>();
    const unique = (base: string): string => {
        let candidate = `${base}.webp`;
        for (let n = 2; used.has(candidate); n++) {
            candidate = `${base}_${n}.webp`;
        }
        used.add(candidate);
        return candidate;
    };
    let objects = 0;
    for (const stamp of shipped.stamps.filter(isDungeondraftObject)) {
        for (const variant of stamp.variants.filter((v) => !isExternal(v.image))) {
            const relative = unique(`textures/objects/${safeName(stamp.category)}/${safeName(stamp.name)}_${safeName(variant.state)}`);
            const size = objectSize(variant.width, variant.height, shipped.referenceGridSize);
            const source = join(assets.dir, variant.image);
            jobs.push({ relative, make: async () => sharp(source).resize(size.width, size.height, { fit: 'fill' }).webp({ quality: QUALITY }).toBuffer() });
            jobs.push({
                relative: `thumbnails/${createHash('md5').update(resPath(packId, relative)).digest('hex')}.png`,
                make: async () => sharp(source).resize({ height: OBJECT_THUMB }).png().toBuffer(),
            });
            tag(stamp.category, relative);
            for (const setting of stamp.tags.filter((t) => t.startsWith('setting-'))) {
                tag(`Setting: ${settingLabel(setting)}`, relative);
            }
            objects++;
        }
    }
    let terrain = 0;
    for (const set of shipped.textureSets) {
        for (const [role, path] of Object.entries(set.textures)) {
            if (!isTerrainRole(role) || isExternal(path) || !/\.(png|jpe?g|webp)$/iu.test(path)) {
                continue;
            }
            const relative = unique(`textures/terrain/${safeName(set.id)}_${safeName(role)}`);
            const source = join(assets.dir, path);
            const squares = set.tileSquares?.[role] ?? DEFAULT_TILE_SQUARES;
            jobs.push({
                relative,
                make: async () => {
                    const { width = 1, height = 1 } = await sharp(source).metadata();
                    const size = terrainSize(width, height, squares);
                    return sharp(source).resize(size.width, size.height, { fit: 'fill' }).webp({ quality: QUALITY }).toBuffer();
                },
            });
            jobs.push({
                relative: `thumbnails/${createHash('md5').update(resPath(packId, relative)).digest('hex')}.png`,
                make: async () => sharp(source).resize({ height: TERRAIN_THUMB }).flatten().png().toBuffer(),
            });
            terrain++;
        }
    }
    const made = await runAll(jobs);
    const author = moduleJson.authors?.[0]?.name ?? 'Jameson Grieve';
    const manifest = JSON.stringify(
        packJson(packId, `Zephyr Cartography (${RELEASE_LABELS[channel]})`, moduleJson.version, author, ['battlemap', 'cartography', channel]),
    );
    const categories = [...new Set(shipped.stamps.filter(isDungeondraftObject).map((s) => s.category))];
    const tagText = tagsFile(tags, new Map([[TAG_SET, categories]]));
    const entries: PckEntry[] = [
        { path: `res://packs/${packId}.json`, data: new TextEncoder().encode(manifest), md5: md5(manifest) },
        { path: resPath(packId, 'data/default.dungeondraft_tags'), data: new TextEncoder().encode(tagText), md5: md5(tagText) },
        ...made.map(({ relative, data }) => ({ path: resPath(packId, relative), data: new Uint8Array(data), md5: md5(data) })),
    ];
    mkdirSync(RELEASE, { recursive: true });
    // Named after the release's archive, as the install dialog links it (`dungeondraftLink`).
    const out = join(RELEASE, channelFileName(`${assets.id}.dungeondraft_pack`, channel));
    writeFileSync(out, encodePck(entries));
    return { objects, terrain, out };
}

// One channel at a time: a pack is built in memory.
for (const channel of CHANNELS) {
    // eslint-disable-next-line no-await-in-loop -- one pack at a time keeps memory to one pack's images
    const { objects, terrain, out } = await buildChannel(channel);
    console.warn(`${channel}: ${objects} objects, ${terrain} terrain textures: ${out}`);
}
