// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Build the gallery's index, its images and its audio from the asset module:
 *   - its stamps and its painted texture set (AI-generated);
 *   - its photo texture sets and its particle images (other authors' CC0
 *     work), each credited to its author;
 *   - its ambient sounds, each with the tags whose stamps play it.
 * Where each came from is read from the pack's `provenance` (on a stamp, a
 * texture set and each of its textures, a sound, a particle emitter), else
 * from the module's CREDITS tables; another author's work with no credit
 * fails the build.
 *
 * Writes `public/stamps.json`; for every image a 256 px WebP thumbnail
 * (`public/thumbs/`) and a full-resolution lossy WebP preview
 * (`public/previews/`); and every sound file (`public/audio/`), each under the
 * module's folder and its own path. The exact files are in the download
 * (`build-zip`), at the path each records. Any publisher's coined term in a
 * published name, tag or file name (`src/trademarks.ts`) fails the build,
 * listed. Images and audio newer than their source are kept.
 *
 *   node scripts/build-index.ts [--assets <dir>] [--curator <name>]
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { z } from 'zod';
import { type GalleryIndex, type GalleryItem, type GallerySound, parseGalleryIndex } from '../src/catalog.ts';
import { coinedWordsIn } from '../src/trademarks.ts';
import { DEFAULT_MODULE, type Module, moduleFiles, type Pack, type Provenance, readModule, stringsIn } from './packs.ts';

const HERE = resolve(import.meta.dirname, '..');
const { values: args } = parseArgs({
    options: {
        assets: { type: 'string', default: DEFAULT_MODULE },
        curator: { type: 'string', default: 'Jameson Grieve' },
    },
});

/** Each web image's long side (px; null keeps the image's own) and WebP quality: a grid thumbnail, and the preview shown and downloaded. */
const SIZES = { thumbs: { side: 256, quality: 78 }, previews: { side: null, quality: 82 } } as const;
/** Images made at once. */
const WORKERS = 8;
/** What every AI-generated piece here is published under. */
const AI_LICENSE = 'CC0-1.0';

type Credit = NonNullable<GalleryItem['credit']>;

/** A web image to make: its source, its size, and where it goes. */
interface WebImage {
    readonly source: string;
    readonly out: string;
    readonly size: (typeof SIZES)[keyof typeof SIZES];
}

const webImages: WebImage[] = [];

/** Record an image of `assetModule` at `path`: its path in the archive, and its thumbnail's and preview's site paths. */
function publish(assetModule: Module, path: string): { file: string; thumb: string; preview: string } {
    const file = `${assetModule.id}/${path}`;
    const webp = `${file.replace(/\.[^./]+$/u, '')}.webp`;
    const source = join(assetModule.dir, path);
    for (const kind of ['thumbs', 'previews'] as const) {
        webImages.push({ source, out: join(HERE, 'public', kind, webp), size: SIZES[kind] });
    }
    return { file, thumb: `thumbs/${webp}`, preview: `previews/${webp}` };
}

/** An image's pixel size, read from the file. */
async function sizeOf(source: string): Promise<{ width: number; height: number }> {
    const { width, height } = await sharp(source).metadata();
    return { width, height };
}

