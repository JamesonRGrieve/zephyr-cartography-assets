// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Build the release's four downloads, one per channel of the one module: CC0
 * (only CC0 assets; the default) or Everything (every asset, each under its
 * own licence), each also AI-free (no AI-generated assets). A channel's pack
 * manifest leaves out what it does not carry (`src/channels.ts`). Each archive
 * is the module as Foundry installs it, its `module.json` at the root (naming
 * that channel's own manifest and archive, so updates stay on it), with every
 * file its pack manifest names and nothing else, plus the licence text for
 * that channel and the other authors' credits, stored uncompressed (the
 * images are compressed already). Every entry's name, and the manifest, are
 * checked for publishers' coined terms first. GitHub Releases takes files
 * under 2 GiB, so a larger archive fails here.
 *
 * An asset the pack links on the web (an http(s) address) is downloaded once
 * (cached in `release/.linked/`), bundled at `external/<host>/<path>`, and the
 * channel's manifest points there, so an installed module needs no other
 * server; a link that cannot be fetched fails the build.
 *
 * Writes, to attach to the release, `release/module<suffix>.json` and
 * `release/<id><suffix>.zip` for each channel: no suffix (CC0),
 * `-everything`, `-ai-free` and `-everything-ai-free`.
 *
 *   node scripts/build-zip.ts [--assets <dir>]
 */
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { parseArgs } from 'node:util';
import { compilePack } from '@foundryvtt/foundryvtt-cli';
import archiver from 'archiver';
import { z } from 'zod';
import { parseGalleryIndex } from '../src/catalog.ts';
import {
    CHANNELS,
    type Channel,
    channelFileName,
    channelModule,
    channelPack,
    isAiFree,
    isCc0Only,
    type JsonObject,
    SCENES_PACK_PATH,
} from '../src/channels.ts';
import { bundledPath, isExternal, relinked } from '../src/external.ts';
import { coinedWordsIn } from '../src/trademarks.ts';
import { DEFAULT_MODULE, moduleFiles, PACK_FILE, readModule, stringsIn } from './packs.ts';

const HERE = resolvePath(import.meta.dirname, '..');
const RELEASE = join(HERE, 'release');
/** GitHub Releases' limit on one file. */
const RELEASE_FILE_LIMIT = 2 * 1024 ** 3;
/** The licence text a channel ships as `LICENSE-ART.md`: CC0's, or Everything's (each asset under its own licence). */
const licenseText = (channel: Channel): string => readFileSync(join(HERE, isCc0Only(channel) ? 'LICENSE-ART-CC0.md' : 'LICENSE-ART.md'), 'utf8');
/** What an AI-free release says first in its licence text. */
const AI_FREE_NOTE = '> **AI-free release.** Every AI-generated asset is left out of this release.\n\n';
/** How the generated JSON files are indented, as the pack's own are. */
const JSON_INDENT = 4;
/** Where linked assets are kept once downloaded, so a rebuild fetches each only once. */
const LINKED_CACHE = join(RELEASE, '.linked');
/** How long one linked asset may take to download, in ms. */
const DOWNLOAD_TIMEOUT_MS = 120_000;

/** The linked asset at `url`, downloaded into the cache unless it is there already; its cached file. Fails the build if it cannot be fetched. */
async function fetchLinked(url: string): Promise<string> {
    const cached = join(LINKED_CACHE, bundledPath(url));
    if (!existsSync(cached)) {
        const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
        if (!response.ok) {
            throw new Error(`could not download the linked asset ${url}: HTTP ${response.status}`);
        }
        mkdirSync(dirname(cached), { recursive: true });
        writeFileSync(cached, Buffer.from(await response.arrayBuffer()));
    }
    return cached;
}

const { values: args } = parseArgs({ options: { assets: { type: 'string', default: DEFAULT_MODULE } } });
const assets = readModule(args.assets);
if (!assets.install.download.endsWith(`/${assets.id}.zip`)) {
    throw new Error(`module.json's download (${assets.install.download}) must name ${assets.id}.zip, the archive this builds`);
}
const index = parseGalleryIndex(JSON.parse(readFileSync(join(HERE, 'public', 'stamps.json'), 'utf8')));
if (!index.ok) {
    throw new Error(`public/stamps.json is invalid (run build-index first): ${index.issues.slice(0, 5).join('; ')}`);
}
const asObject = (text: string): JsonObject => z.record(z.string(), z.json()).parse(JSON.parse(text));
const moduleJson = asObject(readFileSync(join(assets.dir, 'module.json'), 'utf8'));
const pack = asObject(assets.manifest);

/** Every file, with its author, its source, its licence and whether it is AI-generated. */
const credited = [
    ...index.value.items.flatMap((item) => item.variants.map((variant) => ({ file: variant.file, ai: item.ai, credit: item.credit, license: item.license }))),
    // Music is in no release (gallery-only), so only the effects have files to credit.
    ...index.value.sounds.flatMap((sound) =>
        sound.kind === 'effect' ? [{ file: sound.file, ai: sound.ai, credit: sound.credit, license: sound.license }] : [],
    ),
];

/** The credits for the files `shipped` (archive paths), as Markdown. */
function creditsFor(shipped: ReadonlySet<string>): string {
    const rows = credited.filter(({ file }) => shipped.has(file.slice(file.indexOf('/') + 1)));
    return [
        '# Credits',
        '',
        `Every file, with its author and source (the asset pack's own repository for art made for it, made available by`,
        `${index.ok ? index.value.curator : ''}), whether it is AI-generated, and its licence (an SPDX id; its text is at`,
        "https://spdx.org/licenses/<id>.html). Follow each licence's terms, such as attribution or share-alike, when you use",
        'that file:',
        '',
        '| File | Author | Source | AI-generated | License |',
        '|------|--------|--------|--------------|---------|',
        ...rows.map(({ file, ai, credit, license }) => `| \`${file}\` | ${credit.author} | ${credit.source} | ${ai ? 'yes' : 'no'} | ${license} |`),
        '',
    ].join('\n');
}

