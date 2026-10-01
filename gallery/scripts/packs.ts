// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The asset module the gallery and the download are built from:
 * `zephyr-cartography-assets`, its AI-generated art under `ai/` and other
 * authors' CC0 work under `cc0/`. The private pack is never read. It is a
 * Foundry module folder: its `module.json`, its pack manifest, and the files
 * the manifest names.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { z } from 'zod';

const HERE = resolve(import.meta.dirname, '..');

/** The pack manifest's file name, at the module's root. */
export const PACK_FILE = 'zephyr-pack.json';

/** The module's folder, unless given: the canonical asset module in the campaign workspace this repository sits in. */
export const DEFAULT_MODULE = resolve(HERE, '..', '..', '.foundry-cartography-assets');

/** Where an asset came from (the pack schema's `provenance`). */
const provenanceSchema = z.object({
    source: z.string(),
    license: z.string(),
    author: z.string().optional(),
    url: z.string().optional(),
    ai: z.boolean().optional(),
});

export type Provenance = z.infer<typeof provenanceSchema>;

const soundSchema = z.object({ path: z.string(), radius: z.number(), provenance: provenanceSchema.optional() });
const emitterSchema = z.object({ textures: z.array(z.string()), provenance: provenanceSchema.optional(), style: z.string().optional() });

/** The parts of a pack manifest the gallery reads (the rest is the plugin's). */
const packSchema = z.object({
    stamps: z.array(
        z.object({
            id: z.string(),
            name: z.string(),
            category: z.string(),
            tags: z.array(z.string()),
            scale: z.string(),
            perspective: z.string(),
            provenance: provenanceSchema.optional(),
            style: z.string().optional(),
            sound: soundSchema.optional(),
            variants: z.array(z.object({ state: z.string(), image: z.string(), resolution: z.string().optional() })),
        }),
    ),
    textureSets: z.array(
        z.object({
            id: z.string(),
            license: z.string(),
            credits: z.string().optional(),
            textures: z.record(z.string(), z.string()),
            resolutions: z.record(z.string(), z.string()).optional(),
            provenance: provenanceSchema.optional(),
            style: z.string().optional(),
            sources: z.record(z.string(), provenanceSchema).optional(),
        }),
    ),
    ambience: z
        .object({ sounds: z.record(z.string(), soundSchema).default({}), particles: z.record(z.string(), z.array(emitterSchema)).default({}) })
        .default({ sounds: {}, particles: {} }),
});

export type Pack = z.infer<typeof packSchema>;

/** What `module.json` says about installing the module: its id (the folder Foundry installs it under), version, manifest URL and release archive. */
const installSchema = z.object({ id: z.string().min(1), version: z.string().min(1), manifest: z.url(), download: z.url() });

export type Install = z.infer<typeof installSchema>;

/** A module folder: its install facts, its manifest, and the manifest's raw JSON. */
export interface Module {
    readonly dir: string;
    readonly id: string;
    readonly install: Install;
    readonly pack: Pack;
    readonly manifest: string;
}

/** Read the module in `dir`. */
export function readModule(dir: string): Module {
    const install = installSchema.parse(JSON.parse(readFileSync(join(dir, 'module.json'), 'utf8')));
    const manifest = readFileSync(join(dir, PACK_FILE), 'utf8');
    return { dir, id: install.id, install, pack: packSchema.parse(JSON.parse(manifest)), manifest };
}

type Json = z.infer<ReturnType<typeof z.json>>;

/** Every string in `json`, however deeply nested. */
export function stringsIn(json: Json): string[] {
    if (typeof json === 'string') {
        return [json];
    }
    if (Array.isArray(json)) {
        return json.flatMap(stringsIn);
    }
    return json !== null && typeof json === 'object' ? Object.values(json).flatMap(stringsIn) : [];
}

/**
 * The files the module installs: its `module.json`, its manifest, its README,
 * licence and credits, and every file the manifest names (images, previews,
 * sounds, particle and door textures, credits), each relative to the module
 * folder. `manifest` is the pack manifest's text to read them from: the
 * module's own unless given (a release channel's, with assets left out).
 */
export function moduleFiles(assetModule: Module, manifest = assetModule.manifest): string[] {
    const named = stringsIn(z.json().parse(JSON.parse(manifest))).filter((path) => !path.includes('://') && !path.startsWith('/'));
    const own = ['module.json', PACK_FILE, 'README.md', 'LICENSE', 'LICENSE.md', 'CREDITS.md'];
    return [...new Set([...own, ...named])].filter((path) => {
        const file = join(assetModule.dir, path);
        return existsSync(file) && statSync(file).isFile();
    });
}
