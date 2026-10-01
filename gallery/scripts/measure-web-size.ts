// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Estimate the site's size before building it: make the thumbnail and the
 * preview of a random sample of the public module's images in memory, and
 * scale their total to every image. Pages caps a site at 1 GB.
 *
 *   node scripts/measure-web-size.ts [--sample 400]
 */
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { DEFAULT_MODULE, readModule } from './packs.ts';

const SIZES = [
    { name: 'thumbnails', side: 256, quality: 78 },
    { name: 'previews', side: 1024, quality: 82 },
    // Full resolution as WebP: lossy at the preview's quality, and lossless (pixel-exact, as the PNG).
    { name: 'full lossy', side: null, quality: 82 },
    { name: 'full lossless', side: null, quality: null },
] as const;
const { values: args } = parseArgs({ options: { sample: { type: 'string', default: '400' } } });
const assetModule = readModule(DEFAULT_MODULE);
const images = assetModule.pack.stamps.flatMap((stamp) => stamp.variants.map((variant) => join(assetModule.dir, variant.image)));
const sample = images
    .map((image) => ({ image, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .slice(0, Number(args.sample))
    .map(({ image }) => image);
const sides = await Promise.all(
    sample.map(async (image) => {
        const { width, height } = await sharp(image).metadata();
        return Math.max(width, height);
    }),
);
const over = sides.filter((side) => side > SIZES[1].side).length;
const originals = sample.reduce((sum, image) => sum + statSync(image).size, 0) / sample.length;
console.warn(`${over} of ${sample.length} sampled images are over ${SIZES[1].side} px; the PNGs average ${(originals / 1024).toFixed(1)} KiB`);
for (const size of SIZES) {
    // eslint-disable-next-line no-await-in-loop -- one size at a time, so the two passes don't hold every image in memory at once
    const bytes = await Promise.all(
        sample.map(async (image) => {
            const sized = size.side === null ? sharp(image) : sharp(image).resize(size.side, size.side, { fit: 'inside', withoutEnlargement: true });
            return (await (size.quality === null ? sized.webp({ lossless: true }) : sized.webp({ quality: size.quality })).toBuffer()).length;
        }),
    );
    const mean = bytes.reduce((sum, b) => sum + b, 0) / bytes.length;
    console.warn(
        `${size.name}: ${(mean / 1024).toFixed(1)} KiB each over ${sample.length} images → ~${((mean * images.length) / 1024 ** 2).toFixed(0)} MiB for ${
            images.length
        }`,
    );
}
