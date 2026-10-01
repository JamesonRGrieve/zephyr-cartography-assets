// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Build the one download: the asset module as Foundry installs it, its
 * `module.json` at the archive's root (as a GitHub release asset Foundry
 * installs from), with every file its manifest names and nothing else in the
 * folder, plus the art's licence and the other authors' credits, stored
 * uncompressed (the images are compressed already). Every entry's name, and
 * the manifest, are checked for publishers' coined terms first. GitHub
 * Releases takes files under 2 GiB, so a larger archive fails here. Writes
 * `release/<module id>.zip` (the name `module.json`'s `download` names), to
 * attach to the release.
 *
 *   node scripts/build-zip.ts [--assets <dir>]
 */
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve as resolvePath } from 'node:path';
import { parseArgs } from 'node:util';
import archiver from 'archiver';
import { parseGalleryIndex } from '../src/catalog.ts';
import { coinedWordsIn } from '../src/trademarks.ts';
import { DEFAULT_MODULE, moduleFiles, PACK_FILE, readModule } from './packs.ts';

const HERE = resolvePath(import.meta.dirname, '..');
/** GitHub Releases' limit on one file. */
const RELEASE_FILE_LIMIT = 2 * 1024 ** 3;
const { values: args } = parseArgs({ options: { assets: { type: 'string', default: DEFAULT_MODULE } } });
const assets = readModule(args.assets);
const OUT = join(HERE, 'release', `${assets.id}.zip`);
if (!assets.install.download.endsWith(`/${assets.id}.zip`)) {
    throw new Error(`module.json's download (${assets.install.download}) must name ${assets.id}.zip, the archive this builds`);
}
const index = parseGalleryIndex(JSON.parse(readFileSync(join(HERE, 'public', 'stamps.json'), 'utf8')));
if (!index.ok) {
    throw new Error(`public/stamps.json is invalid (run build-index first): ${index.issues.slice(0, 5).join('; ')}`);
}

const entries = moduleFiles(assets).map((path) => ({ source: join(assets.dir, path), name: path }));
const coined = [
    ...entries.flatMap((entry) => coinedWordsIn(entry.name).map((word) => `"${word}" in ${entry.name}`)),
    ...coinedWordsIn(assets.manifest).map((word) => `"${word}" in ${PACK_FILE}`),
];
if (coined.length > 0) {
    throw new Error(`coined terms left in the archive (rename them in the pack):\n${coined.slice(0, 40).join('\n')}`);
}

/** The other authors' CC0 work, each with its author and source, as a Markdown table. */
const credited = [
    ...index.value.items.flatMap((item) => (item.credit === null ? [] : item.variants.map((variant) => ({ file: variant.file, credit: item.credit })))),
    ...index.value.sounds.map((sound) => ({ file: sound.file, credit: sound.credit })),
];
const credits = [
    '# Credits',
    '',
    `AI-generated art made available by ${index.value.curator}, CC0 1.0. Other authors' CC0 work:`,
    '',
    '| File | Author | Source |',
    '|------|--------|--------|',
    ...credited.map(({ file, credit }) => `| \`${file}\` | ${credit?.author ?? ''} | ${credit?.source ?? ''} |`),
    '',
].join('\n');

mkdirSync(join(HERE, 'release'), { recursive: true });
const archive = archiver('zip', { store: true });
const output = createWriteStream(OUT);
const done = new Promise<void>((resolve, reject) => {
    output.on('close', () => {
        resolve();
    });
    archive.on('error', reject);
    archive.on('warning', reject);
});
archive.pipe(output);
archive.file(join(HERE, 'LICENSE-ART.md'), { name: 'LICENSE-ART.md' });
archive.append(credits, { name: 'CREDITS-ART.md' });
for (const entry of entries) {
    archive.file(entry.source, { name: entry.name });
}
await archive.finalize();
await done;
const size = archive.pointer();
console.warn(`${entries.length} files, ${(size / 1024 ** 3).toFixed(2)} GiB: ${OUT}`);
if (size >= RELEASE_FILE_LIMIT) {
    throw new Error(`the archive is ${(size / 1024 ** 3).toFixed(2)} GiB, over GitHub Releases' 2 GiB limit on one file`);
}
