// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * Narrowing the gallery, as the Foundry stamp browser does: words searched
 * from the start of the words of names, categories and tags; one category;
 * any number of tags, all required; a setting, a scale and a perspective;
 * and always one kind (stamps, textures or particle images), the tab shown.
 * Settings are tags (`setting-fantasy`) chosen on their own, never offered
 * among the tag chips. Pure.
 */
import type { GalleryItem } from './catalog';

export interface Filters {
    readonly kind: GalleryItem['kind'];
    readonly query: string;
    readonly category: string | null;
    readonly tags: readonly string[];
    readonly setting: string | null;
    readonly scale: string | null;
    readonly perspective: string | null;
}

export const NO_FILTERS: Filters = { kind: 'stamp', query: '', category: null, tags: [], setting: null, scale: null, perspective: null };

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

/** Whether `item` is of the kind shown and passes every other filter but those named in `ignore`. */
function passes(item: GalleryItem, filters: Filters, ignore: ReadonlySet<Exclude<keyof Filters, 'kind'>> = new Set()): boolean {
    const want = <K extends Exclude<keyof Filters, 'kind'>>(key: K): Filters[K] | null => (ignore.has(key) ? null : filters[key]);
    const category = want('category');
    const setting = want('setting');
    const scale = want('scale');
    const perspective = want('perspective');
    const tags = want('tags') ?? [];
    return (
        item.kind === filters.kind &&
        searched(item, filters.query) &&
        (category === null || item.category === category) &&
        (setting === null || item.tags.includes(setting)) &&
        (scale === null || item.scale === scale) &&
        (perspective === null || item.perspective === perspective) &&
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

/** Every value of an item's `scale` or `perspective`, sorted; items without one aside. */
export function choicesOf(items: readonly GalleryItem[], key: 'scale' | 'perspective'): string[] {
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
