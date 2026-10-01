// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The gallery's index: every stamp and texture it shows, as `build-index`
 * writes it from the asset pack and the page reads it back. Validated with
 * zod on both sides, so a stale or hand-edited index is reported, never
 * half-drawn.
 */
import { z } from 'zod';
// The .ts extension lets Node run the build scripts that import this without a build.
import { CHANNELS } from './channels.ts';
import { isOpenLicense } from './licenses.ts';
import { ART_STYLES } from './styles.ts';

/** One image of an item: a stamp's variant, or a texture's one tile. */
const galleryVariantSchema = z
    .object({
        state: z.string().min(1).describe('The variant’s label ("lit", "smashed"); a texture’s role.'),
        file: z.string().min(1).describe('Its full-resolution image in the modules archive: the module’s folder, then the path within it.'),
        thumb: z.string().min(1).describe('Its small thumbnail, relative to the site; a linked image’s own address.'),
        preview: z.string().min(1).describe('Its web-sized preview, relative to the site, what is shown and downloaded here; a linked image’s own address.'),
        width: z.number().int().positive().nullable().describe('Pixel width of the full image; unknown (null) for a linked one.'),
        height: z.number().int().positive().nullable().describe('Pixel height of the full image; unknown (null) for a linked one.'),
        resolution: z.string().optional().describe('The full image’s long side, as a rounded step (512, 1K, 2K).'),
        video: z
            .string()
            .min(1)
            .optional()
            .describe(
                'An animated effect’s video (WebM with alpha), relative to the site: played and downloaded here; its thumb and preview are a still of it.',
            ),
    })
    .strict();

/** Who made a piece, and where it came from (the pack's own repository for art made for it): a credit every piece carries. */
const creditSchema = z
    .object({
        author: z.string().min(1),
        source: z.url(),
    })
    .strict();

/** A piece's licence: an SPDX id of an open licence (CC0, CC BY, CC BY-SA, MIT, Apache, GPL…), never a non-commercial or no-derivatives one. */
const licenseSchema = z
    .string()
    .refine(isOpenLicense, { message: 'an SPDX id of an open licence (no non-commercial or no-derivatives licences)' })
    .describe('Its licence, as an SPDX id.');

const galleryItemSchema = z
    .object({
        id: z.string().min(1),
        kind: z
            .enum(['stamp', 'tile', 'token', 'character', 'texture', 'particle', 'scene'])
            .describe('Its class: a stamp, a modular battlemap tile, a token, character art, a texture, a particle effect or a full scene.'),
        ai: z.boolean().describe('Whether it is AI-generated, its own flag apart from where it came from.'),
        credit: creditSchema.describe('Its author and source: the pack’s repository for art made for it.'),
        license: licenseSchema,
        style: z.enum(ART_STYLES).describe('How its art is made.'),
        name: z.string().min(1),
        category: z.string().min(1),
        tags: z.array(z.string()),
        scale: z.string().nullable().describe('Where it is drawn to be used (interior, exterior, city…); none for a texture.'),
        perspective: z.string().nullable().describe('How it is drawn (orthographic, isometric…); none for a texture.'),
        grid: z
            .object({ w: z.number().positive(), h: z.number().positive(), size: z.number().int().positive() })
            .strict()
            .optional()
            .describe('A scene’s size in grid squares and its pixels per square.'),
        variants: z.array(galleryVariantSchema).min(1).describe('Its images: a stamp’s variants, a scene’s levels.'),
    })
    .strict();

/**
 * One sound effect, and its file, to play and to download: an ambient loop
 * the stamps carrying one of its tags play (how many, and how far it
 * carries), or a library sound (no tags, no reach) that loops or plays once.
 */
const soundEffectSchema = z
    .object({
        kind: z.literal('effect'),
        id: z.string().min(1),
        name: z.string().min(1),
        category: z.string().min(1).optional().describe('A library sound’s group; none for an ambient loop.'),
        file: z.string().min(1).describe('Its path in the modules archive: the module’s folder, then the path within it.'),
        audio: z.string().min(1).describe('Its copy on the site, played and downloaded here.'),
        triggers: z.array(z.string().min(1)).describe('The tags whose stamps play it, where they declare no sound of their own; none for a library sound.'),
        stamps: z.number().int().min(0).describe('How many stamps carry one of its tags.'),
        radius: z.number().positive().nullable().describe('How far it is heard, in grid squares; none for a library sound.'),
        loop: z.boolean().describe('Whether it loops, or plays once.'),
        ai: z.boolean().describe('Whether it is AI-generated.'),
        credit: creditSchema,
        license: licenseSchema,
    })
    .strict();

/**
 * One music track, in no release: a short preview of it on the site to play,
 * and its author's page (its credit's source) for the whole track.
 */
const musicTrackSchema = z
    .object({
        kind: z.literal('music'),
        id: z.string().min(1),
        name: z.string().min(1),
        category: z.string().min(1).describe('Its group (its album or pack, or a mood).'),
        audio: z.string().min(1).describe('Its preview on the site (its first 30 seconds): the whole track is at its credit’s source.'),
        ai: z.boolean().describe('Whether it is AI-generated.'),
        credit: creditSchema,
        license: licenseSchema,
    })
    .strict();

const gallerySoundSchema = z.discriminatedUnion('kind', [soundEffectSchema, musicTrackSchema]);

/** How the module is installed: the default (CC0) release's manifest URL and archive (from its own `module.json`), and every release's. */
const installSchema = z
    .object({
        id: z.string().min(1),
        version: z.string().min(1),
        manifest: z.url().describe('Foundry installs (and updates) the module from this, pasted as its manifest URL.'),
        download: z.url().describe('The CC0 release’s archive: every CC0 asset, at full resolution.'),
        releases: z
            .record(z.enum(CHANNELS), z.object({ manifest: z.url(), download: z.url() }).strict())
            .describe('Every release’s manifest and archive: CC0 or Everything, each also AI-free.'),
    })
    .strict();

const galleryIndexSchema = z
    .object({
        schemaVersion: z.literal(1),
        install: installSchema,
        curator: z.string().min(1).describe('Who made the collection available: the credit asked (never required) for the AI-generated art.'),
        items: z.array(galleryItemSchema),
        sounds: z.array(gallerySoundSchema).default([]),
    })
    .strict();

export type GalleryVariant = z.infer<typeof galleryVariantSchema>;
export type GalleryItem = z.infer<typeof galleryItemSchema>;
export type GallerySound = z.infer<typeof gallerySoundSchema>;
export type SoundEffect = z.infer<typeof soundEffectSchema>;
export type MusicTrack = z.infer<typeof musicTrackSchema>;
export type GalleryInstall = z.infer<typeof installSchema>;
export type GalleryIndex = z.infer<typeof galleryIndexSchema>;

/** The index, or what is wrong with it. */
export type Parsed<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly issues: readonly string[] };

/** Read a gallery index (parsed JSON of any shape) and say what is wrong with it if it is not one. */
// eslint-disable-next-line no-restricted-syntax -- boundary: parsed JSON of any shape, validated here
export function parseGalleryIndex(json: unknown): Parsed<GalleryIndex> {
    const result = galleryIndexSchema.safeParse(json);
    return result.success ? { ok: true, value: result.data } : { ok: false, issues: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
}