/** Title-case words of a role (`floor.crimson-carpet` → `Crimson Carpet Floor`). */
function roleName(role: string): string {
    const [kind, base] = role.includes('.') ? role.split('.', 2) : ['', role];
    const words = `${base ?? ''} ${kind ?? ''}`.trim().split(/[\s-]+/u);
    return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/**
 * Who made each file, from every CREDITS table in the module: a Markdown
 * table with a file column (`File`), an author column (`Author`/`Author(s)`)
 * and a link column (`Source`, its cells links), keyed by the file's path as
 * written and by its name alone.
 */
function creditTables(assetModule: Module): Map<string, Credit> {
    const credits = new Map<string, Credit>();
    const tables = moduleFiles(assetModule).filter((path) => basename(path).endsWith('CREDITS.md'));
    for (const table of tables) {
        const rows = readFileSync(join(assetModule.dir, table), 'utf8')
            .split('\n')
            .filter((line) => line.trim().startsWith('|'))
            .map((line) =>
                line
                    .split('|')
                    .slice(1, -1)
                    .map((cell) => cell.trim().replaceAll('`', '')),
            );
        const [header = []] = rows;
        const column = (pattern: RegExp): number => header.findIndex((cell) => pattern.test(cell));
        const [file, author, source] = [column(/^file$/iu), column(/^author/iu), column(/^source$/iu)];
        for (const cells of rows.slice(1)) {
            const [path, by, url] = [cells[file] ?? '', cells[author] ?? '', cells[source] ?? ''];
            if (path !== '' && by !== '' && /^https?:\/\//u.test(url)) {
                credits.set(path, { author: by, source: url });
                credits.set(basename(path), { author: by, source: url });
            }
        }
    }
    return credits;
}

/** A credit from a provenance with an author and a page; none from AI-generated art's or a bare one. */
const creditOf = (provenance: Provenance | undefined): Credit | null =>
    provenance?.author !== undefined && provenance.url !== undefined && provenance.source !== 'ai-generated'
        ? { author: provenance.author, source: provenance.url }
        : null;

/** The credit for another author's file at `path`: its provenance's, else the CREDITS tables'; failing the build where neither has one. */
function externalCredit(provenance: Provenance | undefined, path: string, credits: ReadonlyMap<string, Credit>): Credit {
    const credit = creditOf(provenance) ?? credits.get(path) ?? credits.get(basename(path)) ?? null;
    if (credit === null) {
        throw new Error(`no credit for ${path}: give it a provenance with an author and a url, or a CREDITS row`);
    }
    return credit;
}

/** Whether a piece is AI-generated: its provenance says so, or it records none (the stamps were all generated before provenance was). */
const aiMade = (provenance: Provenance | undefined): boolean => provenance === undefined || provenance.source === 'ai-generated';

/**
 * The stamps, each image's size read from the image (the manifest's is its
 * footprint on the map): AI-generated, or another author's, credited by its
 * provenance or the CREDITS tables.
 */
async function stampItems(assetModule: Module, credits: ReadonlyMap<string, Credit>): Promise<GalleryItem[]> {
    return Promise.all(
        assetModule.pack.stamps.map(
            async (stamp): Promise<GalleryItem> => ({
                id: `stamp-${stamp.id}`,
                kind: 'stamp',
                origin: aiMade(stamp.provenance) ? 'ai' : 'external',
                credit: aiMade(stamp.provenance) ? null : externalCredit(stamp.provenance, stamp.variants[0]?.image ?? stamp.id, credits),
                name: stamp.name,
                category: stamp.category,
                tags: [...new Set(stamp.tags)],
                scale: stamp.scale,
                perspective: stamp.perspective,
                variants: await Promise.all(
                    stamp.variants.map(async (variant) => ({
                        state: variant.state,
                        ...publish(assetModule, variant.image),
                        ...(await sizeOf(join(assetModule.dir, variant.image))),
                        ...(variant.resolution === undefined ? {} : { resolution: variant.resolution }),
                    })),
                ),
            }),
        ),
    );
}

/** Whether a texture set is AI-generated: its provenance says so, or (unrecorded) it is the painted set. */
const aiSet = (set: Pack['textureSets'][number]): boolean => (set.provenance === undefined ? set.id === 'painted' : aiMade(set.provenance));

/** A texture set's provider, for its category: its provenance's source, else its id. */
const providerOf = (set: Pack['textureSets'][number]): string => set.provenance?.source ?? set.id;

/**
 * A texture set's images, one item per file (several roles may share one),
 * its roles as tags: an AI-generated set as such, another author's credited
 * file by file.
 */
async function textureItems(assetModule: Module, set: Pack['textureSets'][number], credits: ReadonlyMap<string, Credit>): Promise<GalleryItem[]> {
    const byFile = new Map<string, string[]>();
    for (const [role, path] of Object.entries(set.textures)) {
        byFile.set(path, [...(byFile.get(path) ?? []), role]);
    }
    const ai = aiSet(set);
    return Promise.all(
        [...byFile].map(async ([path, roles]): Promise<GalleryItem> => {
            const [first = basename(path)] = roles;
            const resolution = set.resolutions?.[first];
            return {
                id: `texture-${set.id}-${basename(path)}`,
                kind: 'texture',
                origin: ai ? 'ai' : 'external',
                credit: ai ? null : externalCredit(set.sources?.[first] ?? set.provenance, path, credits),
                name: roleName(first),
                category: ai ? 'Textures' : `Textures (${providerOf(set)})`,
                tags: [...new Set(roles.flatMap((role) => role.split(/[.-]/u)))],
                scale: null,
                perspective: null,
                variants: [
                    {
                        state: roles.join(', '),
                        ...publish(assetModule, path),
                        ...(await sizeOf(join(assetModule.dir, path))),
                        ...(resolution === undefined ? {} : { resolution }),
                    },
                ],
            };
        }),
    );
}

/** The ambience's particle images, one item per image, each credited by its emitter's provenance or the CREDITS tables. */
async function particleItems(assetModule: Module, credits: ReadonlyMap<string, Credit>): Promise<GalleryItem[]> {
    const byImage = new Map<string, { provenance: Provenance | undefined; tags: string[] }>();
    for (const [tag, emitters] of Object.entries(assetModule.pack.ambience.particles)) {
        for (const emitter of emitters) {
            for (const path of emitter.textures) {
                const seen = byImage.get(path);
                byImage.set(path, { provenance: seen?.provenance ?? emitter.provenance, tags: [...(seen?.tags ?? []), tag] });
            }
        }
    }
    return Promise.all(
        [...byImage].map(async ([path, { provenance, tags }]): Promise<GalleryItem> => {
            const base = basename(path).replace(/\.[^.]+$/u, '');
            return {
                id: `particle-${base}`,
                kind: 'particle',
                origin: 'external',
                credit: externalCredit(provenance, path, credits),
                name: `${base.charAt(0).toUpperCase()}${base.slice(1)} Particle`,
                category: 'Particles',
                tags: [...new Set(['particle', ...tags])],
                scale: null,
                perspective: null,
                variants: [{ state: base, ...publish(assetModule, path), ...(await sizeOf(join(assetModule.dir, path))) }],
            };
        }),
    );
}

/**
 * The ambience's sounds, one per file (several tags may share one): the tags
 * that play it, how many stamps carry one and declare no sound of their own,
 * its reach, its credit; each file copied to the site.
 */
function soundItems(assetModule: Module, credits: ReadonlyMap<string, Credit>): GallerySound[] {
    const byFile = new Map<string, { triggers: string[]; radius: number; provenance: Provenance | undefined }>();
    for (const [tag, sound] of Object.entries(assetModule.pack.ambience.sounds)) {
        const seen = byFile.get(sound.path);
        byFile.set(sound.path, {
            triggers: [...(seen?.triggers ?? []), tag],
            radius: seen?.radius ?? sound.radius,
            provenance: seen?.provenance ?? sound.provenance,
        });
    }
    return [...byFile].map(([path, { triggers, radius, provenance }]): GallerySound => {
        const audio = `audio/${assetModule.id}/${path}`;
        const source = join(assetModule.dir, path);
        const out = join(HERE, 'public', audio);
        if (!existsSync(out) || statSync(out).mtimeMs < statSync(source).mtimeMs) {
            mkdirSync(dirname(out), { recursive: true });
            copyFileSync(source, out);
        }
        const base = basename(path).replace(/\.[^.]+$/u, '');
        const stamps = assetModule.pack.stamps.filter((stamp) => stamp.sound === undefined && stamp.tags.some((tag) => triggers.includes(tag))).length;
        return {
            id: `sound-${base}`,
            name: `${base.charAt(0).toUpperCase()}${base.slice(1)}`,
            file: `${assetModule.id}/${path}`,
            audio,
            triggers,
            stamps,
            radius,
            credit: externalCredit(provenance, path, credits),
            license: provenance?.license ?? AI_LICENSE,
        };
    });
}

/** Where the sizes the web images were last made at are kept: other sizes make every one again. */
const MADE_AT = join(HERE, 'public', 'web-image-sizes.json');

/**
 * Make every web image not already newer than its source, a few at a time,
 * or every one where the sizes have changed since they were made; how many
 * were made.
 */
async function makeWebImages(): Promise<number> {
    const sizes = JSON.stringify(SIZES);
    const resized = !existsSync(MADE_AT) || readFileSync(MADE_AT, 'utf8').trim() !== sizes;
    const todo = webImages.filter(({ source, out }) => resized || !existsSync(out) || statSync(out).mtimeMs < statSync(source).mtimeMs);
    let next = 0;
    const worker = async (): Promise<void> => {
        for (let i = next++; i < todo.length; i = next++) {
            const job = todo[i];
            if (job !== undefined) {
                mkdirSync(dirname(job.out), { recursive: true });
                const image =
                    job.size.side === null
                        ? sharp(job.source)
                        : sharp(job.source).resize(job.size.side, job.size.side, { fit: 'inside', withoutEnlargement: true });
                // eslint-disable-next-line no-await-in-loop -- each worker makes its images one at a time
                await image
                    .webp({ quality: job.size.quality })
                    .toFile(job.out)
                    .catch((error: Error) => {
                        throw new Error(`${job.source}: ${error.message}`);
                    });
            }
        }
    };
    await Promise.all(Array.from({ length: WORKERS }, worker));
    writeFileSync(MADE_AT, `${sizes}\n`);
    return todo.length;
}

const assets = readModule(args.assets);
const creditTable = creditTables(assets);
const items: GalleryItem[] = [
    ...(await stampItems(assets, creditTable)),
    ...(await Promise.all(assets.pack.textureSets.map(async (set) => textureItems(assets, set, creditTable)))).flat(),
    ...(await particleItems(assets, creditTable)),
];
const sounds = soundItems(assets, creditTable);
// Every published string (names, categories, tags, states, paths), not a chosen few: a field left out is where a term slips through.
const coined = [...items, ...sounds].flatMap((entry) =>
    stringsIn(z.json().parse(entry)).flatMap((text) => coinedWordsIn(text).map((word) => `${entry.name}: "${word}" in "${text}"`)),
);
if (coined.length > 0) {
    throw new Error(`coined terms left in ${coined.length} published names (rename them in the pack):\n${coined.slice(0, 40).join('\n')}`);
}
const index: GalleryIndex = { schemaVersion: 1, install: assets.install, license: AI_LICENSE, curator: args.curator, items, sounds };
const checked = parseGalleryIndex(index);
if (!checked.ok) {
    throw new Error(`the built index is invalid: ${checked.issues.slice(0, 5).join('; ')}`);
}
writeFileSync(join(HERE, 'public', 'stamps.json'), `${JSON.stringify(index)}\n`);
const imagesMade = await makeWebImages();
console.warn(`${items.length} items, ${webImages.length / 2} images (${imagesMade} web images made), ${sounds.length} sounds`);