/** Where each channel's scene compendium is built: its source documents, then the compiled pack. */
const SCENES_BUILD = join(RELEASE, '.scenes');

/**
 * The scene documents `shipped` (a channel's pack) names (each scene's `foundry` file), compiled
 * with Foundry's own packer into `channel`'s compendium; its files, each with
 * its path in the archive, none where the channel carries no scenes.
 */
async function sceneCompendium(shipped: JsonObject, channel: Channel): Promise<{ source: string; name: string }[]> {
    const scenes = (Array.isArray(shipped['scenes']) ? shipped['scenes'] : []).flatMap((scene) =>
        typeof scene === 'object' && scene !== null && !Array.isArray(scene) && typeof scene['foundry'] === 'string' ? [scene['foundry']] : [],
    );
    if (scenes.length === 0) {
        return [];
    }
    const source = join(SCENES_BUILD, channel, 'source');
    const compiled = join(SCENES_BUILD, channel, 'pack');
    rmSync(join(SCENES_BUILD, channel), { recursive: true, force: true });
    mkdirSync(source, { recursive: true });
    for (const path of scenes) {
        const scene = asObject(readFileSync(join(assets.dir, path), 'utf8'));
        const id = typeof scene['_id'] === 'string' ? scene['_id'] : null;
        if (id === null) {
            throw new Error(`${path} has no _id: a compendium document needs one`);
        }
        // The packer files each document under its collection by its `_key`.
        writeFileSync(join(source, `${id}.json`), JSON.stringify({ ...scene, _key: `!scenes!${id}` }));
    }
    await compilePack(source, compiled);
    return readdirSync(compiled).map((file) => ({ source: join(compiled, file), name: `${SCENES_PACK_PATH}/${file}` }));
}

/** Write `channel`'s archive and manifest; its file count and archive size. */
async function buildChannel(channel: Channel): Promise<{ files: number; size: number; out: string }> {
    const linkedPack = channelPack(pack, channel);
    // Linked assets are bundled at their fixed paths, and the manifest points there, so the module needs no other server.
    const linked = [...new Set(stringsIn(linkedPack).filter(isExternal))];
    const linkedFiles = await Promise.all(linked.map(async (url) => ({ source: await fetchLinked(url), name: bundledPath(url) })));
    const shippedPack = relinked(linkedPack, new Map(linked.map((url) => [url, bundledPath(url)])));
    const manifestText = `${JSON.stringify(shippedPack, null, JSON_INDENT)}\n`;
    // Scene documents are the pack's own files, never linked, so the channel's pack names them as shipped.
    const compendium = await sceneCompendium(linkedPack, channel);
    const moduleText = `${JSON.stringify(channelModule(moduleJson, assets.install, channel, compendium.length > 0), null, JSON_INDENT)}\n`;
    const generated = new Set(['module.json', PACK_FILE]);
    const entries = [
        ...moduleFiles(assets, manifestText)
            .filter((path) => !generated.has(path) && !path.startsWith('external/'))
            .map((path) => ({ source: join(assets.dir, path), name: path })),
        ...linkedFiles,
        ...compendium,
    ];
    const coined = [
        ...entries.flatMap((entry) => coinedWordsIn(entry.name).map((word) => `"${word}" in ${entry.name}`)),
        ...coinedWordsIn(manifestText).map((word) => `"${word}" in ${PACK_FILE}`),
    ];
    if (coined.length > 0) {
        throw new Error(`coined terms left in the ${channel} archive (rename them in the pack):\n${coined.slice(0, 40).join('\n')}`);
    }

    writeFileSync(join(RELEASE, channelFileName('module.json', channel)), moduleText);
    const out = join(RELEASE, channelFileName(`${assets.id}.zip`, channel));
    const archive = archiver('zip', { store: true });
    const output = createWriteStream(out);
    const done = new Promise<void>((resolve, reject) => {
        output.on('close', () => {
            resolve();
        });
        archive.on('error', reject);
        archive.on('warning', reject);
    });
    archive.pipe(output);
    archive.append(moduleText, { name: 'module.json' });
    archive.append(manifestText, { name: PACK_FILE });
    archive.append(`${isAiFree(channel) ? AI_FREE_NOTE : ''}${licenseText(channel)}`, { name: 'LICENSE-ART.md' });
    archive.append(creditsFor(new Set(entries.map((entry) => entry.name))), { name: 'CREDITS-ART.md' });
    for (const entry of entries) {
        archive.file(entry.source, { name: entry.name });
    }
    await archive.finalize();
    await done;
    const size = archive.pointer();
    if (size >= RELEASE_FILE_LIMIT) {
        throw new Error(`the ${channel} archive is ${(size / 1024 ** 3).toFixed(2)} GiB, over GitHub Releases' 2 GiB limit on one file`);
    }
    return { files: entries.length, size, out };
}

mkdirSync(RELEASE, { recursive: true });
const built = await Promise.all(CHANNELS.map(async (channel) => ({ channel, ...(await buildChannel(channel)) })));
for (const { channel, files, size, out } of built) {
    console.warn(`${channel}: ${files} files, ${(size / 1024 ** 3).toFixed(2)} GiB: ${out}`);
}
