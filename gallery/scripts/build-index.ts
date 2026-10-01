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
import { type GalleryIndex, type GalleryItem, type SoundEffect, parseGalleryIndex } from '../src/catalog.ts';
import { releaseLinks } from '../src/channels.ts';
import { bundledPath, isExternal } from '../src/external.ts';
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

type Credit = NonNullable<GalleryItem['credit']>;

/** A web image to make: its source, its size, and where it goes. */
interface WebImage {
    readonly source: string;
    readonly out: string;
    readonly size: (typeof SIZES)[keyof typeof SIZES];
}

const webImages: WebImage[] = [];

/**
 * Record an image of `assetModule` at `path`: its path in the archive, and its
 * thumbnail's and preview's site paths. A linked image (a web address) is
 * shown from its own address, never copied onto the site; the archive bundles
 * it at its fixed path.
 */
function publish(assetModule: Module, path: string): { file: string; thumb: string; preview: string } {
    if (isExternal(path)) {
        return { file: `${assetModule.id}/${bundledPath(path)}`, thumb: path, preview: path };
    }
    const file = `${assetModule.id}/${path}`;
    const webp = `${file.replace(/\.[^./]+$/u, '')}.webp`;
    const source = join(assetModule.dir, path);
    for (const kind of ['thumbs', 'previews'] as const) {
        webImages.push({ source, out: join(HERE, 'public', kind, webp), size: SIZES[kind] });
    }
    return { file, thumb: `thumbs/${webp}`, preview: `previews/${webp}` };
}

/** The resolution step recorded for a linked image at `path`; the build fails without one, as the gallery filters on it. */
function linkedResolution(path: string, resolution: string | undefined): string | undefined {
    if (isExternal(path) && resolution === undefined) {
        throw new Error(`the linked image ${path} records no resolution: give it its closest step (512, 1K, 2K…)`);
    }
    return resolution;
}

