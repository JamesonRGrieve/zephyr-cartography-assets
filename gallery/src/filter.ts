// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Narrowing the gallery, as the Foundry stamp browser does: words searched
 * from the start of the words of names, categories and tags; one category;
 * any number of tags, all required; a setting, a scale, a perspective, a
 * licence and a minimum resolution; and AI-generated pieces hidden or not;
 * and always one kind (stamps, textures or particle images), the tab shown.
 * Settings are tags (`setting-fantasy`) chosen on their own, never offered
 * among the tag chips. Pure.
 */
import type { GalleryItem, GallerySound } from './catalog';

export interface Filters {
    readonly kind: GalleryItem['kind'];
    readonly query: string;
    readonly category: string | null;
    readonly tags: readonly string[];
    readonly setting: string | null;
    readonly scale: string | null;
    readonly perspective: string | null;
    readonly license: string | null;
    /** The least long side, in px, every image of a piece must reach; null for any. */
    readonly minResolution: number | null;
    /** Whether AI-generated pieces (and sounds) are hidden. */
    readonly hideAi: boolean;
}

export const NO_FILTERS: Filters = {
    kind: 'stamp',
    query: '',
    category: null,
    tags: [],
    setting: null,
    scale: null,
    perspective: null,
    license: null,
    minResolution: null,
    hideAi: false,
};

/** A facet's value and how many items carry it. */
export interface Count {
    readonly name: string;
    readonly count: number;
}

/** A tag must be shared by this many of the items in view to be offered as a chip. */
const TAG_MIN_SHARED = 2;

/** Chips offered at most, the most shared first. */
const TAG_CHIP_LIMIT = 20;

/** The prefix that makes a tag a setting. */
const SETTING_PREFIX = 'setting-';

/** Whether `tag` names a setting (`setting-fantasy`). */
export const isSetting = (tag: string): boolean => tag.startsWith(SETTING_PREFIX);

/** The words of `text`, lower-cased: runs of letters and digits. */
const wordsIn = (text: string): string[] =>
    text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word !== '');

/** Whether every searched word starts a word of the item's name, category or tags ("cra" finds a crate, "rate" does not). */
function searched(item: GalleryItem, query: string): boolean {
    const haystack = [item.name, item.category, ...item.tags].flatMap(wordsIn);
    return wordsIn(query).every((word) => haystack.some((text) => text.startsWith(word)));
}

/** The minimum resolutions offered, in px on an image's long side: 512 px, 1K, 2K, 4K. */
export const RESOLUTION_STEPS = [512, 1024, 2048, 4096] as const;

/** Pixels per K, as resolutions are named (1K = 1024 px). */
const PX_PER_K = 1024;

/** A resolution step's long side in px: `512` → 512, `1K` → 1024; null for anything else. */
export function stepPx(step: string): number | null {
    const k = /^(\d+)K$/u.exec(step);
    if (k !== null) {
        return Number(k[1]) * PX_PER_K;
    }
    return /^\d+$/u.test(step) ? Number(step) : null;
}

/** An image's long side: its recorded closest-match resolution step, else its measured size; null when neither is known. */
function imageSide(variant: GalleryItem['variants'][number]): number | null {
    if (variant.resolution !== undefined) {
        return stepPx(variant.resolution);
    }
    return variant.width === null || variant.height === null ? null : Math.max(variant.width, variant.height);
}

/** A piece's resolution: the long side of its smallest image, so every image reaches it; null when an image's is unknown. */
export function longSideOf(item: GalleryItem): number | null {
    const sides = item.variants.map(imageSide);
    return sides.some((side) => side === null) ? null : Math.min(...sides.filter((side) => side !== null));
}

/** The minimum resolutions at least one of `items` reaches. */
export function resolutionChoices(items: readonly GalleryItem[]): number[] {
    const best = Math.max(0, ...items.map((item) => longSideOf(item) ?? 0));
    return RESOLUTION_STEPS.filter((step) => step <= best);
}

/** A minimum resolution as shown: `512 px+`, `1K+`, `2K+`. */
export function resolutionLabel(px: number): string {
    return px >= PX_PER_K ? `${px / PX_PER_K}K+` : `${px} px+`;
}

