// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * The module's four release channels, one module id: CC0 (only CC0 assets)
 * or Everything (each asset under its own licence), each also AI-free (no
 * AI-generated assets). `cc0` (CC0, AI art included) is the default; there is
 * no AI-only release. Each channel has its own
 * manifest and archive on the release, and a channel's manifest names
 * itself, so Foundry keeps updating the channel installed. Pure: the build
 * scripts read and write the files.
 */
// The .ts extension lets Node run the build scripts that import this without a build.
import { AI_LICENSE } from './licenses.ts';

export const CHANNELS = ['cc0', 'everything', 'cc0-ai-free', 'everything-ai-free'] as const;
export type Channel = (typeof CHANNELS)[number];

/** What a channel leaves out, and the suffix its files take (`module<suffix>.json`, `<id><suffix>.zip`). */
interface ChannelRule {
    /** Only CC0 assets: everything under another licence is left out. */
    readonly cc0Only: boolean;
    /** AI-free: no AI-generated assets. */
    readonly aiFree: boolean;
    readonly suffix: string;
}

const RULES: Readonly<Record<Channel, ChannelRule>> = {
    'cc0': { cc0Only: true, aiFree: false, suffix: '' },
    'everything': { cc0Only: false, aiFree: false, suffix: '-everything' },
    'cc0-ai-free': { cc0Only: true, aiFree: true, suffix: '-ai-free' },
    'everything-ai-free': { cc0Only: false, aiFree: true, suffix: '-everything-ai-free' },
};

/** The channel for a reader's choices: Everything (other open licences too, acknowledged), and AI-free. */
export function channelFor(choice: { readonly everything: boolean; readonly aiFree: boolean }): Channel {
    const found = CHANNELS.find((channel) => RULES[channel].cc0Only === !choice.everything && RULES[channel].aiFree === choice.aiFree);
    return found ?? 'cc0';
}

/** Whether `channel` holds only CC0 assets. */
export const isCc0Only = (channel: Channel): boolean => RULES[channel].cc0Only;

/** Whether `channel` is AI-free. */
export const isAiFree = (channel: Channel): boolean => RULES[channel].aiFree;

/** A channel's two links: the manifest Foundry installs (and updates) from, and the archive it downloads. */
export interface ChannelLinks {
    readonly manifest: string;
    readonly download: string;
}

/** A file name or URL with `channel`'s suffix before its extension. */
function withSuffix(fileOrUrl: string, extension: string, channel: Channel): string {
    if (!fileOrUrl.endsWith(extension)) {
        throw new Error(`${fileOrUrl} does not end in ${extension}`);
    }
    return `${fileOrUrl.slice(0, -extension.length)}${RULES[channel].suffix}${extension}`;
}

/** `channel`'s links, from the module's own (which are the default `cc0` channel's). */
export function channelLinks(links: ChannelLinks, channel: Channel): ChannelLinks {
    return { manifest: withSuffix(links.manifest, '.json', channel), download: withSuffix(links.download, '.zip', channel) };
}

/** The Dungeondraft asset pack released beside a channel's archive: its name, as `.dungeondraft_pack`. */
export function dungeondraftLink(download: string): string {
    if (!download.endsWith('.zip')) {
        throw new Error(`${download} does not end in .zip`);
    }
    return `${download.slice(0, -'.zip'.length)}.dungeondraft_pack`;
}

/** Every channel's links, from the module's own. */
export function releaseLinks(links: ChannelLinks): Readonly<Record<Channel, ChannelLinks>> {
    return {
        'cc0': channelLinks(links, 'cc0'),
        'everything': channelLinks(links, 'everything'),
        'cc0-ai-free': channelLinks(links, 'cc0-ai-free'),
        'everything-ai-free': channelLinks(links, 'everything-ai-free'),
    };
}