/** An image's pixel size, read from the file; unknown (null) for a linked image, which is not fetched. */
async function sizeOf(assetModule: Module, path: string): Promise<{ width: number | null; height: number | null }> {
    if (isExternal(path)) {
        return { width: null, height: null };
    }
    const { width, height } = await sharp(join(assetModule.dir, path)).metadata();
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

/** A piece's origin as the gallery shows it: who made it and where (its credit), its licence, and whether it is AI-generated. */
interface Piece {
    readonly ai: boolean;
    readonly credit: Credit;
    readonly license: string;
}

/**
 * The piece at `path`, from its provenance: its credit (the provenance's
 * author and page, else the CREDITS tables), its licence, and whether it is
 * AI-generated, its own flag apart from its source. The build fails where any
 * is missing, never guessing: no provenance, no `ai`, or the old convention of
 * "ai-generated" as the source.
 */
function pieceOf(provenance: Provenance | undefined, path: string, credits: ReadonlyMap<string, Credit>): Piece {
    if (provenance === undefined) {
        throw new Error(`no provenance for ${path}: give it one with its source, licence and whether it is AI-generated`);
    }
    if (provenance.source === 'ai-generated') {
        throw new Error(
            `${path}'s provenance names "ai-generated" as its source: give its real source (the pack's repository for its own art) and set ai: true`,
        );
    }
    if (provenance.ai === undefined) {
        throw new Error(`${path}'s provenance does not say whether it is AI-generated: set ai: true or ai: false`);
    }
    const own = provenance.author !== undefined && provenance.url !== undefined ? { author: provenance.author, source: provenance.url } : null;
    const credit = own ?? credits.get(path) ?? credits.get(basename(path)) ?? null;
    if (credit === null) {
        throw new Error(`no credit for ${path}: give its provenance an author and a url, or give it a CREDITS row`);
    }
    return { ai: provenance.ai, credit, license: provenance.license };
}

/** The stamps, each image's size read from the image (the manifest's is its footprint on the map), each credited by its provenance. */
async function stampItems(assetModule: Module, credits: ReadonlyMap<string, Credit>): Promise<GalleryItem[]> {
    return Promise.all(
        assetModule.pack.stamps.map(
            async (stamp): Promise<GalleryItem> => ({
                id: `stamp-${stamp.id}`,
                kind: 'stamp',
                ...pieceOf(stamp.provenance, stamp.variants[0]?.image ?? stamp.id, credits),
                name: stamp.name,
                category: stamp.category,
                tags: [...new Set(stamp.tags)],
                scale: stamp.scale,
                perspective: stamp.perspective,
                variants: await Promise.all(
                    stamp.variants.map(async (variant) => ({
                        state: variant.state,
                        ...publish(assetModule, variant.image),
                        ...(await sizeOf(assetModule, variant.image)),
                        ...(linkedResolution(variant.image, variant.resolution) === undefined ? {} : { resolution: variant.resolution }),
                    })),
                ),
            }),
        ),
    );
}

/** A texture set's provider, for its category: its provenance's source, else its id. */
const providerOf = (set: Pack['textureSets'][number]): string => set.provenance?.source ?? set.id;

/**
 * A texture set's images, one item per file (several roles may share one),
 * its roles as tags, each credited by its role's own source, else the set's.
 */
async function textureItems(assetModule: Module, set: Pack['textureSets'][number], credits: ReadonlyMap<string, Credit>): Promise<GalleryItem[]> {
    const byFile = new Map<string, string[]>();
    for (const [role, path] of Object.entries(set.textures)) {
        byFile.set(path, [...(byFile.get(path) ?? []), role]);
    }
    return Promise.all(
        [...byFile].map(async ([path, roles]): Promise<GalleryItem> => {
            const [first = basename(path)] = roles;
            const resolution = linkedResolution(path, set.resolutions?.[first]);
            const piece = pieceOf(set.sources?.[first] ?? set.provenance, path, credits);
            return {
                id: `texture-${set.id}-${basename(path)}`,
                kind: 'texture',
                ...piece,
                name: roleName(first),
                category: piece.ai ? 'Textures' : `Textures (${providerOf(set)})`,
                tags: [...new Set(roles.flatMap((role) => role.split(/[.-]/u)))],
                scale: null,
                perspective: null,
                variants: [
                    {
                        state: roles.join(', '),
                        ...publish(assetModule, path),
                        ...(await sizeOf(assetModule, path)),
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
                ...pieceOf(provenance, path, credits),
                name: `${base.charAt(0).toUpperCase()}${base.slice(1)} Particle`,
                category: 'Particles',
                tags: [...new Set(['particle', ...tags])],
                scale: null,
                perspective: null,
                variants: [{ state: base, ...publish(assetModule, path), ...(await sizeOf(assetModule, path)) }],
            };
        }),
    );
}

/**
 * The ambience's sounds, one per file (several tags may share one): the tags
 * that play it, how many stamps carry one and declare no sound of their own,
 * its reach, its credit; each file copied to the site.
 */
function soundItems(assetModule: Module, credits: ReadonlyMap<string, Credit>): SoundEffect[] {
    const byFile = new Map<string, { triggers: string[]; radius: number; provenance: Provenance | undefined }>();
    for (const [tag, sound] of Object.entries(assetModule.pack.ambience.sounds)) {
        const seen = byFile.get(sound.path);
        byFile.set(sound.path, {
            triggers: [...(seen?.triggers ?? []), tag],
            radius: seen?.radius ?? sound.radius,
            provenance: seen?.provenance ?? sound.provenance,
        });
    }
    return [...byFile].map(([path, { triggers, radius, provenance }]): SoundEffect => {
        // A linked sound plays from its own address; a bundled one is copied onto the site.
        const linked = isExternal(path);
        const audio = linked ? path : `audio/${assetModule.id}/${path}`;
        if (!linked) {
            const source = join(assetModule.dir, path);
            const out = join(HERE, 'public', audio);
            if (!existsSync(out) || statSync(out).mtimeMs < statSync(source).mtimeMs) {
                mkdirSync(dirname(out), { recursive: true });
                copyFileSync(source, out);
            }
        }
        const base = basename(linked ? new URL(path).pathname : path).replace(/\.[^.]+$/u, '');
        const stamps = assetModule.pack.stamps.filter((stamp) => stamp.sound === undefined && stamp.tags.some((tag) => triggers.includes(tag))).length;
        return {
            kind: 'effect',
            id: `sound-${base}`,
            name: `${base.charAt(0).toUpperCase()}${base.slice(1)}`,
            file: `${assetModule.id}/${linked ? bundledPath(path) : path}`,
            audio,
            triggers,
            stamps,
            radius,
            ...pieceOf(provenance, path, credits),
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
const index: GalleryIndex = {
    schemaVersion: 1,
    install: { ...assets.install, releases: releaseLinks(assets.install) },
    curator: args.curator,
    items,
    sounds,
};
const checked = parseGalleryIndex(index);
if (!checked.ok) {
    throw new Error(`the built index is invalid: ${checked.issues.slice(0, 5).join('; ')}`);
}
writeFileSync(join(HERE, 'public', 'stamps.json'), `${JSON.stringify(index)}\n`);
const imagesMade = await makeWebImages();
console.warn(`${items.length} items, ${webImages.length / 2} images (${imagesMade} web images made), ${sounds.length} sounds`);