/** Whether `item` is of the kind shown and passes every other filter but those named in `ignore`. */
function passes(item: GalleryItem, filters: Filters, ignore: ReadonlySet<Exclude<keyof Filters, 'kind' | 'hideAi'>> = new Set()): boolean {
    const want = <K extends Exclude<keyof Filters, 'kind' | 'hideAi'>>(key: K): Filters[K] | null => (ignore.has(key) ? null : filters[key]);
    const category = want('category');
    const setting = want('setting');
    const scale = want('scale');
    const perspective = want('perspective');
    const license = want('license');
    const minResolution = want('minResolution');
    const tags = want('tags') ?? [];
    return (
        item.kind === filters.kind &&
        !(filters.hideAi && item.ai) &&
        searched(item, filters.query) &&
        (category === null || item.category === category) &&
        (setting === null || item.tags.includes(setting)) &&
        (scale === null || item.scale === scale) &&
        (perspective === null || item.perspective === perspective) &&
        (license === null || item.license === license) &&
        (minResolution === null || (longSideOf(item) ?? 0) >= minResolution) &&
        tags.every((tag) => item.tags.includes(tag))
    );
}

/** The items `filters` leave, in name order. */
export function narrow(items: readonly GalleryItem[], filters: Filters): GalleryItem[] {
    return items.filter((item) => passes(item, filters)).sort((a, b) => a.name.localeCompare(b.name));
}

/** How many of `values` each distinct one is. */
function tally(values: Iterable<string>): Map<string, number> {
    const counts = new Map<string, number>();
    for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return counts;
}

/** Each category, with how many items the other filters leave in it, by name. */
export function categoryCounts(items: readonly GalleryItem[], filters: Filters): Count[] {
    const counts = tally(items.filter((item) => passes(item, filters, new Set(['category', 'tags']))).map((item) => item.category));
    return [...counts].map(([category, count]) => ({ name: category, count })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The tags to offer as chips: those at least two of the items in view share,
 * the chosen ones and the settings aside, the most shared first.
 */
export function tagCounts(items: readonly GalleryItem[], filters: Filters): Count[] {
    const counts = tally(items.filter((item) => passes(item, filters)).flatMap((item) => item.tags));
    return [...counts]
        .filter(([tag, count]) => count >= TAG_MIN_SHARED && !isSetting(tag) && !filters.tags.includes(tag))
        .map(([tag, count]) => ({ name: tag, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, TAG_CHIP_LIMIT);
}

/** Every value of an item's `scale`, `perspective` or `license`, sorted; items without one aside. */
export function choicesOf(items: readonly GalleryItem[], key: 'scale' | 'perspective' | 'license'): string[] {
    return [...new Set(items.flatMap((item) => (item[key] === null ? [] : [item[key]])))].sort();
}

/** Words shown other than title-cased. */
const SPELLED: Readonly<Record<string, string>> = { scifi: 'Sci-Fi' };

/** A schema value as shown: its words title-cased (`interior` → `Interior`, `top-down` → `Top-Down`, `scifi` → `Sci-Fi`). */
export function valueLabel(value: string): string {
    return value
        .split('-')
        .map((word) => SPELLED[word] ?? word.charAt(0).toUpperCase() + word.slice(1))
        .join('-');
}

/**
 * A setting as shown: its words title-cased, the family before a colon
 * (`setting-grimdark-human` → `Grimdark: Human`, `setting-scifi` → `Sci-Fi`).
 */
export function settingLabel(setting: string): string {
    const [family = '', ...kind] = setting
        .slice(SETTING_PREFIX.length)
        .split('-')
        .map((word) => SPELLED[word] ?? word.charAt(0).toUpperCase() + word.slice(1));
    return kind.length === 0 ? family : `${family}: ${kind.join(' ')}`;
}

/** Each setting, with how many items the other filters leave in it, by its label. */
export function settingCounts(items: readonly GalleryItem[], filters: Filters): Count[] {
    const counts = tally(items.filter((item) => passes(item, filters, new Set(['setting']))).flatMap((item) => item.tags.filter(isSetting)));
    return [...counts].map(([setting, count]) => ({ name: setting, count })).sort((a, b) => settingLabel(a.name).localeCompare(settingLabel(b.name)));
}

/** `filters` with `tag` added, or taken away if it is chosen already. */
export function toggledTag(filters: Filters, tag: string): Filters {
    const tags = filters.tags.includes(tag) ? filters.tags.filter((t) => t !== tag) : [...filters.tags, tag];
    return { ...filters, tags };
}

/** The sounds `filters` leave: AI-generated ones are hidden with the AI-generated pieces. */
export function visibleSounds(sounds: readonly GallerySound[], filters: Filters): GallerySound[] {
    return sounds.filter((sound) => !(filters.hideAi && sound.ai));
}
