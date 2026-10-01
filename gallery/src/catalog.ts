// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The gallery's index: every stamp and texture it shows, as `build-index`
 * writes it from the asset pack and the page reads it back. Validated with
 * zod on both sides, so a stale or hand-edited index is reported, never
 * half-drawn.
 */
import { z } from 'zod';

/** One image of an item: a stamp's variant, or a texture's one tile. */
const galleryVariantSchema = z
    .object({
        state: z.string().min(1).describe('The variant’s label ("lit", "smashed"); a texture’s role.'),
        file: z.string().min(1).describe('Its full-resolution image in the modules archive: the module’s folder, then the path within it.'),
        thumb: z.string().min(1).describe('Its small thumbnail, relative to the site.'),
        preview: z.string().min(1).describe('Its web-sized preview, relative to the site: what is shown and downloaded here.'),
        width: z.number().int().positive().describe('Pixel width of the full image.'),
        height: z.number().int().positive().describe('Pixel height of the full image.'),
        resolution: z.string().optional().describe('The full image’s long side, as a rounded step (512, 1K, 2K).'),
    })
    .strict();

/** Who made an external CC0 item, and where it came from: a courtesy credit, never a requirement. */
const creditSchema = z
    .object({
        author: z.string().min(1),
        source: z.url(),
    })
    .strict();

const galleryItemSchema = z
    .object({
        id: z.string().min(1),
        kind: z.enum(['stamp', 'texture', 'particle']),
        origin: z.enum(['ai', 'external']).describe('AI-generated (no human author, so no copyright), or another author’s CC0 work.'),
        credit: creditSchema.nullable().describe('An external item’s author and source; none for AI-generated art.'),
        name: z.string().min(1),
        category: z.string().min(1),
        tags: z.array(z.string()),
        scale: z.string().nullable().describe('Where it is drawn to be used (interior, exterior, city…); none for a texture.'),
        perspective: z.string().nullable().describe('How it is drawn (orthographic, isometric…); none for a texture.'),
        variants: z.array(galleryVariantSchema).min(1),
    })
    .strict()
    .refine((item) => (item.origin === 'external') === (item.credit !== null), {
        message: 'another author’s work carries its credit (author and source link); AI-generated art carries none',
        path: ['credit'],
    });

/** One ambient sound loop: the stamps it plays for (by tag), how far it carries, and its file, to play and to download. */
const gallerySoundSchema = z
    .object({
        id: z.string().min(1),
        name: z.string().min(1),
        file: z.string().min(1).describe('Its path in the modules archive: the module’s folder, then the path within it.'),
        audio: z.string().min(1).describe('Its copy on the site, played and downloaded here.'),
        triggers: z.array(z.string().min(1)).min(1).describe('The tags whose stamps play it, where they declare no sound of their own.'),
        stamps: z.number().int().min(0).describe('How many stamps carry one of its tags.'),
        radius: z.number().positive().describe('How far it is heard, in grid squares.'),
        credit: creditSchema.nullable(),
        license: z.string().min(1),
    })
    .strict();

/** How the module is installed: Foundry's manifest URL for it, and the archive of its release, both from its own `module.json`. */
const installSchema = z
    .object({
        id: z.string().min(1),
        version: z.string().min(1),
        manifest: z.url().describe('Foundry installs (and updates) the module from this, pasted as its manifest URL.'),
        download: z.url().describe('The release’s archive: everything, at full resolution.'),
    })
    .strict();

const galleryIndexSchema = z
    .object({
        schemaVersion: z.literal(1),
        install: installSchema,
        license: z.string().min(1).describe('The art’s licence, as an SPDX id.'),
        curator: z.string().min(1).describe('Who made the collection available: the credit asked (never required) for the AI-generated art.'),
        items: z.array(galleryItemSchema),
        sounds: z.array(gallerySoundSchema).default([]),
    })
    .strict();

export type GalleryVariant = z.infer<typeof galleryVariantSchema>;
export type GalleryItem = z.infer<typeof galleryItemSchema>;
export type GallerySound = z.infer<typeof gallerySoundSchema>;
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