/** `channel`'s file name for a release file named `fileName` (`module.json`, `<id>.zip`). */
export function channelFileName(fileName: string, channel: Channel): string {
    const dot = fileName.lastIndexOf('.');
    return withSuffix(fileName, fileName.slice(dot), channel);
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const isObject = (value: Json | undefined): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Whether a provenance (`{source, license, …}`) is left out of a channel under `rule`; `license` stands in for a provenance that gives none. */
function excludes(rule: ChannelRule, provenance: JsonObject, license: string): boolean {
    const own = typeof provenance['license'] === 'string' ? provenance['license'] : license;
    return (rule.cc0Only && own !== AI_LICENSE) || (rule.aiFree && provenance['ai'] === true);
}

/** Whether `node` carries a provenance its channel leaves out. */
function excludedNode(rule: ChannelRule, node: Json | undefined): boolean {
    const provenance = isObject(node) ? node['provenance'] : undefined;
    return isObject(provenance) && excludes(rule, provenance, AI_LICENSE);
}

/** `node` without any object (array entry or property) whose provenance its channel leaves out, however deep. */
function withoutExcluded(rule: ChannelRule, node: Json): Json {
    if (Array.isArray(node)) {
        return node.filter((entry) => !excludedNode(rule, entry)).map((entry) => withoutExcluded(rule, entry));
    }
    if (!isObject(node)) {
        return node;
    }
    return Object.fromEntries(
        Object.entries(node)
            .filter(([, value]) => !excludedNode(rule, value))
            .map(([key, value]) => [key, withoutExcluded(rule, value)]),
    );
}

/** A texture set as its channel ships it: without its roles whose source is left out; null when it keeps no role, or is left out as a whole. */
function channelTextureSet(rule: ChannelRule, set: JsonObject): JsonObject | null {
    const setLicense = typeof set['license'] === 'string' ? set['license'] : AI_LICENSE;
    const provenance = isObject(set['provenance']) ? set['provenance'] : null;
    const sources = isObject(set['sources']) ? set['sources'] : null;
    if (sources === null) {
        return provenance !== null && excludes(rule, provenance, setLicense) ? null : set;
    }
    const dropped = Object.entries(sources)
        .filter(([, source]) => isObject(source) && excludes(rule, source, setLicense))
        .map(([role]) => role);
    const without = (field: string): Json => {
        const value = set[field];
        return isObject(value) ? Object.fromEntries(Object.entries(value).filter(([role]) => !dropped.includes(role))) : value ?? null;
    };
    const kept: JsonObject = { ...set, textures: without('textures'), sources: without('sources') };
    for (const field of ['previews', 'resolutions'] as const) {
        if (field in set) {
            kept[field] = without(field);
        }
    }
    return isObject(kept['textures']) && Object.keys(kept['textures']).length > 0 ? kept : null;
}

/**
 * The pack's lists no release carries: music, character art and tokens. The
 * releases are a cartography module, not a character one, so these are found
 * and downloaded one by one in the gallery.
 */
export const GALLERY_ONLY = ['tokens', 'characterArt', 'music'] as const;

/**
 * The pack manifest as `channel` ships it: the gallery-only lists
 * (`GALLERY_ONLY`) dropped, and every stamp, texture role, sound and particle
 * emitter the channel leaves out removed (under another licence than CC0, or
 * AI-generated by its provenance's `ai` flag), so it names no file the
 * channel does not carry. An AI-free channel also leaves out any stamp that
 * records no provenance, since it cannot say it is not AI-generated.
 */
export function channelPack(pack: JsonObject, channel: Channel): JsonObject {
    const rule = RULES[channel];
    const released = Object.fromEntries(Object.entries(pack).filter(([key]) => !(GALLERY_ONLY as readonly string[]).includes(key)));
    const textureSets = Array.isArray(released['textureSets']) ? released['textureSets'].filter(isObject) : [];
    const sets = textureSets.map((set) => channelTextureSet(rule, set)).filter((set): set is JsonObject => set !== null);
    const stamps = Array.isArray(released['stamps']) ? released['stamps'] : [];
    const recorded = rule.aiFree ? stamps.filter((stamp) => isObject(stamp) && isObject(stamp['provenance'])) : stamps;
    const rest = withoutExcluded(rule, { ...released, stamps: recorded, textureSets: [] });
    return isObject(rest) ? { ...rest, textureSets: sets } : released;
}

/** The text a channel holding more than CC0 states as its licence: no one licence covers it. */
export const ALL_LICENSE_NOTE = 'Each asset under its own licence: see LICENSE-ART.md and CREDITS-ART.md';

/** Each release as the gallery names it. */
export const RELEASE_LABELS: Readonly<Record<Channel, string>> = {
    'cc0': 'CC0',
    'everything': 'Everything',
    'cc0-ai-free': 'CC0 AI-free',
    'everything-ai-free': 'Everything AI-free',
};

/**
 * The releases that hold a piece with `license` and `ai`, as `channelPack`
 * decides: CC0 only where it is CC0, AI-free only where it is not
 * AI-generated. A gallery-only piece (`galleryOnly`) is in none.
 */
export function releasesHolding(piece: { readonly license: string; readonly ai: boolean }, galleryOnly: boolean): Channel[] {
    if (galleryOnly) {
        return [];
    }
    return CHANNELS.filter((channel) => (!RULES[channel].cc0Only || piece.license === AI_LICENSE) && !(RULES[channel].aiFree && piece.ai));
}

/** Where a release's scene compendium is, inside the module. */
export const SCENES_PACK_PATH = 'packs/scenes';

/** The scene compendium a release declares when it carries scenes: Foundry's `packs` entry. */
export const SCENES_PACK: JsonObject = {
    name: 'scenes',
    label: 'Zephyr Cartography Scenes',
    path: SCENES_PACK_PATH,
    type: 'Scene',
    ownership: { PLAYER: 'NONE', ASSISTANT: 'OWNER' },
};

/**
 * The module's `module.json` as `channel` ships it: its manifest and download
 * that channel's, beyond CC0 its licence note, and its scene compendium
 * where it carries scenes (`hasScenes`).
 */
export function channelModule(moduleJson: JsonObject, links: ChannelLinks, channel: Channel, hasScenes: boolean): JsonObject {
    const own = channelLinks(links, channel);
    const linked = { ...moduleJson, manifest: own.manifest, download: own.download, ...(hasScenes ? { packs: [SCENES_PACK] } : {}) };
    return RULES[channel].cc0Only ? linked : { ...linked, license: ALL_LICENSE_NOTE };
}

export type { Json, JsonObject };
